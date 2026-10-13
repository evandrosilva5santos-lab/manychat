// Filtros do console do Super Admin lidos da URL (searchParams). Puro, para testar.
import { BILLING_MODES, PAYMENT_METHODS, type BillingMode, type PaymentMethod } from "@/lib/billing/billing-cycle";
import type { SubscriptionStatus } from "@/lib/billing/plan-rules";

export const PAGE_SIZE = 50;
const STATUSES: readonly SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED"];

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function readPage(params: Params): number {
  const page = Number.parseInt(first(params, "pagina"), 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

export type ClientFilters = { q: string; status: SubscriptionStatus | "NONE" | null; planId: string | null; mode: BillingMode | null; kind: "CUSTOMER" | "INTERNAL" | null };

export function readClientFilters(params: Params): ClientFilters {
  const status = first(params, "status");
  const kind = first(params, "tipo");
  return {
    q: first(params, "q").slice(0, 100),
    status: status === "NONE" ? "NONE" : oneOf(status, STATUSES),
    planId: first(params, "plano").slice(0, 40) || null,
    mode: oneOf(first(params, "cobranca"), BILLING_MODES),
    kind: kind === "interno" ? "INTERNAL" : kind === "cliente" ? "CUSTOMER" : null,
  };
}

export type PaymentFilters = { method: PaymentMethod | null; source: "manual" | "stripe" | null; from: Date | null; to: Date | null };

function day(value: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function readPaymentFilters(params: Params): PaymentFilters {
  const source = first(params, "origem");
  return {
    method: oneOf(first(params, "metodo"), PAYMENT_METHODS),
    source: source === "manual" || source === "stripe" ? source : null,
    from: day(first(params, "de"), false),
    to: day(first(params, "ate"), true),
  };
}

export type AuditFilters = { workspaceId: string | null; action: string | null };

export function readAuditFilters(params: Params): AuditFilters {
  const action = first(params, "acao");
  return {
    workspaceId: first(params, "cliente").slice(0, 40) || null,
    action: /^[a-z_.]{1,60}$/.test(action) ? action : null,
  };
}

/** Início do mês e do ano no horário de Brasília (UTC-3), para os totais recebidos. */
export function periodStarts(now: Date): { month: Date; year: Date } {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const year = local.getUTCFullYear();
  return {
    month: new Date(Date.UTC(year, local.getUTCMonth(), 1, 3)),
    year: new Date(Date.UTC(year, 0, 1, 3)),
  };
}

/** Monta a query string mantendo os filtros e trocando só o que mudou. */
export function withParams(base: Params, changes: Record<string, string | number | null>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) next.set(key, single);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}
