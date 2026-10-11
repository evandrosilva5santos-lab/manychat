import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({ webhooks: { constructEvent } }),
}));

import { POST } from "./route";

const post = (headers: Record<string, string>, body = '{"id":"evt_1","type":"checkout.session.completed"}') =>
  POST(new Request("http://localhost/api/webhook/stripe", { method: "POST", headers, body }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
});

describe("POST /api/webhook/stripe", () => {
  it("responde 500 quando o Stripe não está configurado", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await post({ "stripe-signature": "t=1,v1=x" });
    expect(res.status).toBe(500);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("responde 400 sem o header stripe-signature", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("responde 400 quando a assinatura não confere", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("assinatura inválida");
    });
    const res = await post({ "stripe-signature": "t=1,v1=errado" });
    expect(res.status).toBe(400);
  });

  it("verifica o corpo bruto com o segredo e confirma recebimento", async () => {
    constructEvent.mockReturnValue({ id: "evt_1", type: "checkout.session.completed" });
    const res = await post({ "stripe-signature": "t=1,v1=ok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_1","type":"checkout.session.completed"}',
      "t=1,v1=ok",
      "whsec_test"
    );
  });

  it("responde 200 para tipos de evento ainda não tratados", async () => {
    constructEvent.mockReturnValue({ id: "evt_2", type: "invoice.paid" });
    const res = await post({ "stripe-signature": "t=1,v1=ok" }, '{"id":"evt_2"}');
    expect(res.status).toBe(200);
  });
});
