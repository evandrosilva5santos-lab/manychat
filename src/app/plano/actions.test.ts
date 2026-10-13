import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, createCheckoutSession, createPortalSession } = vi.hoisted(() => ({
  redirect: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/billing/stripe-billing", () => ({ createCheckoutSession, createPortalSession }));
vi.mock("@/lib/tenancy", () => ({ getCurrentWorkspace: vi.fn(async () => ({ workspace: { id: "w1" } })) }));

import { openBillingPortal, startCheckout } from "./actions";
import { UserFacingError } from "@/lib/user-error";

const form = (planId: string) => {
  const data = new FormData();
  data.set("planId", planId);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://instachat.test/");
  createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/c/1");
  createPortalSession.mockResolvedValue("https://billing.stripe.com/p/1");
});
afterEach(() => vi.unstubAllEnvs());

describe("ações de cobrança", () => {
  it("abre o checkout do plano escolhido e volta para o APP_URL", async () => {
    await startCheckout(null, form("plan_pro"));
    expect(createCheckoutSession).toHaveBeenCalledWith("w1", "plan_pro", "https://instachat.test", "MONTHLY");
    expect(redirect).toHaveBeenCalledWith("https://checkout.stripe.com/c/1");
  });

  it("anual escolhido vai para o checkout anual; valor inventado vira mensal", async () => {
    const yearly = form("plan_pro");
    yearly.set("cycle", "YEARLY");
    await startCheckout(null, yearly);
    expect(createCheckoutSession).toHaveBeenLastCalledWith("w1", "plan_pro", "https://instachat.test", "YEARLY");
    const odd = form("plan_pro");
    odd.set("cycle", "SEMANAL");
    await startCheckout(null, odd);
    expect(createCheckoutSession).toHaveBeenLastCalledWith("w1", "plan_pro", "https://instachat.test", "MONTHLY");
  });

  it("sem APP_URL não abre cobrança nenhuma", async () => {
    vi.stubEnv("APP_URL", "");
    await expect(startCheckout(null, form("plan_pro"))).resolves.toEqual({ ok: false, message: expect.stringMatching(/APP_URL/) });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("mostra a mensagem de negócio e esconde erro interno", async () => {
    createCheckoutSession.mockRejectedValueOnce(new UserFacingError("Este plano não está disponível para assinatura."));
    await expect(startCheckout(null, form("x"))).resolves.toEqual({ ok: false, message: "Este plano não está disponível para assinatura." });
    createPortalSession.mockRejectedValueOnce(new Error("stripe caiu: sk_live_segredo"));
    const result = await openBillingPortal();
    expect(result?.message).not.toContain("sk_live");
  });

  it("portal redireciona para o Stripe", async () => {
    await openBillingPortal();
    expect(redirect).toHaveBeenCalledWith("https://billing.stripe.com/p/1");
  });
});
