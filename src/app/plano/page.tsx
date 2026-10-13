import type { Metadata } from "next";
import { getEntitlements, getUsage } from "@/lib/billing/entitlements";
import { FEATURES, LIMIT_KEYS, LIMIT_LABELS, type Entitlements } from "@/lib/billing/plan-rules";
import { CARD } from "@/components/ui/styles";
import {
  BILLING_CYCLE_LABEL, BILLING_MODE_LABEL, formatCents, formatDay, PAYMENT_METHOD_LABEL, yearlyDiscountPercent,
  type BillingCycle, type BillingMode, type PaymentMethod,
} from "@/lib/billing/billing-cycle";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace, getWorkspaceRole } from "@/lib/tenancy";
import { ManageBillingButton, SubscribeButton } from "./BillingButtons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plano e cobrança · instachat" };

const STATUS_LABEL: Record<Entitlements["status"], string> = {
  INTERNAL: "Operação interna (sem limites)",
  NONE: "Sem plano",
  TRIALING: "Teste grátis",
  ACTIVE: "Ativo",
  PAST_DUE: "Pagamento pendente",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const tone = percent >= 100 ? "bg-danger" : percent >= 80 ? "bg-warning" : "bg-primary";
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink first-letter:uppercase">{label}</span>
        <span className="tabular-nums text-ink-muted">
          {used.toLocaleString("pt-BR")} / {limit === null ? "ilimitado" : limit.toLocaleString("pt-BR")}
        </span>
      </div>
      {limit !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-300"
          role="progressbar"
          aria-label={label}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </li>
  );
}

type PlanForSale = { priceMonthlyCents: number; priceYearlyCents: number | null; stripeYearlyPriceId: string | null };

function yearlyNote(plan: PlanForSale): string {
  const discount = yearlyDiscountPercent(plan);
  return discount > 0 ? ` (${discount}% de desconto)` : "";
}

function cycleOptions(plan: PlanForSale) {
  const monthly = { cycle: "MONTHLY" as const, label: `Mensal · ${formatPrice(plan.priceMonthlyCents)}/mês` };
  if (!plan.stripeYearlyPriceId || plan.priceYearlyCents === null) return [monthly];
  return [monthly, { cycle: "YEARLY" as const, label: `Anual · ${formatPrice(plan.priceYearlyCents)}/ano${yearlyNote(plan)}` }];
}

type SubscriptionSummary = {
  billingMode: BillingMode; billingCycle: BillingCycle; status: string; currentPeriodEnd: Date | null; trialEndsAt: Date | null; cancelAtPeriodEnd: boolean;
};

function dueLabel(subscription: SubscriptionSummary): string | null {
  if (subscription.billingMode === "COMPLIMENTARY") return null;
  if (subscription.status === "TRIALING" && subscription.trialEndsAt) return `Teste grátis até ${formatDay(subscription.trialEndsAt)}`;
  if (!subscription.currentPeriodEnd) return null;
  if (subscription.cancelAtPeriodEnd) return `Cancelada: acesso até ${formatDay(subscription.currentPeriodEnd)}`;
  return subscription.billingMode === "STRIPE"
    ? `Próxima cobrança em ${formatDay(subscription.currentPeriodEnd)}`
    : `Pago até ${formatDay(subscription.currentPeriodEnd)}`;
}

function BillingSummary({ subscription }: { subscription: SubscriptionSummary }) {
  const due = dueLabel(subscription);
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-sm text-ink">
      <p>Cobrança: <strong>{BILLING_MODE_LABEL[subscription.billingMode]}</strong> · {BILLING_CYCLE_LABEL[subscription.billingCycle]}</p>
      {due && <p>{due}</p>}
      {subscription.billingMode === "MANUAL" && (
        <p className="text-xs text-ink-muted">Pagamento por Pix, boleto ou transferência: a Start Inc. registra aqui quando o pagamento é confirmado.</p>
      )}
    </div>
  );
}

type Payment = { id: string; paidAt: Date; amountCents: number; currency: string; method: PaymentMethod; periodEnd: Date };

function PaymentHistory({ payments }: { payments: Payment[] }) {
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="historico">
      <h2 id="historico" className="text-base font-bold text-ink">Pagamentos</h2>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span>{formatDay(payment.paidAt)} · {PAYMENT_METHOD_LABEL[payment.method]}</span>
            <span className="text-ink-muted">até {formatDay(payment.periodEnd)}</span>
            <strong className="tabular-nums">{formatCents(payment.amountCents, payment.currency)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { actor, workspace } = await getCurrentWorkspace();
  const [entitlements, usage, role, subscription, plansForSale, { checkout }] = await Promise.all([
    getEntitlements(workspace.id),
    getUsage(workspace.id),
    getWorkspaceRole(actor, workspace.id),
    prisma.subscription.findUnique({
      where: { workspaceId: workspace.id },
      select: {
        stripeCustomerId: true, stripeSubscriptionId: true, status: true, billingMode: true, billingCycle: true,
        currentPeriodEnd: true, trialEndsAt: true, cancelAtPeriodEnd: true,
      },
    }),
    prisma.plan.findMany({
      where: { isActive: true, isPublic: true, stripePriceId: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, priceMonthlyCents: true, priceYearlyCents: true, stripeYearlyPriceId: true },
    }),
    searchParams,
  ]);
  const payments = await prisma.subscriptionPayment.findMany({ where: { workspaceId: workspace.id }, orderBy: { paidAt: "desc" }, take: 12 });
  const isOwner = role === "OWNER" && workspace.kind === "CUSTOMER";
  const hasStripeSubscription = Boolean(subscription?.stripeSubscriptionId) && subscription?.status !== "CANCELED";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Plano e cobrança</h1>
        <p className="mt-1 text-sm text-ink-muted">Workspace {workspace.name}</p>
      </header>

      {checkout === "ok" && (
        <p role="status" className="rounded-md border border-success bg-success-soft px-4 py-3 text-sm font-medium text-ink">
          Pagamento recebido pelo Stripe. A assinatura aparece aqui assim que a confirmação chegar (em geral, segundos).
        </p>
      )}

      {entitlements.blockReason && (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-ink">
          {entitlements.blockReason} As mensagens recebidas continuam sendo guardadas.
        </p>
      )}
      {entitlements.warning && (
        <p role="status" className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm font-medium text-ink">
          {entitlements.warning}
        </p>
      )}

      <section className={`${CARD} flex flex-col gap-1`} aria-label="Plano atual">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Plano atual</p>
        <p className="text-xl font-bold text-ink">{entitlements.planName ?? (entitlements.kind === "INTERNAL" ? "Interno" : "Nenhum")}</p>
        <p className="text-sm text-ink-muted">{STATUS_LABEL[entitlements.status]}</p>
        {subscription && workspace.kind === "CUSTOMER" && <BillingSummary subscription={subscription} />}
        {entitlements.complimentary && entitlements.canOperate && (
          <p className="text-sm font-semibold text-success">
            {entitlements.complimentary.until
              ? `Cortesia até ${entitlements.complimentary.until.toLocaleDateString("pt-BR")}`
              : "Cortesia por tempo indeterminado"}
          </p>
        )}
      </section>

      {isOwner && subscription?.stripeCustomerId && (
        <section className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`} aria-label="Pagamento">
          <p className="text-sm text-ink-muted">Cartão, faturas, troca de plano e cancelamento ficam no portal seguro do Stripe.</p>
          <ManageBillingButton />
        </section>
      )}

      {isOwner && !hasStripeSubscription && plansForSale.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="assinar">
          <h2 id="assinar" className="text-base font-bold text-ink">Assinar</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {plansForSale.map((plan) => (
              <li key={plan.id} className={`${CARD} flex flex-col gap-3`}>
                <div>
                  <p className="text-base font-bold text-ink">{plan.name}</p>
                  <p className="text-sm text-ink-muted">{formatPrice(plan.priceMonthlyCents)}/mês</p>
                  {plan.stripeYearlyPriceId && plan.priceYearlyCents !== null && (
                    <p className="text-sm text-ink-muted">ou {formatPrice(plan.priceYearlyCents)}/ano{yearlyNote(plan)}</p>
                  )}
                </div>
                {plan.description && <p className="text-sm text-ink-muted">{plan.description}</p>}
                <SubscribeButton planId={plan.id} label={`Assinar ${plan.name}`} cycles={cycleOptions(plan)} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            Limites de cada plano em <a href="/precos" className="font-semibold text-primary underline">Preços</a>.
          </p>
        </section>
      )}

      {payments.length > 0 && <PaymentHistory payments={payments} />}

      <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="uso">
        <h2 id="uso" className="text-base font-bold text-ink">Uso</h2>
        <ul className="flex flex-col gap-4">
          {LIMIT_KEYS.map((key) => (
            <UsageBar key={key} label={LIMIT_LABELS[key]} used={usage[key]} limit={entitlements.limits[key]} />
          ))}
        </ul>
        <p className="text-xs text-ink-muted">Mensagens contadas desde o dia 1 do mês (horário UTC). Perfis descarregados não ocupam vaga.</p>
      </section>

      <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="recursos">
        <h2 id="recursos" className="text-base font-bold text-ink">Recursos extras</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(Object.keys(FEATURES) as (keyof typeof FEATURES)[]).map((key) => (
            <li key={key} className={entitlements.features.includes(key) ? "text-ink" : "text-ink-muted line-through"}>
              {FEATURES[key]}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
