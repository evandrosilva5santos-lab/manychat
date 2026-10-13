import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    workspace: { findUnique: vi.fn() },
    instagramAccount: { findUnique: vi.fn(), count: vi.fn() },
    workspaceMember: { count: vi.fn() },
    workspaceInvitation: { count: vi.fn() },
    flow: { count: vi.fn() },
    message: { count: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { assertCanAddMember, assertWithinLimit, getEntitlements, monthStart, sendingBlockReason } from "./entitlements";

const plan = { name: "Starter", slug: "starter", features: [], maxInstagramAccounts: 1, maxMembers: 2, maxActiveFlows: 10, maxDmsPerMonth: 100 };
const active = { kind: "CUSTOMER", subscription: { status: "ACTIVE", trialEndsAt: null, graceEndsAt: null, limitOverrides: {}, plan } };

beforeEach(() => {
  vi.resetAllMocks();
  db.instagramAccount.findUnique.mockResolvedValue({ workspaceId: "w1" });
  db.workspace.findUnique.mockResolvedValue(active);
});

describe("entitlements", () => {
  it("workspace inexistente é tratado como sem plano", async () => {
    db.workspace.findUnique.mockResolvedValue(null);
    expect((await getEntitlements("w-x")).canOperate).toBe(false);
  });

  it("conta só perfis não descarregados do próprio workspace", async () => {
    db.instagramAccount.count.mockResolvedValue(1);
    await expect(assertWithinLimit("w1", "maxInstagramAccounts")).rejects.toThrow(/até 1 contas do Instagram/);
    expect(db.instagramAccount.count).toHaveBeenCalledWith({ where: { workspaceId: "w1", status: { not: "DISCONNECTED" } } });
  });

  it("workspace interno passa sem contar nada", async () => {
    db.workspace.findUnique.mockResolvedValue({ kind: "INTERNAL", subscription: null });
    await expect(assertWithinLimit("w1", "maxActiveFlows", 999)).resolves.toBeUndefined();
    expect(db.flow.count).not.toHaveBeenCalled();
  });

  it("convites pendentes ocupam vaga de membro", async () => {
    db.workspaceMember.count.mockResolvedValue(1);
    db.workspaceInvitation.count.mockResolvedValue(1);
    await expect(assertCanAddMember("w1")).rejects.toThrow(/até 2 pessoas na equipe/);
  });

  describe("sendingBlockReason (motor)", () => {
    it("libera dentro da cota do mês, contando só envios sem erro desde o dia 1", async () => {
      db.message.count.mockResolvedValue(99);
      await expect(sendingBlockReason("acc")).resolves.toBeNull();
      expect(db.message.count).toHaveBeenCalledWith({
        where: { direction: "OUT", error: null, createdAt: { gte: monthStart() }, account: { workspaceId: "w1" } },
      });
    });

    it("para ao atingir a cota de mensagens", async () => {
      db.message.count.mockResolvedValue(100);
      await expect(sendingBlockReason("acc")).resolves.toMatch(/Limite de 100 mensagens/);
    });

    it("para quando a assinatura está suspensa", async () => {
      db.workspace.findUnique.mockResolvedValue({ ...active, subscription: { ...active.subscription, status: "SUSPENDED" } });
      await expect(sendingBlockReason("acc")).resolves.toMatch(/suspensa/);
      expect(db.message.count).not.toHaveBeenCalled();
    });

    it("para quando o workspace não tem plano", async () => {
      db.workspace.findUnique.mockResolvedValue({ kind: "CUSTOMER", subscription: null });
      await expect(sendingBlockReason("acc")).resolves.toMatch(/não tem um plano/);
    });
  });

  it("monthStart é o dia 1 do mês em UTC", () => {
    expect(monthStart(new Date("2026-10-13T12:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
