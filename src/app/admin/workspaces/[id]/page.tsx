import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CARD } from "@/components/ui/styles";
import { getWorkspaceBilling } from "@/lib/billing/admin";
import {
  BILLING_CYCLE_LABEL, BILLING_MODE_LABEL, formatCents, formatDay, PAYMENT_METHOD_LABEL, priceFor, SUBSCRIPTION_STATUS_LABEL,
} from "@/lib/billing/billing-cycle";
import { LIMIT_KEYS, LIMIT_LABELS, readLimitOverrides } from "@/lib/billing/plan-rules";
import { MemberPasswordReset } from "./MemberPasswordReset";
import { PaymentForm } from "./PaymentForm";
import { SubscriptionForm } from "./SubscriptionForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cliente · Administração · instachat" };

const ROLE_LABEL = { OWNER: "Dono", ADMIN: "Admin", OPERATOR: "Operador" } as const;

function complimentaryLabel(complimentary: { until: Date | null } | null): string | null {
  if (!complimentary) return null;
  return complimentary.until ? `Cortesia até ${formatDay(complimentary.until)}.` : "Cortesia por tempo indeterminado.";
}

type Billing = NonNullable<Awaited<ReturnType<typeof getWorkspaceBilling>>>;

function Situation({ data }: { data: Billing }) {
  const { workspace, entitlements, usage } = data;
  const sub = workspace.subscription;
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="situacao">
      <h2 id="situacao" className="text-base font-bold text-ink">Situação</h2>
      {entitlements.kind === "INTERNAL" ? (
        <p className="text-sm text-ink">Operação interna: sem plano e sem limites.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-ink-muted">Plano</dt><dd className="font-semibold text-ink">{entitlements.planName ?? "Sem plano"}</dd></div>
          <div><dt className="text-xs text-ink-muted">Status</dt><dd className="font-semibold text-ink">{SUBSCRIPTION_STATUS_LABEL[entitlements.status]}</dd></div>
          <div><dt className="text-xs text-ink-muted">Cobrança</dt><dd className="text-ink">{sub ? `${BILLING_MODE_LABEL[sub.billingMode]} · ${BILLING_CYCLE_LABEL[sub.billingCycle]}` : "—"}</dd></div>
          <div><dt className="text-xs text-ink-muted">Pago até</dt><dd className="text-ink">{formatDay(sub?.currentPeriodEnd ?? sub?.trialEndsAt)}</dd></div>
        </dl>
      )}
      {complimentaryLabel(entitlements.complimentary) && <p className="text-sm font-semibold text-success">{complimentaryLabel(entitlements.complimentary)}</p>}
      {entitlements.blockReason && <p className="text-sm font-medium text-danger">{entitlements.blockReason}</p>}
      <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {LIMIT_KEYS.map((key) => (
          <li key={key} className="flex justify-between gap-2 border-b border-border py-1">
            <span className="text-ink-muted first-letter:uppercase">{LIMIT_LABELS[key]}</span>
            <span className="tabular-nums text-ink">{usage[key]} / {entitlements.limits[key] ?? "∞"}</span>
          </li>
        ))}
      </ul>
      {sub?.stripeSubscriptionId && (
        <p className="text-xs text-ink-muted">Cobrança automática pelo Stripe ({sub.stripeSubscriptionId}). Mudanças feitas aqui podem ser sobrescritas pelo próximo evento do Stripe.</p>
      )}
    </section>
  );
}

function Payments({ payments }: { payments: Billing["payments"] }) {
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="pagamentos">
      <h2 id="pagamentos" className="text-base font-bold text-ink">Pagamentos recebidos</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum pagamento registrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-ink-muted"><tr><th className="py-2">Pago em</th><th>Valor</th><th>Método</th><th>Período</th><th>Referência</th></tr></thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-2">{formatDay(payment.paidAt)}</td>
                  <td className="tabular-nums font-semibold">{formatCents(payment.amountCents, payment.currency)}</td>
                  <td>{PAYMENT_METHOD_LABEL[payment.method]}{payment.source === "stripe" ? " (Stripe)" : ""}</td>
                  <td className="text-ink-muted">{formatDay(payment.periodStart)} – {formatDay(payment.periodEnd)}</td>
                  <td className="text-ink-muted">{payment.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Members({ workspaceId, members }: { workspaceId: string; members: Billing["workspace"]["members"] }) {
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="acessos">
      <h2 id="acessos" className="text-base font-bold text-ink">Pessoas com acesso</h2>
      <ul className="flex flex-col divide-y divide-border">
        {members.map(({ role, user }) => (
          <li key={user.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{user.name} <span className="text-xs font-normal text-ink-muted">· {ROLE_LABEL[role]}</span></p>
              <p className="text-xs text-ink-muted">{user.email}</p>
            </div>
            {user.role !== "SUPERADMIN" && <MemberPasswordReset workspaceId={workspaceId} userId={user.id} name={user.name} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AdminWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getWorkspaceBilling(id);
  if (!data) notFound();
  const { workspace, plans, audit, payments, entitlements } = data;
  const sub = workspace.subscription;
  const plan = sub?.plan ?? plans[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/admin/clientes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Clientes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{workspace.name}</h1>
        <p className="text-sm text-ink-muted">
          Dono: {workspace.owner.name} ({workspace.owner.email}) · {workspace._count.members} pessoa(s) · {workspace._count.accounts} perfil(is)
        </p>
      </header>

      <Situation data={data} />

      {workspace.kind === "CUSTOMER" && (
        <SubscriptionForm
          workspaceId={workspace.id}
          plans={plans.map((option) => ({
            id: option.id, name: option.name, isActive: option.isActive,
            limits: Object.fromEntries(LIMIT_KEYS.map((key) => [key, option[key]])) as Record<(typeof LIMIT_KEYS)[number], number | null>,
          }))}
          initial={{
            planId: sub?.planId ?? plans[0]?.id ?? "",
            status: sub?.status ?? "ACTIVE",
            trialEndsAt: sub?.trialEndsAt ? sub.trialEndsAt.toISOString().slice(0, 10) : "",
            billingMode: sub?.billingMode ?? "MANUAL",
            billingCycle: sub?.billingCycle ?? "MONTHLY",
            limitOverrides: readLimitOverrides(sub?.limitOverrides),
            complimentaryLabel: complimentaryLabel(entitlements.complimentary),
          }}
        />
      )}

      {workspace.kind === "CUSTOMER" && sub && plan && (
        <PaymentForm
          workspaceId={workspace.id}
          cycle={sub.billingCycle}
          priceByCycle={{ MONTHLY: priceFor(plan, "MONTHLY"), YEARLY: priceFor(plan, "YEARLY") }}
        />
      )}
      {workspace.kind === "CUSTOMER" && <Payments payments={payments} />}
      <Members workspaceId={workspace.id} members={workspace.members} />

      <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="auditoria">
        <h2 id="auditoria" className="text-base font-bold text-ink">Auditoria</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma alteração administrativa registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="border-b border-border pb-2">
                <p className="text-ink"><strong>{entry.action}</strong> por {entry.actorEmail} em {entry.createdAt.toLocaleString("pt-BR")}</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink-muted">{JSON.stringify(entry.changes)}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
