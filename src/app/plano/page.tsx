import type { Metadata } from "next";
import { getEntitlements, getUsage } from "@/lib/billing/entitlements";
import { FEATURES, LIMIT_KEYS, LIMIT_LABELS, type Entitlements } from "@/lib/billing/plan-rules";
import { CARD } from "@/components/ui/styles";
import { getCurrentWorkspace } from "@/lib/tenancy";

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

export default async function PlanoPage() {
  const { workspace } = await getCurrentWorkspace();
  const [entitlements, usage] = await Promise.all([getEntitlements(workspace.id), getUsage(workspace.id)]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Plano e uso</h1>
        <p className="mt-1 text-sm text-ink-muted">Workspace {workspace.name}</p>
      </header>

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
      </section>

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
