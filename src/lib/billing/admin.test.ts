import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireSuperAdmin } = vi.hoisted(() => {
  const db = {
    plan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    workspace: { findUnique: vi.fn() },
    subscription: { upsert: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all(arg as unknown[]),
  );
  return { db, requireSuperAdmin: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tenancy", () => ({ requireSuperAdmin }));
vi.mock("./entitlements", () => ({ getEntitlements: vi.fn(), getUsage: vi.fn() }));

import { diffFields, getMrrCents, savePlan, setWorkspaceSubscription } from "./admin";

const admin = { id: "sa", email: "sa@x", name: "SA", role: "SUPERADMIN" };
const validPlan = {
  slug: "pro", name: "Pro", description: null, isPublic: true, isActive: true, sortOrder: 20,
  priceMonthlyCents: 19700, trialDays: 14, graceDays: 7, stripePriceId: "price_123",
  maxInstagramAccounts: 3, maxMembers: 5, maxActiveFlows: null, maxDmsPerMonth: 25000, features: ["ai"],
};

beforeEach(() => {
  vi.clearAllMocks();
  requireSuperAdmin.mockResolvedValue(admin);
  db.plan.create.mockImplementation(async ({ data }) => ({ id: "p-novo", ...data }));
  db.plan.update.mockImplementation(async ({ data }) => ({ id: "p1", ...data }));
});

describe("savePlan", () => {
  it("só o Super Admin salva planos", async () => {
    requireSuperAdmin.mockRejectedValue(new Error("Apenas o Super Admin pode executar esta ação."));
    await expect(savePlan(null, validPlan)).rejects.toThrow("Super Admin");
    expect(db.plan.create).not.toHaveBeenCalled();
  });

  it("cria o plano e a auditoria na mesma transação", async () => {
    await savePlan(null, validPlan);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "plan.create", entityId: "p-novo", actorEmail: "sa@x" }),
    });
  });

  it("na edição grava só o que mudou", async () => {
    db.plan.findUnique.mockResolvedValue({ ...validPlan, id: "p1", priceMonthlyCents: 9700 });
    await savePlan("p1", validPlan);
    const audit = db.auditLog.create.mock.calls[0][0].data;
    expect(audit.changes).toEqual({ priceMonthlyCents: { de: 9700, para: 19700 } });
  });

  it.each([
    [{ slug: "Com Espaço" }, /letras minúsculas/],
    [{ stripePriceId: "prod_123" }, /price_/],
    [{ features: ["inventado"] }, /./],
    [{ maxMembers: -1 }, /./],
  ])("recusa dados inválidos %o", async (patch, message) => {
    await expect(savePlan(null, { ...validPlan, ...patch })).rejects.toThrow(message);
    expect(db.plan.create).not.toHaveBeenCalled();
  });
});

describe("setWorkspaceSubscription", () => {
  const input = { planId: "p1", status: "ACTIVE", trialEndsAt: null, limitOverrides: { maxMembers: 10, lixo: 1 } };

  beforeEach(() => {
    db.workspace.findUnique.mockResolvedValue({ id: "w1", kind: "CUSTOMER", subscription: null });
    db.plan.findUnique.mockResolvedValue({ id: "p1" });
  });

  it("grava a assinatura com ajustes filtrados e audita junto", async () => {
    await setWorkspaceSubscription("w1", input);
    expect(db.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ workspaceId: "w1", planId: "p1", limitOverrides: { maxMembers: 10 } }) }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "subscription.set", workspaceId: "w1" }) });
  });

  it("workspace interno não recebe plano", async () => {
    db.workspace.findUnique.mockResolvedValue({ id: "w1", kind: "INTERNAL", subscription: null });
    await expect(setWorkspaceSubscription("w1", input)).rejects.toThrow("interno");
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it("status inventado é recusado", async () => {
    await expect(setWorkspaceSubscription("w1", { ...input, status: "GRATIS" })).rejects.toThrow();
  });
});

describe("relatórios", () => {
  it("MRR soma só clientes ativos ou em carência", async () => {
    db.subscription.findMany.mockResolvedValue([{ plan: { priceMonthlyCents: 19700 } }, { plan: { priceMonthlyCents: 9700 } }]);
    await expect(getMrrCents()).resolves.toBe(29400);
    expect(db.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["ACTIVE", "PAST_DUE"] }, workspace: { kind: "CUSTOMER" } } }),
    );
  });

  it("diffFields ignora o que não mudou", () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: { de: 2, para: 3 } });
    expect(diffFields(null, { a: 1 })).toEqual({ a: { de: null, para: 1 } });
  });
});
