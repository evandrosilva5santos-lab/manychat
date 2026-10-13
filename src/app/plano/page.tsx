import type { Metadata } from "next";
import { getEntitlements, getUsage } from "@/lib/billing/entitlements";
import { FEATURES, LIMIT_KEYS, LIMIT_LABELS, type Entitlements } from "@/lib/billing/plan-rules";
import { CARD } from "@/components/ui/styles";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace, getWorkspaceRole } from "@/lib/tenancy";
import { ManageBillingButton, SubscribeButton } from "./BillingButtons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plano e uso · instachat" };

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

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { actor, workspace } = await getCurrentWorkspace();
  const [entitlements, usage, role, subscription, plansForSale, { checkout }] = await Promise.all([
    getEntitlements(workspace.id),
    getUsage(workspace.id),
    getWorkspaceRole(actor, workspace.id),
    prisma.subscription.findUnique({ where: { workspaceId: workspace.id }, select: { stripeCustomerId: true, stripeSubscriptionId: true, status: true } }),
    prisma.plan.findMany({
      where: { isActive: true, isPublic: true, stripePriceId: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, priceMonthlyCents: true },
    }),
    searchParams,
  ]);
  const isOwner = role === "OWNER" && workspace.kind === "CUSTOMER";
  const hasStripeSubscription = Boolean(subscription?.stripeSubscriptionId) && subscription?.status !== "CANCELED";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Plano e uso</h1>
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
                </div>
                {plan.description && <p className="text-sm text-ink-muted">{plan.description}</p>}
                <SubscribeButton planId={plan.id} label={`Assinar ${plan.name}`} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            Limites de cada plano em <a href="/precos" className="font-semibold text-primary underline">Preços</a>.
          </p>
        </section>
      )}

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
