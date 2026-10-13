import { describe, expect, it } from "vitest";
import { periodStarts, readAuditFilters, readClientFilters, readPage, readPaymentFilters, withParams } from "./filters";

describe("filtros do console", () => {
  it("clientes: aceita só valores conhecidos", () => {
    expect(readClientFilters({ q: " ana ", status: "ACTIVE", cobranca: "MANUAL", plano: "plan_pro", tipo: "cliente" })).toEqual({
      q: "ana", status: "ACTIVE", planId: "plan_pro", mode: "MANUAL", kind: "CUSTOMER",
    });
    expect(readClientFilters({ status: "HACK", cobranca: "x" })).toMatchObject({ status: null, mode: null, kind: null, planId: null });
    expect(readClientFilters({ status: "NONE" }).status).toBe("NONE");
  });

  it("pagamentos: método, origem e período em horário de Brasília", () => {
    const filters = readPaymentFilters({ metodo: "PIX", origem: "manual", de: "2026-10-01", ate: "2026-10-31" });
    expect(filters.method).toBe("PIX");
    expect(filters.source).toBe("manual");
    expect(filters.from?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(filters.to?.toISOString()).toBe("2026-11-01T02:59:59.999Z");
    expect(readPaymentFilters({ metodo: "BITCOIN", de: "ontem" })).toMatchObject({ method: null, from: null });
  });

  it("auditoria: ação só com letras, ponto e sublinhado", () => {
    expect(readAuditFilters({ acao: "payment.record", cliente: "w1" })).toEqual({ action: "payment.record", workspaceId: "w1" });
    expect(readAuditFilters({ acao: "drop table" }).action).toBeNull();
  });

  it("página inválida volta para 1", () => {
    expect(readPage({ pagina: "3" })).toBe(3);
    expect(readPage({ pagina: "-1" })).toBe(1);
    expect(readPage({})).toBe(1);
  });

  it("início do mês e do ano no fuso de Brasília", () => {
    const { month, year } = periodStarts(new Date("2026-11-01T01:00:00Z")); // ainda 31/10 em Brasília
    expect(month.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(year.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("withParams mantém os filtros e troca a página", () => {
    expect(withParams({ status: "ACTIVE", pagina: "2" }, { pagina: 3 })).toBe("?status=ACTIVE&pagina=3");
    expect(withParams({ status: "ACTIVE" }, { status: null })).toBe("");
  });
});
