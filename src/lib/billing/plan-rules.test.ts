import { describe, expect, it } from "vitest";
import { checkLimit, computeEntitlements, hasFeature, PlanLimitError, readLimitOverrides, type SubscriptionLike } from "./plan-rules";

const NOW = new Date("2026-10-13T12:00:00Z");
const past = new Date("2026-10-12T12:00:00Z");
const future = new Date("2026-10-20T12:00:00Z");

const pro = {
  name: "Pro", slug: "pro", features: ["ai", "broadcast", "recurso-inventado"],
  maxInstagramAccounts: 3, maxMembers: 5, maxActiveFlows: null, maxDmsPerMonth: 25000,
};
const sub = (overrides: Partial<SubscriptionLike> = {}): SubscriptionLike => ({
  status: "ACTIVE", trialEndsAt: null, graceEndsAt: null, limitOverrides: {}, plan: pro, ...overrides,
});
const customer = (subscription: SubscriptionLike | null) => computeEntitlements({ kind: "CUSTOMER", subscription }, NOW);

describe("computeEntitlements", () => {
  it("workspace interno não tem limite e tem todos os recursos", () => {
    const ent = computeEntitlements({ kind: "INTERNAL", subscription: null }, NOW);
    expect(ent.canOperate).toBe(true);
    expect(Object.values(ent.limits).every((v) => v === null)).toBe(true);
    expect(hasFeature(ent, "autoposter")).toBe(true);
  });

  it("cliente sem assinatura fica bloqueado (fechado por padrão)", () => {
    const ent = customer(null);
    expect(ent.canOperate).toBe(false);
    expect(ent.status).toBe("NONE");
    expect(ent.limits.maxInstagramAccounts).toBe(0);
    expect(hasFeature(ent, "ai")).toBe(false);
  });

  it("assinatura ativa usa os limites do plano e ignora recurso desconhecido", () => {
    const ent = customer(sub());
    expect(ent.canOperate).toBe(true);
    expect(ent.limits).toEqual({ maxInstagramAccounts: 3, maxMembers: 5, maxActiveFlows: null, maxDmsPerMonth: 25000 });
    expect(ent.features).toEqual(["ai", "broadcast"]);
    expect(hasFeature(ent, "autoposter")).toBe(false);
  });

  it("teste grátis dentro do prazo funciona; vencido suspende", () => {
    expect(customer(sub({ status: "TRIALING", trialEndsAt: future })).canOperate).toBe(true);
    const expired = customer(sub({ status: "TRIALING", trialEndsAt: past }));
    expect(expired.status).toBe("SUSPENDED");
    expect(expired.blockReason).toMatch(/teste grátis terminou/);
  });

  it("pagamento pendente funciona com aviso até o fim da carência", () => {
    const grace = customer(sub({ status: "PAST_DUE", graceEndsAt: future }));
    expect(grace.canOperate).toBe(true);
    expect(grace.warning).toMatch(/Pagamento pendente/);
    const over = customer(sub({ status: "PAST_DUE", graceEndsAt: past }));
    expect(over.canOperate).toBe(false);
    expect(over.blockReason).toMatch(/carência acabou/);
  });

  it("suspensa e cancelada bloqueiam e nenhum recurso vale", () => {
    for (const status of ["SUSPENDED", "CANCELED"] as const) {
      const ent = customer(sub({ status }));
      expect(ent.canOperate).toBe(false);
      expect(hasFeature(ent, "ai")).toBe(false);
    }
  });

  it("ajuste por cliente substitui o limite do plano", () => {
    const ent = customer(sub({ limitOverrides: { maxInstagramAccounts: 8, maxActiveFlows: 2 } }));
    expect(ent.limits.maxInstagramAccounts).toBe(8);
    expect(ent.limits.maxActiveFlows).toBe(2);
    expect(ent.limits.maxMembers).toBe(5);
  });
});

describe("readLimitOverrides", () => {
  it("aceita só inteiros ≥ 0 ou null em chaves conhecidas", () => {
    expect(readLimitOverrides({ maxMembers: 10, maxActiveFlows: null, maxDmsPerMonth: -1, maxInstagramAccounts: "9", outra: 1 })).toEqual({
      maxMembers: 10,
      maxActiveFlows: null,
    });
    expect(readLimitOverrides(null)).toEqual({});
    expect(readLimitOverrides([1, 2])).toEqual({});
  });
});

describe("checkLimit", () => {
  it("deixa até o limite e barra o que passa", () => {
    const ent = customer(sub());
    expect(() => checkLimit(ent, "maxInstagramAccounts", 2)).not.toThrow();
    expect(() => checkLimit(ent, "maxInstagramAccounts", 3)).toThrow(PlanLimitError);
    expect(() => checkLimit(ent, "maxInstagramAccounts", 1, 3)).toThrow(/até 3 contas do Instagram/);
  });

  it("limite null é ilimitado", () => {
    expect(() => checkLimit(customer(sub()), "maxActiveFlows", 10_000)).not.toThrow();
  });

  it("workspace bloqueado não passa nem com folga no limite", () => {
    expect(() => checkLimit(customer(null), "maxActiveFlows", 0)).toThrow(/ainda não tem um plano/);
  });
});
