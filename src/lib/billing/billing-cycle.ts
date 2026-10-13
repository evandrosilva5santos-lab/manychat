// Regras puras de ciclo, preço e forma de cobrança (ADR-009). Sem banco, para testar todos os casos.

export const BILLING_MODES = ["STRIPE", "MANUAL", "COMPLIMENTARY"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];
export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export const PAYMENT_METHODS = ["CARD", "PIX", "BOLETO", "TRANSFER", "CASH", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BILLING_MODE_LABEL: Record<BillingMode, string> = {
  STRIPE: "Cartão (Stripe)",
  MANUAL: "Manual (Pix, boleto ou transferência)",
  COMPLIMENTARY: "Cortesia",
};
export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = { MONTHLY: "Mensal", YEARLY: "Anual" };
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CARD: "Cartão",
  PIX: "Pix",
  BOLETO: "Boleto",
  TRANSFER: "Transferência",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

/** Soma meses de calendário (31/01 + 1 mês = último dia de fevereiro). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function monthsIn(cycle: BillingCycle): number {
  return cycle === "YEARLY" ? 12 : 1;
}

type PlanPrice = { priceMonthlyCents: number; priceYearlyCents: number | null };

/** Preço cobrado por ciclo. Sem preço anual cadastrado, o anual vale 12 mensalidades. */
export function priceFor(plan: PlanPrice, cycle: BillingCycle): number {
  if (cycle === "MONTHLY") return plan.priceMonthlyCents;
  return plan.priceYearlyCents ?? plan.priceMonthlyCents * 12;
}

/** Quanto a assinatura soma ao MRR (anual dividido por 12). */
export function monthlyRevenueCents(plan: PlanPrice, cycle: BillingCycle): number {
  return Math.round(priceFor(plan, cycle) / monthsIn(cycle));
}

/** Desconto do anual sobre 12 mensalidades, em % inteiro (0 quando não há desconto). */
export function yearlyDiscountPercent(plan: PlanPrice): number {
  const full = plan.priceMonthlyCents * 12;
  if (!plan.priceYearlyCents || full <= 0 || plan.priceYearlyCents >= full) return 0;
  return Math.round((1 - plan.priceYearlyCents / full) * 100);
}

/**
 * Período que um pagamento cobre. Se ainda há período pago à frente, o novo
 * começa onde o atual termina (pagar adiantado não perde dias).
 */
export function coveredPeriod(cycle: BillingCycle, paidAt: Date, currentPeriodEnd: Date | null) {
  const start = currentPeriodEnd && currentPeriodEnd > paidAt ? currentPeriodEnd : paidAt;
  return { start, end: addMonths(start, monthsIn(cycle)) };
}

export type ComplimentaryChoice = "keep" | "none" | "1" | "3" | "6" | "9" | "indefinite";

/**
 * Concilia a forma de cobrança escolhida com a opção de cortesia:
 * escolher prazo de cortesia vira COMPLIMENTARY; sair de COMPLIMENTARY encerra a cortesia;
 * escolher COMPLIMENTARY sem prazo, quando ainda não há cortesia, vale por tempo indeterminado.
 */
export function reconcileBilling(
  mode: BillingMode,
  complimentary: ComplimentaryChoice,
  currentlyComplimentary: boolean,
): { mode: BillingMode; complimentary: ComplimentaryChoice } {
  if (complimentary !== "keep" && complimentary !== "none") return { mode: "COMPLIMENTARY", complimentary };
  if (mode === "COMPLIMENTARY") {
    if (complimentary === "none") return { mode: "MANUAL", complimentary: "none" };
    return { mode, complimentary: currentlyComplimentary ? "keep" : "indefinite" };
  }
  return { mode, complimentary: currentlyComplimentary ? "none" : complimentary };
}

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  INTERNAL: "Operação interna",
  NONE: "Sem plano",
  TRIALING: "Teste grátis",
  ACTIVE: "Ativo",
  PAST_DUE: "Pagamento pendente",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

export function formatCents(cents: number, currency = "BRL"): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: currency.toUpperCase() });
}

export function formatDay(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}
