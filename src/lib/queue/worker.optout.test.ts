import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  instagramAccount: { findUnique: vi.fn() },
  contact: { update: vi.fn() },
  flowRun: { updateMany: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const contacts = vi.hoisted(() => ({
  getOrCreateContact: vi.fn(),
  recordIncomingMessage: vi.fn(),
  recordOutgoingMessage: vi.fn(),
}));
const engine = vi.hoisted(() => ({
  findMatchingTrigger: vi.fn(),
  executeFlow: vi.fn(),
  resumeFlowOnClick: vi.fn(),
  resumeFlowOnMessage: vi.fn(),
}));
const graph = vi.hoisted(() => ({ sendTextMessage: vi.fn(), replyToComment: vi.fn() }));

// Plano em dia por padrão; o bloqueio por plano tem teste próprio abaixo e em billing/entitlements.
const sendingBlockReason = vi.hoisted(() => vi.fn(async (): Promise<string | null> => null));
vi.mock("@/lib/billing/entitlements", () => ({ sendingBlockReason }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/engine/contacts", () => contacts);
vi.mock("@/lib/engine/matcher", () => ({ findMatchingTrigger: engine.findMatchingTrigger }));
vi.mock("@/lib/engine/runner", () => ({
  executeFlow: engine.executeFlow,
  resumeFlowOnClick: engine.resumeFlowOnClick,
  resumeFlowOnMessage: engine.resumeFlowOnMessage,
}));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn(async () => graph) }));

import { processEvent, resumeDueDelays } from "./worker";

const contact = (optedOut: boolean) => ({ id: "c_1", accountId: "acc_1", igsid: "igsid_1", optedOut, lastInboundAt: new Date() });
const dm = (text: string) => ({
  kind: "message" as const,
  igUserId: "178",
  messageId: `mid_${text}`,
  userIgsid: "igsid_1",
  text,
  timestamp: Date.now(),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.instagramAccount.findUnique.mockResolvedValue({ id: "acc_1", igUserId: "178", status: "CONNECTED" });
  db.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  contacts.recordIncomingMessage.mockResolvedValue({ id: "m" });
  graph.sendTextMessage.mockResolvedValue({ success: true });
  engine.resumeFlowOnMessage.mockResolvedValue(null);
  engine.findMatchingTrigger.mockResolvedValue({ flow: { id: "f_1" }, trigger: { id: "t_1" }, startNodeId: "n_1" });
});

describe("worker × opt-out", () => {
  it("depois do 'parar', uma DM com palavra-chave é gravada mas nenhuma automação roda", async () => {
    contacts.getOrCreateContact.mockResolvedValue(contact(true));
    await processEvent(dm("eu quero"));
    expect(contacts.recordIncomingMessage).toHaveBeenCalledTimes(1);
    expect(engine.resumeFlowOnMessage).not.toHaveBeenCalled();
    expect(engine.findMatchingTrigger).not.toHaveBeenCalled();
    expect(engine.executeFlow).not.toHaveBeenCalled();
    expect(graph.sendTextMessage).not.toHaveBeenCalled();
  });

  it("'PARAR' tira o contato das automações em vez de procurar gatilho", async () => {
    contacts.getOrCreateContact.mockResolvedValue(contact(false));
    await processEvent(dm("PARAR"));
    expect(db.contact.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ optedOut: true }) }));
    expect(engine.findMatchingTrigger).not.toHaveBeenCalled();
  });

  it("contato inscrito segue para o motor normalmente", async () => {
    contacts.getOrCreateContact.mockResolvedValue(contact(false));
    await processEvent(dm("eu quero"));
    expect(engine.findMatchingTrigger).toHaveBeenCalled();
    expect(engine.executeFlow).toHaveBeenCalled();
  });

  it("a retomada de esperas pula contatos que saíram", async () => {
    db.flowRun.findMany.mockResolvedValue([]);
    await resumeDueDelays();
    expect(db.flowRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contact: { optedOut: false } }) }),
    );
  });
});
