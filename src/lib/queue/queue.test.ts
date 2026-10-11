import { afterEach, describe, expect, it, vi } from "vitest";
import { idempotencyKeyFor } from "./idempotency";
import {
  backoffDelayMs,
  claimEvent,
  enqueueEvent,
  isUniqueViolation,
  markRetryable,
  MAX_ATTEMPTS,
} from "./store";
import { processEvent } from "./worker";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEvent: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    instagramAccount: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/account", () => ({ getCurrentAccount: vi.fn() }));
vi.mock("@/lib/meta/graph", () => ({
  defaultGraphClient: { replyToComment: vi.fn(), sendTextMessage: vi.fn() },
}));
vi.mock("@/lib/engine/contacts", () => ({
  getOrCreateContact: vi.fn(),
  recordIncomingMessage: vi.fn(),
  recordOutgoingMessage: vi.fn(),
}));
vi.mock("@/lib/engine/matcher", () => ({ findMatchingTrigger: vi.fn() }));
vi.mock("@/lib/engine/runner", () => ({ executeFlow: vi.fn(), resumeFlowOnClick: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getOrCreateContact, recordIncomingMessage } from "@/lib/engine/contacts";
import { executeFlow } from "@/lib/engine/runner";

const mockedPrisma = vi.mocked(prisma, true);
const mockedRecordIncoming = vi.mocked(recordIncomingMessage);
const mockedExecuteFlow = vi.mocked(executeFlow);

afterEach(() => vi.clearAllMocks());

const account = { id: "acc_1", igUserId: "IG_1" };

function commentEvent(overrides: Partial<Record<string, unknown>> = {}): NormalizedWebhookEvent {
  return {
    kind: "comment",
    igUserId: "IG_1",
    commentId: "c_123",
    mediaId: "m_9",
    userIgsid: "user_77",
    username: "maria",
    text: "quero",
    timestamp: 1_700_000_000_000,
    ...overrides,
  } as NormalizedWebhookEvent;
}

describe("Item 4 — chaves de idempotência", () => {
  it("mesma entrega gera sempre a mesma chave (estável, sem aleatoriedade)", () => {
    const a = idempotencyKeyFor(commentEvent());
    const b = idempotencyKeyFor(commentEvent());
    expect(a).toBe(b);
    expect(a).toBe("ig:IG_1:comment:c_123");
  });

  it("eventos diferentes têm chaves diferentes", () => {
    expect(idempotencyKeyFor(commentEvent())).not.toBe(idempotencyKeyFor(commentEvent({ commentId: "c_124" })));
  });

  it("mensagem usa o mid como chave", () => {
    const event = {
      kind: "message",
      igUserId: "IG_1",
      messageId: "mid_9",
      userIgsid: "u1",
      text: "oi",
      timestamp: 1,
    } as NormalizedWebhookEvent;
    expect(idempotencyKeyFor(event)).toBe("ig:IG_1:message:mid_9");
  });

  it("postback usa mid quando existe e hash estável quando não existe", () => {
    const withMid = {
      kind: "postback",
      igUserId: "IG_1",
      userIgsid: "u1",
      title: "OK",
      payload: "node:n1_btn_b1",
      postbackMid: "pb_1",
      timestamp: 1,
    } as NormalizedWebhookEvent;
    expect(idempotencyKeyFor(withMid)).toBe("ig:IG_1:postback:pb_1");

    const noMid = { ...withMid, postbackMid: undefined };
    expect(idempotencyKeyFor(noMid)).toBe(idempotencyKeyFor(noMid));
    expect(idempotencyKeyFor(noMid)).toMatch(/^ig:IG_1:postback:hash:[0-9a-f]{32}$/);
  });
});

describe("Item 4 — store da fila", () => {
  it("P2002 no enqueue devolve duplicado (Meta reentregou)", async () => {
    mockedPrisma.webhookEvent.create.mockRejectedValue({ code: "P2002" } as never);
    const result = await enqueueEvent({ idempotencyKey: "k", type: "comment", payload: commentEvent() });
    expect(result).toEqual({ duplicate: true });
  });

  it("erro que não é duplicação sobe (rota deve devolver 500)", async () => {
    mockedPrisma.webhookEvent.create.mockRejectedValue(new Error("connection refused"));
    await expect(
      enqueueEvent({ idempotencyKey: "k", type: "comment", payload: commentEvent() })
    ).rejects.toThrow("connection refused");
  });

  it("reivindicação é atômica: só passa quem muda o status (count === 1)", async () => {
    mockedPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 } as never);
    expect(await claimEvent("ev_1")).toBe(true);

    mockedPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await claimEvent("ev_1")).toBe(false);
  });

  it("backoff exponencial com teto de 15 minutos", () => {
    expect(backoffDelayMs(1)).toBe(30_000);
    expect(backoffDelayMs(2)).toBe(60_000);
    expect(backoffDelayMs(3)).toBe(120_000);
    expect(backoffDelayMs(20)).toBe(15 * 60_000);
  });

  it("retentável vira DEAD ao esgotar as tentativas", async () => {
    mockedPrisma.webhookEvent.findUnique.mockResolvedValue({ attempts: MAX_ATTEMPTS - 1 } as never);
    await markRetryable("ev_1", "falha transitória");
    expect(mockedPrisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DEAD", attempts: MAX_ATTEMPTS }),
      })
    );
  });

  it("retentável abaixo do limite volta para RECEIVED com nova agenda", async () => {
    mockedPrisma.webhookEvent.findUnique.mockResolvedValue({ attempts: 1 } as never);
    await markRetryable("ev_1", "rate limit");
    expect(mockedPrisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RECEIVED", attempts: 2, nextAttemptAt: expect.any(Date) }),
      })
    );
  });

  it("isUniqueViolation reconhece P2002", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

describe("Item 4 — processEvent (worker)", () => {
  it("sem conta conectada lança erro permanente (não retenta)", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue(null as never);
    const { getCurrentAccount } = await import("@/lib/account");
    vi.mocked(getCurrentAccount).mockResolvedValue(null as never);

    await expect(processEvent(commentEvent())).rejects.toThrow(/Nenhuma conta Instagram/);
  });

  it("mensagem duplicada NÃO reexecuta o fluxo (exatamente 1 DM)", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue(account as never);
    vi.mocked(getOrCreateContact).mockResolvedValue({ id: "contact_1" } as never);
    mockedRecordIncoming.mockResolvedValue({ message: {}, duplicate: true } as never);

    await processEvent(commentEvent());

    expect(mockedExecuteFlow).not.toHaveBeenCalled();
  });

  it("comentário novo com match executa o fluxo uma vez só", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue(account as never);
    vi.mocked(getOrCreateContact).mockResolvedValue({ id: "contact_1" } as never);
    mockedRecordIncoming.mockResolvedValue({ message: {}, duplicate: false } as never);
    const { findMatchingTrigger } = await import("@/lib/engine/matcher");
    vi.mocked(findMatchingTrigger).mockResolvedValue({
      flow: { id: "flow_1" },
      trigger: { id: "trg_1" },
      startNodeId: "n1",
    } as never);
    vi.mocked(executeFlow).mockResolvedValue({ success: true } as never);

    await processEvent(commentEvent());

    expect(mockedExecuteFlow).toHaveBeenCalledTimes(1);
    expect(mockedExecuteFlow).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: "flow_1", startNodeId: "n1", triggerId: "trg_1" })
    );
  });
});
