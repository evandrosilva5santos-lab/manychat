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
import { processEvent, resumeDueDelays } from "./worker";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

// Plano em dia por padrão; o bloqueio por plano tem teste próprio abaixo e em billing/entitlements.
const sendingBlockReason = vi.hoisted(() => vi.fn(async (): Promise<string | null> => null));
vi.mock("@/lib/billing/entitlements", () => ({ sendingBlockReason }));
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
    flowRun: { findMany: vi.fn(), updateMany: vi.fn() },
    contact: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn() }));
vi.mock("@/lib/engine/contacts", () => ({
  getOrCreateContact: vi.fn(),
  recordIncomingMessage: vi.fn(),
  recordOutgoingMessage: vi.fn(),
}));
vi.mock("@/lib/engine/matcher", () => ({ findMatchingTrigger: vi.fn() }));
vi.mock("@/lib/engine/runner", () => ({ executeFlow: vi.fn(), resumeFlowOnClick: vi.fn(), resumeFlowOnMessage: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getOrCreateContact, recordIncomingMessage } from "@/lib/engine/contacts";
import { executeFlow } from "@/lib/engine/runner";

const mockedPrisma = vi.mocked(prisma, true);
const mockedRecordIncoming = vi.mocked(recordIncomingMessage);
const mockedExecuteFlow = vi.mocked(executeFlow);

afterEach(() => vi.clearAllMocks());

const account = { id: "acc_1", igUserId: "IG_1", status: "CONNECTED" };

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
  it("perfil desconhecido: descarta sem gravar nada (sem fallback para conta atual)", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue(null as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(processEvent(commentEvent())).resolves.toBeNull();
    expect(getOrCreateContact).not.toHaveBeenCalled();
    expect(mockedRecordIncoming).not.toHaveBeenCalled();
    expect(mockedExecuteFlow).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("perfil DISCONNECTED: não grava contato nem mensagem e não dispara gatilho", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue({ ...account, status: "DISCONNECTED" } as never);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await processEvent(commentEvent());
    expect(getOrCreateContact).not.toHaveBeenCalled();
    expect(mockedRecordIncoming).not.toHaveBeenCalled();
    expect(mockedExecuteFlow).not.toHaveBeenCalled();
  });

  it("perfil EXPIRED: registra contato e mensagem, mas não procura gatilho nem envia", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue({ ...account, status: "EXPIRED" } as never);
    vi.mocked(getOrCreateContact).mockResolvedValue({ id: "contact_1" } as never);
    mockedRecordIncoming.mockResolvedValue({ message: {}, duplicate: false } as never);
    const { findMatchingTrigger } = await import("@/lib/engine/matcher");
    const { resumeFlowOnMessage } = await import("@/lib/engine/runner");
    await processEvent(commentEvent());
    await processEvent({ kind: "message", igUserId: "IG_1", messageId: "m1", userIgsid: "u", text: "oi", timestamp: 1, isStoryReply: false } as never);
    expect(getOrCreateContact).toHaveBeenCalledTimes(2);
    expect(mockedRecordIncoming).toHaveBeenCalledTimes(2);
    expect(findMatchingTrigger).not.toHaveBeenCalled();
    expect(resumeFlowOnMessage).not.toHaveBeenCalled();
    expect(mockedExecuteFlow).not.toHaveBeenCalled();
  });

  it("plano bloqueado: grava o comentário, mas não responde em público nem inicia fluxo", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue(account as never);
    sendingBlockReason.mockResolvedValueOnce("A assinatura está suspensa.");
    vi.mocked(getOrCreateContact).mockResolvedValue({ id: "contact_1" } as never);
    mockedRecordIncoming.mockResolvedValue({ message: {}, duplicate: false } as never);
    const { findMatchingTrigger } = await import("@/lib/engine/matcher");
    const { graphClientForAccount } = await import("@/lib/meta/account-client");
    await processEvent(commentEvent());
    expect(mockedRecordIncoming).toHaveBeenCalledTimes(1);
    expect(findMatchingTrigger).not.toHaveBeenCalled();
    expect(graphClientForAccount).not.toHaveBeenCalled();
    expect(mockedExecuteFlow).not.toHaveBeenCalled();
  });

  it("resposta pública sem cliente da conta é ignorada (sem token global) e o fluxo segue", async () => {
    mockedPrisma.instagramAccount.findUnique.mockResolvedValue(account as never);
    vi.mocked(getOrCreateContact).mockResolvedValue({ id: "contact_1" } as never);
    mockedRecordIncoming.mockResolvedValue({ message: {}, duplicate: false } as never);
    const { findMatchingTrigger } = await import("@/lib/engine/matcher");
    const { graphClientForAccount } = await import("@/lib/meta/account-client");
    const { recordOutgoingMessage } = await import("@/lib/engine/contacts");
    vi.mocked(graphClientForAccount).mockRejectedValueOnce(new Error("sem token"));
    vi.mocked(findMatchingTrigger).mockResolvedValueOnce({
      flow: { id: "flow_1" }, trigger: { id: "trg_1" }, startNodeId: "n1", publicReply: "Enviei no direct!",
    } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await processEvent(commentEvent());
    expect(recordOutgoingMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(mockedExecuteFlow).toHaveBeenCalledTimes(1);
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

describe("Perfil seguro: fila", () => {
  it("enqueueEvent grava accountId quando informado e null quando não", async () => {
    mockedPrisma.webhookEvent.create.mockResolvedValue({ id: "e" } as never);
    await enqueueEvent({ idempotencyKey: "k1", type: "comment", payload: commentEvent(), accountId: "acc_1" });
    await enqueueEvent({ idempotencyKey: "k2", type: "comment", payload: commentEvent() });
    expect(mockedPrisma.webhookEvent.create.mock.calls[0][0].data.accountId).toBe("acc_1");
    expect(mockedPrisma.webhookEvent.create.mock.calls[1][0].data.accountId).toBeNull();
  });

  it("resumeDueDelays só considera runs cujo perfil está CONNECTED", async () => {
    mockedPrisma.flowRun.findMany.mockResolvedValue([] as never);
    await resumeDueDelays(5);
    expect(mockedPrisma.flowRun.findMany.mock.calls[0][0]?.where).toMatchObject({
      status: "WAITING_DELAY",
      flow: { account: { status: "CONNECTED" } },
    });
  });

  it("resumeDueDelays devolve o run à espera (+60s) quando executeFlow lança, sem logar a mensagem", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedPrisma.flowRun.findMany.mockResolvedValue([{ id: "run_1", flowId: "f", contactId: "c" }] as never);
    mockedPrisma.flowRun.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.contact.findUnique.mockResolvedValue({ id: "c", accountId: "acc_1" } as never);
    mockedExecuteFlow.mockRejectedValueOnce(Object.assign(new Error("SELECT dado pessoal"), { code: "P2024" }));

    const before = Date.now();
    expect(await resumeDueDelays(5)).toBe(0);

    expect(mockedPrisma.flowRun.updateMany).toHaveBeenCalledTimes(2);
    const restore = mockedPrisma.flowRun.updateMany.mock.calls[1][0] as {
      where: unknown; data: { status: string; resumeAt: Date };
    };
    expect(restore.where).toEqual({ id: "run_1", status: "RUNNING" });
    expect(restore.data.status).toBe("WAITING_DELAY");
    expect(restore.data.resumeAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(JSON.stringify(error.mock.calls)).not.toContain("dado pessoal");
    expect(JSON.stringify(error.mock.calls)).toContain("P2024");
  });

  it("resumeDueDelays segue em frente se nem devolver à espera for possível", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedPrisma.flowRun.findMany.mockResolvedValue([{ id: "run_1", flowId: "f", contactId: "c" }] as never);
    mockedPrisma.flowRun.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockRejectedValueOnce(new Error("db caiu"));
    mockedPrisma.contact.findUnique.mockResolvedValue({ id: "c", accountId: "acc_1" } as never);
    mockedExecuteFlow.mockRejectedValueOnce(new Error("x"));
    await expect(resumeDueDelays(5)).resolves.toBe(0);
  });
});
