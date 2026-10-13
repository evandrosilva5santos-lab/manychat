import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireSuperAdmin } = vi.hoisted(() => {
  const db = {
    subscription: { findUnique: vi.fn(), update: vi.fn() },
    subscriptionPayment: { create: vi.fn(), findMany: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    userSession: { deleteMany: vi.fn() },
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

import { recordManualPayment, resetMemberPassword } from "./payments";

const NOW = new Date("2026-10-13T12:00:00Z");
const input = { amountCents: 19700, method: "PIX", paidAt: "2026-10-13T12:00:00Z", cycle: "MONTHLY", reference: "pix-123", notes: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireSuperAdmin.mockResolvedValue({ id: "sa", email: "sa@x" });
  db.subscription.findUnique.mockResolvedValue({ id: "s1", billingMode: "STRIPE", stripeSubscriptionId: null, currentPeriodEnd: null });
  db.subscriptionPayment.create.mockResolvedValue({ id: "pay1" });
});

describe("recordManualPayment", () => {
  it("grava o pagamento, ativa até o fim do período e audita na mesma transação", async () => {
    await recordManualPayment("w1", input, NOW);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.subscriptionPayment.create.mock.calls[0][0].data).toMatchObject({ amountCents: 19700, method: "PIX", source: "manual", recordedById: "sa" });
    expect(db.subscription.update.mock.calls[0][0].data).toMatchObject({
      status: "ACTIVE", currentPeriodEnd: new Date("2026-11-13T12:00:00Z"), graceEndsAt: null, billingMode: "MANUAL",
    });
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "payment.record", workspaceId: "w1" });
  });

  it("quem já assina pelo Stripe continua como Stripe", async () => {
    db.subscription.findUnique.mockResolvedValue({ id: "s1", billingMode: "STRIPE", stripeSubscriptionId: "sub_1", currentPeriodEnd: null });
    await recordManualPayment("w1", input, NOW);
    expect(db.subscription.update.mock.calls[0][0].data.billingMode).toBe("STRIPE");
  });

  it("recusa valor zerado, data futura e cliente sem plano", async () => {
    await expect(recordManualPayment("w1", { ...input, amountCents: 0 }, NOW)).rejects.toThrow("valor");
    await expect(recordManualPayment("w1", { ...input, paidAt: "2026-12-01T00:00:00Z" }, NOW)).rejects.toThrow("futuro");
    db.subscription.findUnique.mockResolvedValue(null);
    await expect(recordManualPayment("w1", input, NOW)).rejects.toThrow("plano");
    expect(db.subscriptionPayment.create).not.toHaveBeenCalled();
  });

  it("só o Super Admin registra", async () => {
    requireSuperAdmin.mockRejectedValue(new Error("Apenas o Super Admin"));
    await expect(recordManualPayment("w1", input, NOW)).rejects.toThrow("Super Admin");
  });
});

describe("resetMemberPassword", () => {
  it("troca o hash, derruba as sessões e audita sem gravar a senha", async () => {
    db.workspaceMember.findUnique.mockResolvedValue({ user: { email: "ana@x.com", role: "CLIENT" } });
    await resetMemberPassword("w1", "u1", "nova-senha-123");
    expect(db.user.update.mock.calls[0][0].data.passwordHash).toMatch(/^scrypt\$/);
    expect(db.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(JSON.stringify(db.auditLog.create.mock.calls[0][0])).not.toContain("nova-senha-123");
  });

  it("recusa senha curta, quem não é do cliente e o Super Admin", async () => {
    await expect(resetMemberPassword("w1", "u1", "curta")).rejects.toThrow("8");
    db.workspaceMember.findUnique.mockResolvedValue(null);
    await expect(resetMemberPassword("w1", "u1", "nova-senha-123")).rejects.toThrow("não faz parte");
    db.workspaceMember.findUnique.mockResolvedValue({ user: { email: "sa@x", role: "SUPERADMIN" } });
    await expect(resetMemberPassword("w1", "u1", "nova-senha-123")).rejects.toThrow("Super Admin");
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
