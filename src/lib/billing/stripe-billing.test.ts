import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { db, stripe, requireWorkspaceRole } = vi.hoisted(() => {
  const db = {
    billingEvent: { findUnique: vi.fn(), create: vi.fn() },
    plan: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  return {
    db,
    requireWorkspaceRole: vi.fn(),
    stripe: {
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
      subscriptions: { retrieve: vi.fn() },
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/stripe/client", () => ({ getStripeClient: () => stripe }));
vi.mock("@/lib/tenancy", () => ({ requireWorkspaceRole }));

import { applyStripeEvent, createCheckoutSession, createPortalSession, mapStripeStatus } from "./stripe-billing";

const NOW = new Date("2026-10-13T12:00:00Z");
const plan = { id: "plan_pro", isActive: true, stripePriceId: "price_pro", graceDays: 7 };
const stripeSub = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { workspaceId: "w1" },
  cancel_at_period_end: false,
  trial_end: null,
  items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_793_000_000 }] },
  ...overrides,
});
const event = (type: string, object: unknown, id = "evt_1") => ({ id, type, data: { object } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspaceRole.mockResolvedValue({ actor: { email: "dono@loja.com" }, role: "OWNER" });
  db.billingEvent.findUnique.mockResolvedValue(null);
  db.plan.findUnique.mockResolvedValue(plan);
  db.subscription.findUnique.mockResolvedValue(null);
  stripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/c/1" });
  stripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.com/p/1" });
});

describe("mapStripeStatus", () => {
  it.each([
    ["trialing", "TRIALING"],
    ["active", "ACTIVE"],
    ["past_due", "PAST_DUE"],
    ["unpaid", "SUSPENDED"],
    ["paused", "SUSPENDED"],
    ["canceled", "CANCELED"],
    ["incomplete", null],
    ["incomplete_expired", null],
  ])("%s → %s", (input, expected) => {
    expect(mapStripeStatus(input as never)).toBe(expected);
  });
});

describe("checkout e portal", () => {
  it("só o dono abre o checkout, com o workspace na metadata", async () => {
    await expect(createCheckoutSession("w1", "plan_pro", "https://app.test")).resolves.toBe("https://checkout.stripe.com/c/1");
    expect(requireWorkspaceRole).toHaveBeenCalledWith("w1", ["OWNER"]);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
        client_reference_id: "w1",
        customer_email: "dono@loja.com",
        subscription_data: { metadata: { workspaceId: "w1", planId: "plan_pro" } },
        success_url: "https://app.test/plano?checkout=ok",
      }),
    );
  });

  it("plano sem preço no Stripe ou inativo não vai ao checkout", async () => {
    db.plan.findUnique.mockResolvedValue({ ...plan, stripePriceId: null });
    await expect(createCheckoutSession("w1", "plan_pro", "https://app.test")).rejects.toThrow("não está disponível");
    db.plan.findUnique.mockResolvedValue({ ...plan, isActive: false });
    await expect(createCheckoutSession("w1", "plan_pro", "https://app.test")).rejects.toThrow("não está disponível");
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("quem já assina troca de plano pelo portal, não por um segundo checkout", async () => {
    db.subscription.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub_1", status: "ACTIVE", stripeCustomerId: "cus_1" });
    await expect(createCheckoutSession("w1", "plan_pro", "https://app.test")).rejects.toThrow("Gerenciar pagamento");
  });

  it("portal exige cliente no Stripe", async () => {
    await expect(createPortalSession("w1", "https://app.test")).rejects.toThrow("Ainda não há pagamento");
    db.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
    await expect(createPortalSession("w1", "https://app.test")).resolves.toBe("https://billing.stripe.com/p/1");
  });
});

describe("applyStripeEvent", () => {
  it("assinatura ativa vira ACTIVE no plano do preço, com fim do período dos itens", async () => {
    await expect(applyStripeEvent(event("customer.subscription.updated", stripeSub()), NOW)).resolves.toBe("applied");
    expect(db.billingEvent.create).toHaveBeenCalledWith({ data: { id: "evt_1", type: "customer.subscription.updated" } });
    expect(db.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "w1" },
        update: expect.objectContaining({
          planId: "plan_pro",
          status: "ACTIVE",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "cus_1",
          currentPeriodEnd: new Date(1_793_000_000 * 1000),
          graceEndsAt: null,
          isComplimentary: false,
          complimentaryUntil: null,
        }),
      }),
    );
  });

  it("evento repetido não é aplicado de novo", async () => {
    db.billingEvent.findUnique.mockResolvedValue({ id: "evt_1" });
    await expect(applyStripeEvent(event("customer.subscription.updated", stripeSub()), NOW)).resolves.toBe("duplicate");
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it("dois envios simultâneos: o segundo bate na chave e vira duplicado", async () => {
    db.billingEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
    );
    await expect(applyStripeEvent(event("customer.subscription.updated", stripeSub()), NOW)).resolves.toBe("duplicate");
  });

  it("atraso abre a carência pelos dias do plano, e ela não se renova a cada evento", async () => {
    await applyStripeEvent(event("customer.subscription.updated", stripeSub({ status: "past_due" })), NOW);
    expect(db.subscription.upsert.mock.calls[0][0].update.graceEndsAt).toEqual(new Date("2026-10-20T12:00:00Z"));

    const firstGrace = new Date("2026-10-15T00:00:00Z");
    db.subscription.findUnique.mockResolvedValue({ status: "PAST_DUE", graceEndsAt: firstGrace });
    await applyStripeEvent(event("customer.subscription.updated", stripeSub({ status: "past_due" }), "evt_2"), NOW);
    expect(db.subscription.upsert.mock.calls[1][0].update.graceEndsAt).toEqual(firstGrace);
  });

  it("checkout concluído busca a assinatura no Stripe", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub());
    await applyStripeEvent(event("checkout.session.completed", { subscription: "sub_1" }), NOW);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(db.subscription.upsert).toHaveBeenCalled();
  });

  it("checkout ainda não pago (incomplete) não ativa nada, mas registra o evento", async () => {
    await expect(applyStripeEvent(event("customer.subscription.created", stripeSub({ status: "incomplete" })), NOW)).resolves.toBe("ignored");
    expect(db.subscription.upsert).not.toHaveBeenCalled();
    expect(db.billingEvent.create).toHaveBeenCalled();
  });

  it("preço sem plano cadastrado não grava assinatura", async () => {
    db.plan.findUnique.mockResolvedValue(null);
    await expect(applyStripeEvent(event("customer.subscription.updated", stripeSub()), NOW)).resolves.toBe("ignored");
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it("sem metadata, acha o workspace pelo ID já gravado", async () => {
    db.subscription.findFirst.mockResolvedValue({ workspaceId: "w9" });
    await applyStripeEvent(event("customer.subscription.updated", stripeSub({ metadata: {} })), NOW);
    expect(db.subscription.upsert.mock.calls[0][0].where).toEqual({ workspaceId: "w9" });
  });

  it("cancelamento vira CANCELED", async () => {
    await applyStripeEvent(event("customer.subscription.deleted", stripeSub({ status: "canceled" })), NOW);
    expect(db.subscription.upsert.mock.calls[0][0].update.status).toBe("CANCELED");
  });

  it("eventos que não mexem em assinatura só são registrados", async () => {
    await expect(applyStripeEvent(event("invoice.paid", {}), NOW)).resolves.toBe("ignored");
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });
});
