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

export type PlanLike = { name: string; slug: string; features: string[] } & Limits;

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  limitOverrides: unknown;
  plan: PlanLike;
};

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

function effectiveStatus(sub: SubscriptionLike, now: Date): SubscriptionStatus {
  if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt <= now) return "SUSPENDED";
  if (sub.status === "PAST_DUE" && sub.graceEndsAt && sub.graceEndsAt <= now) return "SUSPENDED";
  return sub.status;
}

function blockReasonFor(original: SubscriptionStatus, status: SubscriptionStatus): string | null {
  if (status === "CANCELED") return "A assinatura foi cancelada. Escolha um plano para voltar a usar as automações.";
  if (status !== "SUSPENDED") return null;
  if (original === "TRIALING") return "O teste grátis terminou. Escolha um plano para continuar com as automações.";
  if (original === "PAST_DUE") return "O pagamento não foi confirmado e a carência acabou. Atualize o pagamento para reativar.";
  return "A assinatura está suspensa. Fale com o suporte ou atualize o pagamento.";
}

export function computeEntitlements(
  workspace: { kind: "CUSTOMER" | "INTERNAL"; subscription: SubscriptionLike | null },
  now = new Date(),
): Entitlements {
  if (workspace.kind === "INTERNAL") {
    return {
      kind: "INTERNAL", planName: null, planSlug: null, status: "INTERNAL", canOperate: true,
      blockReason: null, warning: null, limits: UNLIMITED, features: ALL_FEATURES,
    };
  }
  const sub = workspace.subscription;
  if (!sub) {
    return {
      kind: "CUSTOMER", planName: null, planSlug: null, status: "NONE", canOperate: false,
      blockReason: NO_PLAN_REASON, warning: null, limits: NOTHING, features: [],
    };
  }
  const status = effectiveStatus(sub, now);
  const blockReason = blockReasonFor(sub.status, status);
  const planLimits = Object.fromEntries(LIMIT_KEYS.map((key) => [key, sub.plan[key]])) as Limits;
  return {
    kind: "CUSTOMER",
    planName: sub.plan.name,
    planSlug: sub.plan.slug,
    status,
    canOperate: blockReason === null,
    blockReason,
    warning: status === "PAST_DUE" ? "Pagamento pendente. Atualize a forma de pagamento para não ter as automações pausadas." : null,
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
