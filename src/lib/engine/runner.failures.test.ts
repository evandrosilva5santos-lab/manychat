import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeFlow } from "./runner";
import { RetryableError } from "@/lib/queue/errors";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flow: { findUnique: vi.fn() },
    flowRun: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    contact: { update: vi.fn() },
    contactTag: { findUnique: vi.fn(), upsert: vi.fn() },
    node: { findFirst: vi.fn() },
    instagramAccount: { findUnique: vi.fn() },
  },
}));

const { accountClient } = vi.hoisted(() => ({
  accountClient: {
    sendTextMessage: vi.fn(),
    sendButtonMessage: vi.fn(),
    sendCarouselMessage: vi.fn(),
    checkUserFollows: vi.fn(),
  },
}));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn(async () => accountClient) }));

vi.mock("./contacts", () => ({ recordOutgoingMessage: vi.fn() }));

import { prisma } from "@/lib/prisma";

const mockedPrisma = vi.mocked(prisma, true);
const mockedSend = vi.mocked(accountClient.sendTextMessage);
const mockedSendButtons = vi.mocked(accountClient.sendButtonMessage);

const contact = { id: "contact_1", igsid: "ig_user_9", username: "maria", name: null, followsAccount: null };

function messageNode(id: string, text: string) {
  return { id, type: "MESSAGE", data: { text }, carouselCards: [] };
}

/** Fluxo: msg1 → msg2 (uma falha no primeiro envio não pode enviar o segundo). */
function twoMessageFlow() {
  return {
    id: "flow_1",
    mode: "ADVANCED",
    nodes: [messageNode("n1", "primeira"), messageNode("n2", "segunda")],
    edges: [{ id: "e1", sourceNodeId: "n1", sourceHandle: null, targetNodeId: "n2" }],
  };
}

function questionFlow() {
  return {
    id: "flow_1",
    mode: "ADVANCED",
    nodes: [
      {
        id: "q1",
        type: "QUESTION",
        data: { text: "escolha", buttons: [{ id: "b1", title: "SIM", type: "postback" }] },
        carouselCards: [],
      },
    ],
    edges: [],
  };
}

function delayFlow() {
  return {
    id: "flow_1",
    mode: "ADVANCED",
    nodes: [messageNode("n0", "inicio"), { id: "d1", type: "DELAY", data: { seconds: 60 }, carouselCards: [] }, messageNode("n3", "pos-espera")],
    edges: [
      { id: "e0", sourceNodeId: "n0", sourceHandle: null, targetNodeId: "d1" },
      { id: "e1", sourceNodeId: "d1", sourceHandle: null, targetNodeId: "n3" },
    ],
  };
}

function mockFreshRun(startNodeId = "n1") {
  mockedPrisma.flowRun.findFirst.mockResolvedValue(null as never);
  mockedPrisma.flowRun.create.mockResolvedValue({
    id: "run_1",
    status: "RUNNING",
    currentNodeId: startNodeId,
    resumeAt: null,
  } as never);
}

beforeEach(() => {
  mockedPrisma.instagramAccount.findUnique.mockResolvedValue({ status: "CONNECTED" } as never);
  mockedPrisma.flowRun.updateMany.mockResolvedValue({ count: 1 } as never);
});
afterEach(() => vi.resetAllMocks());

describe("Item 4 — falhas de envio no motor", () => {
  it("erro permanente: run vira FAILED com motivo e o fluxo PARA (segunda mensagem não sai)", async () => {
    mockedPrisma.flow.findUnique.mockResolvedValue(twoMessageFlow() as never);
    mockFreshRun();
    mockedSend.mockResolvedValue({ success: false, error: "Recipient not found" } as never);

    const result = await executeFlow({
      accountId: "acc",
      contact,
      flowId: "flow_1",
      startNodeId: "n1",
    });

    expect(result).toMatchObject({ success: false, failed: true });
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.flowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: expect.stringContaining("Recipient not found"),
          currentNodeId: "n1",
        }),
      })
    );
  });

  it("erro retentável (rate limit): lança RetryableError e mantém o run no nó que falhou", async () => {
    mockedPrisma.flow.findUnique.mockResolvedValue(twoMessageFlow() as never);
    mockFreshRun();
    mockedSend.mockResolvedValue({ success: false, code: "4", error: "Application request limit reached" } as never);

    await expect(
      executeFlow({ accountId: "acc", contact, flowId: "flow_1", startNodeId: "n1" })
    ).rejects.toThrow(RetryableError);

    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.flowRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1", status: { not: "FAILED" } },
        data: expect.objectContaining({ status: "RUNNING", currentNodeId: "n1" }),
      })
    );
  });

  it("QUESTION que falha NÃO entra em WAITING_CLICK (não há botões no ar)", async () => {
    mockedPrisma.flow.findUnique.mockResolvedValue(questionFlow() as never);
    mockFreshRun("q1");
    mockedSendButtons.mockResolvedValue({ success: false, error: "bloqueado" } as never);

    const result = await executeFlow({ accountId: "acc", contact, flowId: "flow_1", startNodeId: "q1" });

    expect(result).toMatchObject({ success: false, failed: true });
    const statuses = [...mockedPrisma.flowRun.update.mock.calls, ...mockedPrisma.flowRun.updateMany.mock.calls].map(
      (c) => (c[0] as { data?: { status?: string } }).data?.status
    );
    expect(statuses).not.toContain("WAITING_CLICK");
  });

  it("DELAY vencido em retomada segue direto (não espera de novo)", async () => {
    mockedPrisma.flow.findUnique.mockResolvedValue(delayFlow() as never);
    mockedPrisma.flowRun.findUnique.mockResolvedValue({
      id: "run_1",
      flowId: "flow_1",
      status: "RUNNING",
      currentNodeId: "d1",
      resumeAt: new Date(Date.now() - 60_000),
    } as never);
    mockedSend.mockResolvedValue({ success: true, messageId: "m" } as never);

    const result = await executeFlow({
      accountId: "acc",
      contact,
      flowId: "flow_1",
      runId: "run_1",
      startNodeId: "d1",
    });

    expect(result).toMatchObject({ success: true, finished: true });
    // n0 não reenvia (retomada começa no DELAY); só "pos-espera" sai.
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend).toHaveBeenCalledWith("ig_user_9", "pos-espera", undefined);
  });

  it("gatilho novo com run aguardando clique NÃO redispara o fluxo", async () => {
    mockedPrisma.flow.findUnique.mockResolvedValue(twoMessageFlow() as never);
    mockedPrisma.flowRun.findFirst.mockResolvedValue({
      id: "run_x",
      status: "WAITING_CLICK",
      currentNodeId: "q1",
    } as never);

    const result = await executeFlow({
      accountId: "acc",
      contact,
      flowId: "flow_1",
      startNodeId: "n1",
    });

    expect(result).toMatchObject({ success: true, alreadyActive: true });
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedPrisma.flowRun.create).not.toHaveBeenCalled();
  });
});
