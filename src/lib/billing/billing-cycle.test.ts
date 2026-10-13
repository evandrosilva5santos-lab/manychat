import { describe, expect, it } from "vitest";
import { coveredPeriod, monthlyRevenueCents, priceFor, reconcileBilling, yearlyDiscountPercent } from "./billing-cycle";

const pro = { priceMonthlyCents: 19700, priceYearlyCents: 197000 };
const onlyMonthly = { priceMonthlyCents: 9700, priceYearlyCents: null };

describe("preço por ciclo", () => {
  it("mensal usa o preço mensal; anual usa o anual cadastrado", () => {
    expect(priceFor(pro, "MONTHLY")).toBe(19700);
    expect(priceFor(pro, "YEARLY")).toBe(197000);
  });

  it("sem preço anual, o anual vale 12 mensalidades e não tem desconto", () => {
    expect(priceFor(onlyMonthly, "YEARLY")).toBe(116400);
    expect(yearlyDiscountPercent(onlyMonthly)).toBe(0);
  });

  it("desconto do anual sobre 12 mensalidades", () => {
    expect(yearlyDiscountPercent(pro)).toBe(17);
  });

  it("MRR do anual é 1/12", () => {
    expect(monthlyRevenueCents(pro, "YEARLY")).toBe(16417);
    expect(monthlyRevenueCents(pro, "MONTHLY")).toBe(19700);
  });
});

describe("período coberto por um pagamento", () => {
  const paidAt = new Date("2026-01-31T10:00:00Z");

  it("sem período em aberto, começa no dia do pagamento", () => {
    expect(coveredPeriod("MONTHLY", paidAt, null)).toEqual({ start: paidAt, end: new Date("2026-02-28T10:00:00Z") });
  });

  it("pagamento adiantado continua de onde o período atual termina", () => {
    const currentEnd = new Date("2026-02-15T00:00:00Z");
    expect(coveredPeriod("YEARLY", paidAt, currentEnd)).toEqual({ start: currentEnd, end: new Date("2027-02-15T00:00:00Z") });
  });

  it("período vencido não é aproveitado", () => {
    const expired = new Date("2026-01-01T00:00:00Z");
    expect(coveredPeriod("MONTHLY", paidAt, expired).start).toEqual(paidAt);
  });
});

describe("forma de cobrança × cortesia", () => {
  it("escolher prazo de cortesia vira cobrança COMPLIMENTARY", () => {
    expect(reconcileBilling("MANUAL", "3", false)).toEqual({ mode: "COMPLIMENTARY", complimentary: "3" });
  });

  it("COMPLIMENTARY sem prazo vale por tempo indeterminado; se já é cortesia, mantém", () => {
    expect(reconcileBilling("COMPLIMENTARY", "keep", false)).toEqual({ mode: "COMPLIMENTARY", complimentary: "indefinite" });
    expect(reconcileBilling("COMPLIMENTARY", "keep", true)).toEqual({ mode: "COMPLIMENTARY", complimentary: "keep" });
  });

  it("sair da cortesia encerra a cortesia", () => {
    expect(reconcileBilling("STRIPE", "keep", true)).toEqual({ mode: "STRIPE", complimentary: "none" });
    expect(reconcileBilling("COMPLIMENTARY", "none", true)).toEqual({ mode: "MANUAL", complimentary: "none" });
  });

  it("sem cortesia, nada muda", () => {
    expect(reconcileBilling("MANUAL", "keep", false)).toEqual({ mode: "MANUAL", complimentary: "keep" });
  });
});
