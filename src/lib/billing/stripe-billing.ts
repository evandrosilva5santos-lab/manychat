// Cobrança pelo Stripe (ADR-008): checkout, portal do cliente e sincronização pelo webhook.
// O Stripe manda; o banco espelha. Cada evento é aplicado uma vez só (BillingEvent).
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe/client";
import { requireWorkspaceRole } from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";
import type { SubscriptionStatus } from "./plan-rules";

/** Status do Stripe → status do instachat. `null` = não mexe (ex.: checkout ainda não pago). */
export function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus | null {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
    case "paused":
      return "SUSPENDED";
    case "canceled":
      return "CANCELED";
    default:
      return null; // incomplete, incomplete_expired e futuros
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** O dono abre o checkout de um plano. Devolve a URL do Stripe. */
export async function createCheckoutSession(workspaceId: string, planId: string, baseUrl: string): Promise<string> {
  const { actor } = await requireWorkspaceRole(workspaceId, ["OWNER"]);
  const [plan, subscription] = await Promise.all([
    prisma.plan.findUnique({ where: { id: planId } }),
    prisma.subscription.findUnique({ where: { workspaceId } }),
  ]);
  if (!plan || !plan.isActive || !plan.stripePriceId) throw new UserFacingError("Este plano não está disponível para assinatura.");
  if (subscription?.stripeSubscriptionId && subscription.status !== "CANCELED") {
    throw new UserFacingError("Este workspace já tem uma assinatura. Use “Gerenciar pagamento” para trocar de plano.");
  }

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    client_reference_id: workspaceId,
    ...(subscription?.stripeCustomerId ? { customer: subscription.stripeCustomerId } : { customer_email: actor.email }),
    subscription_data: { metadata: { workspaceId, planId: plan.id } },
    metadata: { workspaceId, planId: plan.id },
    success_url: `${baseUrl}/plano?checkout=ok`,
    cancel_url: `${baseUrl}/plano?checkout=cancelado`,
  });
  if (!session.url) throw new Error("Stripe não devolveu a URL do checkout.");
  return session.url;
}

/** O dono abre o portal do Stripe (cartão, faturas, troca e cancelamento). */
export async function createPortalSession(workspaceId: string, baseUrl: string): Promise<string> {
  await requireWorkspaceRole(workspaceId, ["OWNER"]);
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId }, select: { stripeCustomerId: true } });
  if (!subscription?.stripeCustomerId) throw new UserFacingError("Ainda não há pagamento cadastrado neste workspace.");
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}/plano`,
  });
  return session.url;
}

/** Workspace dono da assinatura: metadata do checkout, senão o ID já gravado. */
async function workspaceIdFor(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.workspaceId;
  if (fromMetadata) return fromMetadata;
  const existing = await prisma.subscription.findFirst({
    where: { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: idOf(sub.customer) ?? "-" }] },
    select: { workspaceId: true },
  });
  return existing?.workspaceId ?? null;
}

/** Fim do período: na API atual fica nos itens da assinatura. */
function periodEnd(sub: Stripe.Subscription): Date | null {
  const ends = sub.items.data.map((item) => item.current_period_end).filter((value) => typeof value === "number");
  return ends.length ? new Date(Math.min(...ends) * 1000) : null;
}

type SyncData = {
  planId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  isComplimentary: boolean;
  complimentaryUntil: Date | null;
};
type SyncPlan = { workspaceId: string; data: SyncData };

/** Traduz a assinatura do Stripe para a linha de Subscription. `null` = nada a gravar. */
async function planSync(sub: Stripe.Subscription, now: Date): Promise<SyncPlan | null> {
  const status = mapStripeStatus(sub.status);
  if (!status) return null;
  const workspaceId = await workspaceIdFor(sub);
  if (!workspaceId) {
    console.error("[stripe] assinatura sem workspace conhecido", sub.id);
    return null;
  }
  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? await prisma.plan.findUnique({ where: { stripePriceId: priceId } }) : null;
  if (!plan) {
    console.error("[stripe] preço sem plano cadastrado", priceId ?? "(sem preço)");
    return null;
  }
  const current = await prisma.subscription.findUnique({ where: { workspaceId }, select: { status: true, graceEndsAt: true } });
  // Carência começa no primeiro aviso de atraso e não se renova a cada evento.
  const graceEndsAt =
    status === "PAST_DUE"
      ? current?.status === "PAST_DUE" && current.graceEndsAt
        ? current.graceEndsAt
        : new Date(now.getTime() + plan.graceDays * 86_400_000)
      : null;
  return {
    workspaceId,
    data: {
      planId: plan.id,
      status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: idOf(sub.customer),
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      graceEndsAt,
      // Assinou pelo Stripe: a cortesia acaba e vale o que o Stripe diz.
      isComplimentary: false,
      complimentaryUntil: null,
    },
  };
}

async function subscriptionFromEvent(event: Stripe.Event): Promise<Stripe.Subscription | null> {
  if (event.type === "checkout.session.completed") {
    const subscriptionId = idOf(event.data.object.subscription);
    return subscriptionId ? getStripeClient().subscriptions.retrieve(subscriptionId) : null;
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return event.data.object;
  }
  return null;
}

/**
 * Aplica um evento do Stripe. O registro do evento e a alteração da assinatura
 * vão na mesma transação: evento repetido é ignorado; falha deixa o Stripe tentar de novo.
 */
export async function applyStripeEvent(event: Stripe.Event, now = new Date()): Promise<"applied" | "duplicate" | "ignored"> {
  if (await prisma.billingEvent.findUnique({ where: { id: event.id }, select: { id: true } })) return "duplicate";
  const sub = await subscriptionFromEvent(event);
  const sync = sub ? await planSync(sub, now) : null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingEvent.create({ data: { id: event.id, type: event.type } });
      if (!sync) return;
      await tx.subscription.upsert({
        where: { workspaceId: sync.workspaceId },
        create: { workspaceId: sync.workspaceId, ...sync.data },
        update: sync.data,
      });
    });
  } catch (error) {
    // Dois envios do mesmo evento ao mesmo tempo: o segundo bate na chave do BillingEvent.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
  return sync ? "applied" : "ignored";
}
