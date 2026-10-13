// Regras puras de plano (ADR-008): sem banco, para testar todos os casos.
// Fechado por padrão: sem assinatura, recurso fora da lista ou status bloqueado = não pode.
import { UserFacingError } from "@/lib/user-error";

export const LIMIT_KEYS = ["maxInstagramAccounts", "maxMembers", "maxActiveFlows", "maxDmsPerMonth"] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export type Limits = Record<LimitKey, number | null>;

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxInstagramAccounts: "contas do Instagram",
  maxMembers: "pessoas na equipe",
  maxActiveFlows: "automações ativas",
  maxDmsPerMonth: "mensagens enviadas no mês",
};

/** Recursos que um plano pode liberar. Chave fora desta lista é ignorada. */
export const FEATURES = {
  ai: "Agentes de IA",
  broadcast: "Transmissão",
  autoposter: "Autoposter",
} as const;
export type FeatureKey = keyof typeof FEATURES;

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

export type PlanLike = { name: string; slug: string; features: string[]; graceDays?: number } & Limits;

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  limitOverrides: unknown;
  isComplimentary?: boolean;
  complimentaryUntil?: Date | null;
  /** Cobrança manual (Pix, boleto…): vence no fim do período pago. */
  billingMode?: "STRIPE" | "MANUAL" | "COMPLIMENTARY";
  currentPeriodEnd?: Date | null;
  plan: PlanLike;
};

const DAY_MS = 86_400_000;

/** Cobrança manual com o período pago vencido: carência (PAST_DUE) e depois suspensão. */
function manualStatus(sub: SubscriptionLike, now: Date): SubscriptionStatus | null {
  if (sub.billingMode !== "MANUAL" || sub.status !== "ACTIVE" || !sub.currentPeriodEnd || sub.currentPeriodEnd > now) return null;
  const graceEnd = sub.currentPeriodEnd.getTime() + (sub.plan.graceDays ?? 7) * DAY_MS;
  return now.getTime() < graceEnd ? "PAST_DUE" : "SUSPENDED";
}

export type Entitlements = {
  kind: "CUSTOMER" | "INTERNAL";
  planName: string | null;
  planSlug: string | null;
  /** Status depois de aplicar as datas (teste e carência vencidos viram SUSPENDED). */
  status: SubscriptionStatus | "INTERNAL" | "NONE";
  canOperate: boolean;
  /** Motivo do bloqueio, escrito para o cliente. */
  blockReason: string | null;
  /** Aviso sem bloqueio (ex.: pagamento pendente dentro da carência). */
  warning: string | null;
  /** Cortesia ativa ou vencida: `until` nulo = por tempo indeterminado. */
  complimentary: { until: Date | null } | null;
  limits: Limits;
  features: FeatureKey[];
};

export class PlanLimitError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

const UNLIMITED: Limits = { maxInstagramAccounts: null, maxMembers: null, maxActiveFlows: null, maxDmsPerMonth: null };
const NOTHING: Limits = { maxInstagramAccounts: 0, maxMembers: 0, maxActiveFlows: 0, maxDmsPerMonth: 0 };
const ALL_FEATURES = Object.keys(FEATURES) as FeatureKey[];

export const NO_PLAN_REASON = "Este workspace ainda não tem um plano. Escolha um plano em Plano e cobrança.";

/** Só aceita ajustes conhecidos: inteiro ≥ 0 ou `null` (ilimitado). Qualquer outra coisa é ignorada. */
export function readLimitOverrides(raw: unknown): Partial<Limits> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Limits> = {};
  for (const key of LIMIT_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === null || (Number.isInteger(value) && (value as number) >= 0)) out[key] = value as number | null;
  }
  return out;
}

function complimentaryExpired(sub: SubscriptionLike, now: Date): boolean {
  return Boolean(sub.isComplimentary && sub.complimentaryUntil && sub.complimentaryUntil <= now);
}

function effectiveStatus(sub: SubscriptionLike, now: Date): SubscriptionStatus {
  // Cortesia manda no status: vale ativa até a data (ou para sempre) e suspende ao vencer.
  if (sub.isComplimentary) return complimentaryExpired(sub, now) ? "SUSPENDED" : "ACTIVE";
  const manual = manualStatus(sub, now);
  if (manual) return manual;
  if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt <= now) return "SUSPENDED";
  if (sub.status === "PAST_DUE" && sub.graceEndsAt && sub.graceEndsAt <= now) return "SUSPENDED";
  return sub.status;
}

function blockReasonFor(sub: SubscriptionLike, status: SubscriptionStatus, now: Date): string | null {
  const original = sub.status;
  if (complimentaryExpired(sub, now)) return "O período de cortesia terminou. Escolha um plano para continuar com as automações.";
  if (status === "CANCELED") return "A assinatura foi cancelada. Escolha um plano para voltar a usar as automações.";
  if (status !== "SUSPENDED") return null;
  if (original === "TRIALING") return "O teste grátis terminou. Escolha um plano para continuar com as automações.";
  if (original === "PAST_DUE") return "O pagamento não foi confirmado e a carência acabou. Atualize o pagamento para reativar.";
  if (sub.billingMode === "MANUAL") return "O período pago venceu e a carência acabou. Fale com a Start Inc. para registrar o pagamento.";
  return "A assinatura está suspensa. Fale com o suporte ou atualize o pagamento.";
}

function pastDueWarning(sub: SubscriptionLike): string {
  if (sub.billingMode !== "MANUAL" || !sub.currentPeriodEnd) {
    return "Pagamento pendente. Atualize a forma de pagamento para não ter as automações pausadas.";
  }
  const limit = new Date(sub.currentPeriodEnd.getTime() + (sub.plan.graceDays ?? 7) * DAY_MS);
  return `Pagamento pendente. As automações pausam em ${limit.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} se o pagamento não for registrado.`;
}

export function computeEntitlements(
  workspace: { kind: "CUSTOMER" | "INTERNAL"; subscription: SubscriptionLike | null },
  now = new Date(),
): Entitlements {
  if (workspace.kind === "INTERNAL") {
    return {
      kind: "INTERNAL", planName: null, planSlug: null, status: "INTERNAL", canOperate: true,
      blockReason: null, warning: null, complimentary: null, limits: UNLIMITED, features: ALL_FEATURES,
    };
  }
  const sub = workspace.subscription;
  if (!sub) {
    return {
      kind: "CUSTOMER", planName: null, planSlug: null, status: "NONE", canOperate: false,
      blockReason: NO_PLAN_REASON, warning: null, complimentary: null, limits: NOTHING, features: [],
    };
  }
  const status = effectiveStatus(sub, now);
  const blockReason = blockReasonFor(sub, status, now);
  const planLimits = Object.fromEntries(LIMIT_KEYS.map((key) => [key, sub.plan[key]])) as Limits;
  return {
    kind: "CUSTOMER",
    planName: sub.plan.name,
    planSlug: sub.plan.slug,
    status,
    canOperate: blockReason === null,
    blockReason,
    warning: status === "PAST_DUE" ? pastDueWarning(sub) : null,
    complimentary: sub.isComplimentary ? { until: sub.complimentaryUntil ?? null } : null,
    limits: { ...planLimits, ...readLimitOverrides(sub.limitOverrides) },
    features: sub.plan.features.filter((key): key is FeatureKey => key in FEATURES),
  };
}

/** Lança `PlanLimitError` se somar `adding` ao uso atual passar do limite. */
export function checkLimit(entitlements: Entitlements, key: LimitKey, current: number, adding = 1): void {
  if (!entitlements.canOperate) throw new PlanLimitError(entitlements.blockReason ?? NO_PLAN_REASON);
  const limit = entitlements.limits[key];
  if (limit !== null && current + adding > limit) {
    throw new PlanLimitError(
      `Seu plano permite até ${limit} ${LIMIT_LABELS[key]}. Faça upgrade em Plano e cobrança para liberar mais.`,
    );
  }
}

export function hasFeature(entitlements: Entitlements, feature: FeatureKey): boolean {
  return entitlements.canOperate && entitlements.features.includes(feature);
}
