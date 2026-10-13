import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireSuperAdmin } = vi.hoisted(() => {
  const db = {
    plan: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    workspace: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  return { db, requireSuperAdmin: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tenancy", () => ({ requireSuperAdmin }));

import { verifyPassword } from "@/lib/auth/password";
import { createClient, initialSubscription } from "./console";

const NOW = new Date("2026-10-13T12:00:00Z");
const input = {
  workspaceName: "Clínica", ownerName: "Ana", ownerEmail: "Ana@Clinica.com", password: "senha-forte-1",
  planId: "plan_pro", billingMode: "MANUAL", billingCycle: "MONTHLY", trialDays: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireSuperAdmin.mockResolvedValue({ id: "sa", email: "sa@x" });
  db.plan.findUnique.mockResolvedValue({ id: "plan_pro" });
  db.user.findUnique.mockResolvedValue(null);
  db.user.create.mockResolvedValue({ id: "u1" });
  db.workspace.create.mockResolvedValue({ id: "w1" });
});

describe("initialSubscription", () => {
  it("teste grátis, cortesia e manual vencendo hoje (dentro da carência)", () => {
    expect(initialSubscription({ billingMode: "MANUAL", trialDays: 14 }, NOW)).toEqual({ status: "TRIALING", trialEndsAt: new Date("2026-10-27T12:00:00Z") });
    expect(initialSubscription({ billingMode: "COMPLIMENTARY", trialDays: 0 }, NOW)).toMatchObject({ status: "ACTIVE", isComplimentary: true });
    expect(initialSubscription({ billingMode: "MANUAL", trialDays: 0 }, NOW)).toEqual({ status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: NOW });
  });
});

describe("createClient", () => {
  it("cria dono com senha (hash), workspace, assinatura e auditoria sem a senha", async () => {
    await expect(createClient(input, NOW)).resolves.toEqual({ workspaceId: "w1", email: "ana@clinica.com" });
    const user = db.user.create.mock.calls[0][0].data;
    expect(await verifyPassword("senha-forte-1", user.passwordHash)).toBe(true);
    const workspace = db.workspace.create.mock.calls[0][0].data;
    expect(workspace).toMatchObject({ kind: "CUSTOMER", ownerId: "u1", members: { create: { userId: "u1", role: "OWNER" } } });
    expect(workspace.subscription.create).toMatchObject({ planId: "plan_pro", billingMode: "MANUAL", billingCycle: "MONTHLY", status: "ACTIVE" });
    expect(JSON.stringify(db.auditLog.create.mock.calls[0][0])).not.toContain("senha-forte-1");
  });

  it("recusa e-mail que já é dono, e-mail do Super Admin, cartão sem teste e senha curta", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u9", role: "CLIENT", _count: { workspacesOwned: 1 } });
    await expect(createClient(input, NOW)).rejects.toThrow("já é dono");
    db.user.findUnique.mockResolvedValue({ id: "sa", role: "SUPERADMIN", _count: { workspacesOwned: 1 } });
    await expect(createClient(input, NOW)).rejects.toThrow("Super Admin");
    db.user.findUnique.mockResolvedValue(null);
    await expect(createClient({ ...input, billingMode: "STRIPE" }, NOW)).rejects.toThrow("dias de teste");
    await expect(createClient({ ...input, password: "curta" }, NOW)).rejects.toThrow("8");
    expect(db.workspace.create).not.toHaveBeenCalled();
  });

  it("só o Super Admin cria cliente", async () => {
    requireSuperAdmin.mockRejectedValue(new Error("Apenas o Super Admin"));
    await expect(createClient(input, NOW)).rejects.toThrow("Super Admin");
  });
});
