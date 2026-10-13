import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getAccount, execute } = vi.hoisted(() => ({
  db: {
    webhookEvent: { findMany: vi.fn() },
    message: { findUnique: vi.fn() },
    flowRun: { update: vi.fn() },
  },
  getAccount: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/account", () => ({ getCurrentAccount: getAccount }));
vi.mock("@/lib/auth/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/engine/runner", () => ({ executeFlow: execute }));

import { listDeadEvents, retryFailedSend } from "./actions";

const form = (id: string) => {
  const f = new FormData();
  f.set("messageId", id);
  return f;
};
const message = (accountId: string) => ({
  id: "cmessage000000000000000", accountId, kind: "TEXT", nodeId: "n1",
  contact: { id: "c" }, run: { id: "r", flowId: "f", status: "FAILED" },
});
const MID = "cmessage000000000000000";

beforeEach(() => {
  vi.resetAllMocks();
  db.webhookEvent.findMany.mockResolvedValue([]);
  db.flowRun.update.mockResolvedValue({});
  execute.mockResolvedValue({ success: true });
});

describe("falhas: escopo por perfil ativo", () => {
  it("listDeadEvents filtra pelo accountId ativo", async () => {
    getAccount.mockResolvedValue({ id: "acc_1", status: "CONNECTED" });
    await listDeadEvents();
    expect(db.webhookEvent.findMany.mock.calls[0][0].where).toMatchObject({ accountId: "acc_1" });
  });

  it("listDeadEvents sem perfil ativo devolve [] sem consultar", async () => {
    getAccount.mockResolvedValue(null);
    expect(await listDeadEvents()).toEqual([]);
    expect(db.webhookEvent.findMany).not.toHaveBeenCalled();
  });

  it("retryFailedSend recusa mensagem de outro perfil (IDOR) sem reabrir o run", async () => {
    getAccount.mockResolvedValue({ id: "acc_1", status: "CONNECTED" });
    db.message.findUnique.mockResolvedValue(message("acc_outro"));
    expect(await retryFailedSend(form(MID))).toEqual({ ok: false, error: "Mensagem não encontrada" });
    expect(db.flowRun.update).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("retryFailedSend exige perfil CONNECTED", async () => {
    getAccount.mockResolvedValue({ id: "acc_1", status: "EXPIRED" });
    db.message.findUnique.mockResolvedValue(message("acc_1"));
    expect(await retryFailedSend(form(MID))).toEqual({ ok: false, error: "Perfil não conectado — reconecte em Ajustes." });
    expect(execute).not.toHaveBeenCalled();
  });

  it("retryFailedSend não reenvia para contato que pediu para parar (opt-out)", async () => {
    getAccount.mockResolvedValue({ id: "acc_1", status: "CONNECTED" });
    db.message.findUnique.mockResolvedValue({ ...message("acc_1"), contact: { id: "c", optedOut: true } });
    expect(await retryFailedSend(form(MID))).toEqual({
      ok: false,
      error: "Este contato pediu para parar de receber mensagens automáticas.",
    });
    expect(db.flowRun.update).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("retryFailedSend do próprio perfil reabre o run (RUNNING) e reexecuta", async () => {
    getAccount.mockResolvedValue({ id: "acc_1", status: "CONNECTED" });
    db.message.findUnique.mockResolvedValue(message("acc_1"));
    expect(await retryFailedSend(form(MID))).toEqual({ ok: true });
    expect(db.flowRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RUNNING" }) }));
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ accountId: "acc_1", runId: "r" }));
  });
});
