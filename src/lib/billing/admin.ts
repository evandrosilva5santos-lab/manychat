// Operações do Super Admin sobre planos e assinaturas (ADR-008).
// Toda alteração grava o AuditLog na MESMA transação: sem registro, sem alteração.
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, type TenantActor } from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";
import { addMonths, BILLING_CYCLES, BILLING_MODES, monthlyRevenueCents, reconcileBilling } from "./billing-cycle";
import { getEntitlements, getUsage } from "./entitlements";
import { FEATURES, readLimitOverrides } from "./plan-rules";

const limit = z.number().int().min(0).max(10_000_000).nullable();

export const planInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "Use só letras minúsculas, números e hífen (2 a 40)."),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).nullable(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  priceMonthlyCents: z.number().int().min(0).max(100_000_000),
  trialDays: z.number().int().min(0).max(90),
  graceDays: z.number().int().min(0).max(60),
  priceYearlyCents: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  stripePriceId: z.string().trim().regex(/^price_[A-Za-z0-9]+$/, "ID de preço do Stripe começa com price_.").nullable(),
  stripeYearlyPriceId: z.string().trim().regex(/^price_[A-Za-z0-9]+$/, "ID de preço anual do Stripe começa com price_.").nullable().default(null),
  maxInstagramAccounts: limit,
  maxMembers: limit,
  maxActiveFlows: limit,
  maxDmsPerMonth: limit,
  features: z.array(z.enum(Object.keys(FEATURES) as [keyof typeof FEATURES, ...(keyof typeof FEATURES)[]])).max(20),
});
export type PlanInput = z.infer<typeof planInputSchema>;

const STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED"] as const;

/** Cortesia: manter a atual, encerrar, por N meses ou por tempo indeterminado. */
export const COMPLIMENTARY_OPTIONS = ["keep", "none", "1", "3", "6", "9", "indefinite"] as const;
export type ComplimentaryOption = (typeof COMPLIMENTARY_OPTIONS)[number];

export const subscriptionInputSchema = z.object({
  planId: z.string().min(1).max(40),
  status: z.enum(STATUSES),
  trialEndsAt: z.coerce.date().nullable(),
  limitOverrides: z.record(z.string(), z.unknown()),
  complimentary: z.enum(COMPLIMENTARY_OPTIONS).default("keep"),
  billingMode: z.enum(BILLING_MODES).default("STRIPE"),
  billingCycle: z.enum(BILLING_CYCLES).default("MONTHLY"),
});

export { addMonths };

/** Campos de cortesia a gravar, ou `null` para manter os atuais. */
export function complimentaryFields(option: ComplimentaryOption, now: Date) {
  if (option === "keep") return null;
  if (option === "none") return { isComplimentary: false, complimentaryUntil: null };
  if (option === "indefinite") return { isComplimentary: true, complimentaryUntil: null };
  return { isComplimentary: true, complimentaryUntil: addMonths(now, Number(option)) };
}
export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;

/** Só os campos que mudaram, no formato { campo: { de, para } }. */
export function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const changes: Record<string, { de: unknown; para: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    const previous = before?.[key] ?? null;
    if (JSON.stringify(previous) !== JSON.stringify(value ?? null)) changes[key] = { de: previous, para: value ?? null };
  }
  return changes;
}

type AuditInput = { action: string; entityType: string; entityId: string; workspaceId?: string; changes: object };

function auditData(actor: TenantActor, entry: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    workspaceId: entry.workspaceId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes as Prisma.InputJsonValue,
  };
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

export async function listPlans() {
  await requireSuperAdmin();
  return prisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { subscriptions: true } } } });
}

/** Cria (sem `planId`) ou atualiza um plano. */
export async function savePlan(planId: string | null, input: unknown) {
  const actor = await requireSuperAdmin();
  const data = parseOrThrow(planInputSchema, input);
  try {
    if (!planId) {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.plan.create({ data });
        await tx.auditLog.create({
          data: auditData(actor, { action: "plan.create", entityType: "Plan", entityId: created.id, changes: diffFields(null, data) }),
        });
        return created;
      });
    }
    const before = await prisma.plan.findUnique({ where: { id: planId } });
    if (!before) throw new UserFacingError("Plano não encontrado.");
    const changes = diffFields(before as unknown as Record<string, unknown>, data);
    const [updated] = await prisma.$transaction([
      prisma.plan.update({ where: { id: planId }, data }),
      prisma.auditLog.create({ data: auditData(actor, { action: "plan.update", entityType: "Plan", entityId: planId, changes }) }),
    ]);
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserFacingError("Já existe um plano com este identificador ou ID de preço.");
    }
    throw error;
  }
}

export async function getWorkspaceBilling(workspaceId: string) {
  await requireSuperAdmin();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: { select: { name: true, email: true } },
      subscription: { include: { plan: true } },
      members: { orderBy: { createdAt: "asc" }, select: { role: true, user: { select: { id: true, name: true, email: true, role: true } } } },
      _count: { select: { members: true, accounts: true } },
    },
  });
  if (!workspace) return null;
  const [entitlements, usage, plans, audit, payments] = await Promise.all([
    getEntitlements(workspaceId),
    getUsage(workspaceId),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.auditLog.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.subscriptionPayment.findMany({ where: { workspaceId }, orderBy: { paidAt: "desc" }, take: 24 }),
  ]);
  return { workspace, entitlements, usage, plans, audit, payments };
}

/** Troca plano, status, fim do teste e ajustes de limite de um workspace. */
export async function setWorkspaceSubscription(workspaceId: string, input: unknown, now = new Date()) {
  const actor = await requireSuperAdmin();
  const data = parseOrThrow(subscriptionInputSchema, input);
  const overrides = readLimitOverrides(data.limitOverrides);
  const [workspace, plan] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, include: { subscription: true } }),
    prisma.plan.findUnique({ where: { id: data.planId }, select: { id: true } }),
  ]);
  if (!workspace) throw new UserFacingError("Workspace não encontrado.");
  if (workspace.kind === "INTERNAL") throw new UserFacingError("Workspace interno não tem plano.");
  if (!plan) throw new UserFacingError("Plano não encontrado.");

  const billing = reconcileBilling(data.billingMode, data.complimentary, workspace.subscription?.isComplimentary ?? false);
  const complimentary = complimentaryFields(billing.complimentary, now);
  const next = {
    planId: data.planId,
    billingMode: billing.mode,
    billingCycle: data.billingCycle,
    // Cortesia vale como ativa: o status gravado acompanha para relatórios e filtros.
    status: complimentary?.isComplimentary ? ("ACTIVE" as const) : data.status,
    trialEndsAt: data.trialEndsAt,
    limitOverrides: overrides,
    ...(complimentary ?? {}),
  };
  const current = workspace.subscription;
  const before = current
    ? {
        planId: current.planId,
        billingMode: current.billingMode,
        billingCycle: current.billingCycle,
        status: current.status,
        trialEndsAt: current.trialEndsAt,
        limitOverrides: current.limitOverrides,
        ...(complimentary ? { isComplimentary: current.isComplimentary, complimentaryUntil: current.complimentaryUntil } : {}),
      }
    : null;
  const writeData = { ...next, limitOverrides: overrides as Prisma.InputJsonValue };
  await prisma.$transaction([
    prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...writeData }, update: writeData }),
    prisma.auditLog.create({
      data: auditData(actor, {
        action: "subscription.set",
        entityType: "Subscription",
        entityId: workspaceId,
        workspaceId,
        changes: diffFields(before, next),
      }),
    }),
  ]);
}

/** MRR em centavos: assinaturas pagas ativas ou em carência; anual conta 1/12 (interno e cortesia ficam fora). */
export async function getMrrCents(): Promise<number> {
  await requireSuperAdmin();
  const active = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      isComplimentary: false,
      billingMode: { not: "COMPLIMENTARY" },
      workspace: { kind: "CUSTOMER" },
    },
    select: { billingCycle: true, plan: { select: { priceMonthlyCents: true, priceYearlyCents: true } } },
  });
  return active.reduce((sum, row) => sum + monthlyRevenueCents(row.plan, row.billingCycle), 0);
}
