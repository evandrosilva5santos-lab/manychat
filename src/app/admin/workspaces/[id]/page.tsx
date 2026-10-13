import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CARD } from "@/components/ui/styles";
import { getWorkspaceBilling } from "@/lib/billing/admin";
import { LIMIT_KEYS, LIMIT_LABELS } from "@/lib/billing/plan-rules";
import { SubscriptionForm } from "./SubscriptionForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspace · Administração · instachat" };

function complimentaryLabel(complimentary: { until: Date | null } | null): string | null {
  if (!complimentary) return null;
  return complimentary.until ? `Cortesia até ${complimentary.until.toLocaleDateString("pt-BR")}.` : "Cortesia por tempo indeterminado.";
}

export default async function AdminWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getWorkspaceBilling(id);
  if (!data) notFound();
  const { workspace, entitlements, usage, plans, audit } = data;
  const sub = workspace.subscription;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Painel Super Admin
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{workspace.name}</h1>
        <p className="text-sm text-ink-muted">
          Dono: {workspace.owner.name} ({workspace.owner.email}) · {workspace._count.members} membro(s) · {workspace._count.accounts} perfil(is)
        </p>
      </header>

      <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="situacao">
        <h2 id="situacao" className="text-base font-bold text-ink">Situação</h2>
        <p className="text-sm text-ink">
          {entitlements.kind === "INTERNAL" ? "Operação interna: sem plano e sem limites." : `${entitlements.planName ?? "Sem plano"} · ${entitlements.status}`}
        </p>
        {complimentaryLabel(entitlements.complimentary) && (
          <p className="text-sm font-semibold text-success">{complimentaryLabel(entitlements.complimentary)}</p>
        )}
        {entitlements.blockReason && <p className="text-sm font-medium text-danger">{entitlements.blockReason}</p>}
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {LIMIT_KEYS.map((key) => (
            <li key={key} className="flex justify-between gap-2 border-b border-border py-1">
              <span className="text-ink-muted first-letter:uppercase">{LIMIT_LABELS[key]}</span>
              <span className="tabular-nums text-ink">
                {usage[key]} / {entitlements.limits[key] ?? "∞"}
              </span>
            </li>
          ))}
        </ul>
        {sub?.stripeSubscriptionId && (
          <p className="text-xs text-ink-muted">Cobrança automática pelo Stripe ({sub.stripeSubscriptionId}). Mudanças feitas aqui podem ser sobrescritas pelo próximo evento do Stripe.</p>
        )}
      </section>

      {workspace.kind === "CUSTOMER" && (
        <SubscriptionForm
          workspaceId={workspace.id}
          plans={plans}
          initial={{
            planId: sub?.planId ?? plans[0]?.id ?? "",
            status: sub?.status ?? "ACTIVE",
            trialEndsAt: sub?.trialEndsAt ? sub.trialEndsAt.toISOString().slice(0, 10) : "",
            limitOverrides: JSON.stringify(sub?.limitOverrides ?? {}),
            complimentaryLabel: complimentaryLabel(entitlements.complimentary),
          }}
        />
      )}

      <section className={`${CARD} flex flex-col gap-3`} aria-labelledby="auditoria">
        <h2 id="auditoria" className="text-base font-bold text-ink">Auditoria</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma alteração administrativa registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="border-b border-border pb-2">
                <p className="text-ink">
                  <strong>{entry.action}</strong> por {entry.actorEmail} em {entry.createdAt.toLocaleString("pt-BR")}
                </p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink-muted">{JSON.stringify(entry.changes)}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
