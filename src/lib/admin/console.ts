// Consultas e ações do console do Super Admin (ADR-009). Toda função exige Super Admin.
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { BILLING_CYCLES, BILLING_MODES } from "@/lib/billing/billing-cycle";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";
import { PAGE_SIZE, periodStarts, type AuditFilters, type ClientFilters, type PaymentFilters } from "./filters";

function clientWhere(filters: ClientFilters): Prisma.WorkspaceWhereInput {
  const and: Prisma.WorkspaceWhereInput[] = [];
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: contains }, { owner: { name: contains } }, { owner: { email: contains } }] });
  }
  if (filters.kind) and.push({ kind: filters.kind });
  if (filters.status === "NONE") and.push({ subscription: { is: null } });
  else if (filters.status) and.push({ subscription: { is: { status: filters.status } } });
  if (filters.planId) and.push({ subscription: { is: { planId: filters.planId } } });
  if (filters.mode) and.push({ subscription: { is: { billingMode: filters.mode } } });
  return and.length ? { AND: and } : {};
}

export async function listClients(filters: ClientFilters, page: number) {
  await requireSuperAdmin();
  const where = clientWhere(filters);
  const [rows, total, plans] = await Promise.all([
    prisma.workspace.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, kind: true, createdAt: true,
        owner: { select: { name: true, email: true } },
        subscription: {
          select: {
            status: true, billingMode: true, billingCycle: true, currentPeriodEnd: true, trialEndsAt: true,
            isComplimentary: true, complimentaryUntil: true, plan: { select: { name: true } },
          },
        },
        _count: { select: { accounts: true, members: true } },
      },
    }),
    prisma.workspace.count({ where }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return { rows, total, plans };
}

export const newClientSchema = z.object({
  workspaceName: z.string().trim().min(2, "Informe o nome do cliente.").max(80),
  ownerName: z.string().trim().min(2, "Informe o nome do dono da conta.").max(80),
  ownerEmail: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  password: z.string(),
  planId: z.string().min(1, "Escolha o plano.").max(40),
  billingMode: z.enum(BILLING_MODES),
  billingCycle: z.enum(BILLING_CYCLES),
  trialDays: z.number().int().min(0).max(90),
});

/** Status inicial: teste grátis, cortesia (ativa) ou aguardando o primeiro pagamento. */
export function initialSubscription(input: { billingMode: string; trialDays: number }, now: Date) {
  if (input.trialDays > 0) return { status: "TRIALING" as const, trialEndsAt: new Date(now.getTime() + input.trialDays * 86_400_000) };
  if (input.billingMode === "COMPLIMENTARY") return { status: "ACTIVE" as const, trialEndsAt: null, isComplimentary: true };
  // Manual: vence hoje; o cliente usa durante a carência do plano até o primeiro pagamento ser registrado.
  if (input.billingMode === "MANUAL") return { status: "ACTIVE" as const, trialEndsAt: null, currentPeriodEnd: now };
  // Stripe sempre começa em teste (createClient exige dias de teste); aqui só por segurança.
  return { status: "TRIALING" as const, trialEndsAt: now };
}

/** Cria cliente (workspace), dono com e-mail e senha, e a assinatura. Devolve o que mostrar uma vez ao Super Admin. */
export async function createClient(input: unknown, now = new Date()) {
  const actor = await requireSuperAdmin();
  const parsed = newClientSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const data = parsed.data;
  const problem = passwordProblem(data.password);
  if (problem) throw new UserFacingError(problem);
  if (data.billingMode === "STRIPE" && data.trialDays === 0) {
    throw new UserFacingError("Para cobrar pelo cartão, dê dias de teste: o cliente assina em Plano e cobrança durante o teste.");
  }

  const [plan, existing] = await Promise.all([
    prisma.plan.findUnique({ where: { id: data.planId }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: data.ownerEmail }, select: { id: true, role: true, _count: { select: { workspacesOwned: true } } } }),
  ]);
  if (!plan) throw new UserFacingError("Plano não encontrado.");
  if (existing?.role === "SUPERADMIN") throw new UserFacingError("Este e-mail é do Super Admin. Use outro e-mail para o cliente.");
  if (existing && existing._count.workspacesOwned > 0) throw new UserFacingError("Este e-mail já é dono de outro cliente.");

  const passwordHash = await hashPassword(data.password);
  const workspace = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name: data.ownerName, passwordHash } })
      : await tx.user.create({ data: { name: data.ownerName, email: data.ownerEmail, role: "CLIENT", passwordHash } });
    const created = await tx.workspace.create({
      data: {
        name: data.workspaceName, ownerId: user.id, kind: "CUSTOMER",
        members: { create: { userId: user.id, role: "OWNER" } },
        subscription: {
          create: { planId: data.planId, billingMode: data.billingMode, billingCycle: data.billingCycle, ...initialSubscription(data, now) },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, workspaceId: created.id, action: "client.create", entityType: "Workspace",
        entityId: created.id,
        changes: { cliente: data.workspaceName, dono: data.ownerEmail, plano: data.planId, cobranca: data.billingMode, ciclo: data.billingCycle, teste: data.trialDays },
      },
    });
    return created;
  });
  return { workspaceId: workspace.id, email: data.ownerEmail };
}

function paymentWhere(filters: PaymentFilters): Prisma.SubscriptionPaymentWhereInput {
  return {
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.from || filters.to ? { paidAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
  };
}

export async function listPayments(filters: PaymentFilters, page: number, now = new Date()) {
  await requireSuperAdmin();
  const where = paymentWhere(filters);
  const starts = periodStarts(now);
  const [rows, total, filtered, month, year] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where, orderBy: { paidAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { subscription: { select: { workspace: { select: { id: true, name: true } } } } },
    }),
    prisma.subscriptionPayment.count({ where }),
    prisma.subscriptionPayment.aggregate({ where, _sum: { amountCents: true } }),
    prisma.subscriptionPayment.aggregate({ where: { paidAt: { gte: starts.month } }, _sum: { amountCents: true } }),
    prisma.subscriptionPayment.aggregate({ where: { paidAt: { gte: starts.year } }, _sum: { amountCents: true } }),
  ]);
  return {
    rows, total,
    totals: { filtered: filtered._sum.amountCents ?? 0, month: month._sum.amountCents ?? 0, year: year._sum.amountCents ?? 0 },
  };
}

export async function listAudit(filters: AuditFilters, page: number) {
  await requireSuperAdmin();
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.workspaceId ? { workspaceId: filters.workspaceId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
  };
  const [rows, total, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const workspaceIds = [...new Set(rows.map((row) => row.workspaceId).filter((id): id is string => Boolean(id)))];
  const workspaces = await prisma.workspace.findMany({ where: { id: { in: workspaceIds } }, select: { id: true, name: true } });
  return { rows, total, actions: actions.map((row) => row.action), workspaceNames: new Map(workspaces.map((w) => [w.id, w.name])) };
}

/** Números de assinatura para a visão geral. */
export async function getSubscriptionMetrics(now = new Date()) {
  await requireSuperAdmin();
  const customer = { workspace: { kind: "CUSTOMER" as const } };
  const [byStatus, complimentary, received] = await Promise.all([
    prisma.subscription.groupBy({ by: ["status"], where: customer, _count: { _all: true } }),
    prisma.subscription.count({ where: { ...customer, OR: [{ isComplimentary: true }, { billingMode: "COMPLIMENTARY" }] } }),
    prisma.subscriptionPayment.aggregate({ where: { paidAt: { gte: periodStarts(now).month } }, _sum: { amountCents: true } }),
  ]);
  const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
  return {
    active: count("ACTIVE"), trialing: count("TRIALING"), pastDue: count("PAST_DUE"),
    suspended: count("SUSPENDED") + count("CANCELED"), complimentary, receivedThisMonthCents: received._sum.amountCents ?? 0,
  };
}
