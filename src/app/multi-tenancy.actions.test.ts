import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getCurrentAccount, getWorkspaceRole, assertWithinLimit } = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  getWorkspaceRole: vi.fn(),
  assertWithinLimit: vi.fn(),
  db: {
    message: { findMany: vi.fn() },
    flow: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/account", () => ({ getCurrentAccount }));
vi.mock("@/lib/tenancy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenancy")>()),
  getCurrentActor: vi.fn(async () => ({ id: "u-a", name: "A", email: "a@x", role: "CLIENT" })),
  getWorkspaceRole,
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing/entitlements", () => ({ assertWithinLimit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn() }));

import { getConversationThread } from "./conversas/actions";
import { deleteFlow, updateFlowStatus } from "./fluxos/actions";
import { PlanLimitError } from "@/lib/billing/plan-rules";

describe("ações isoladas por conta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentAccount.mockResolvedValue({ id: "account-a", username: "cliente-a", workspaceId: "w-a" });
    getWorkspaceRole.mockResolvedValue("ADMIN");
    db.message.findMany.mockResolvedValue([]);
    db.flow.findFirst.mockResolvedValue(null);
  });

  it("cliente A não lê as mensagens do contato da conta B", async () => {
    await expect(getConversationThread("contact-b")).resolves.toEqual({ ok: true, messages: [] });
    expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { contactId: "contact-b", accountId: "account-a" } }));
  });

  it("cliente A não altera o fluxo da conta B", async () => {
    await expect(deleteFlow("flow-b")).resolves.toEqual({ ok: false, error: "Fluxo não encontrado." });
    expect(db.flow.findFirst).toHaveBeenCalledWith({ where: { id: "flow-b", accountId: "account-a" }, select: { id: true } });
    expect(db.flow.update).not.toHaveBeenCalled();
  });

  it("atendente (OPERATOR) não altera automações nem do próprio workspace", async () => {
    getWorkspaceRole.mockResolvedValue("OPERATOR");
    await expect(deleteFlow("flow-a")).resolves.toEqual({ ok: false, error: "Seu papel na equipe não permite alterar automações." });
    expect(db.flow.findFirst).not.toHaveBeenCalled();
  });

  describe("limite de automações ativas", () => {
    beforeEach(() => db.flow.findFirst.mockResolvedValue({ id: "flow-a" }));

    it("ativar respeita o plano e mostra a mensagem do limite", async () => {
      db.flow.findUnique.mockResolvedValue({ status: "DRAFT" });
      assertWithinLimit.mockRejectedValue(new PlanLimitError("Seu plano permite até 10 automações ativas."));
      await expect(updateFlowStatus("flow-a", "LIVE")).resolves.toEqual({ ok: false, error: "Seu plano permite até 10 automações ativas." });
      expect(assertWithinLimit).toHaveBeenCalledWith("w-a", "maxActiveFlows");
      expect(db.flow.update).not.toHaveBeenCalled();
    });

    it("fluxo que já está ao vivo não conta de novo", async () => {
      db.flow.findUnique.mockResolvedValue({ status: "LIVE" });
      await expect(updateFlowStatus("flow-a", "LIVE")).resolves.toMatchObject({ ok: true });
      expect(assertWithinLimit).not.toHaveBeenCalled();
    });

    it("parar nunca é barrado pelo plano", async () => {
      await expect(updateFlowStatus("flow-a", "STOPPED")).resolves.toMatchObject({ ok: true });
      expect(assertWithinLimit).not.toHaveBeenCalled();
    });
  });
});
