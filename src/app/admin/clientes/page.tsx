import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { listClients } from "@/lib/admin/console";
import { PAGE_SIZE, readClientFilters, readPage, withParams } from "@/lib/admin/filters";
import { BILLING_CYCLE_LABEL, BILLING_MODE_LABEL, BILLING_MODES, formatDay, SUBSCRIPTION_STATUS_LABEL } from "@/lib/billing/billing-cycle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes · Administração · instachat" };

type SearchParams = Record<string, string | string[] | undefined>;
type Row = Awaited<ReturnType<typeof listClients>>["rows"][number];

const STATUS_FILTER = ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED", "NONE"] as const;

function statusOf(row: Row): string {
  if (row.kind === "INTERNAL") return "Interno";
  if (!row.subscription) return SUBSCRIPTION_STATUS_LABEL.NONE;
  return row.subscription.isComplimentary ? "Cortesia" : SUBSCRIPTION_STATUS_LABEL[row.subscription.status];
}

function dueOf(row: Row): string {
  const sub = row.subscription;
  if (!sub) return "—";
  if (sub.isComplimentary) return sub.complimentaryUntil ? formatDay(sub.complimentaryUntil) : "sem prazo";
  return formatDay(sub.status === "TRIALING" ? sub.trialEndsAt : sub.currentPeriodEnd);
}

function Filters({ params, plans }: { params: SearchParams; plans: { id: string; name: string }[] }) {
  const filters = readClientFilters(params);
  return (
    <form className="grid grid-cols-1 gap-2 sm:grid-cols-6" role="search" aria-label="Filtrar clientes">
      <input name="q" defaultValue={filters.q} placeholder="Buscar por nome ou e-mail" className={`${INPUT} sm:col-span-2`} aria-label="Buscar" />
      <select name="status" defaultValue={filters.status ?? ""} className={INPUT} aria-label="Status">
        <option value="">Todos os status</option>
        {STATUS_FILTER.map((status) => <option key={status} value={status}>{SUBSCRIPTION_STATUS_LABEL[status]}</option>)}
      </select>
      <select name="plano" defaultValue={filters.planId ?? ""} className={INPUT} aria-label="Plano">
        <option value="">Todos os planos</option>
        {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
      <select name="cobranca" defaultValue={filters.mode ?? ""} className={INPUT} aria-label="Forma de cobrança">
        <option value="">Toda forma de cobrança</option>
        {BILLING_MODES.map((mode) => <option key={mode} value={mode}>{BILLING_MODE_LABEL[mode]}</option>)}
      </select>
      <div className="flex gap-2">
        <button type="submit" className={`${SECONDARY_BUTTON} flex-1`}>Filtrar</button>
        <Link href="/admin/clientes" className={SECONDARY_BUTTON}>Limpar</Link>
      </div>
    </form>
  );
}

function ClientsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="rounded-lg border border-border bg-surface-200 p-6 text-sm text-ink-muted">Nenhum cliente com esses filtros.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-200">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-surface-300/60 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3">Cliente</th><th className="px-3">Plano</th><th className="px-3">Status</th><th className="px-3">Cobrança</th>
            <th className="px-3">Vencimento</th><th className="px-3 text-center">Perfis</th><th className="px-3 text-center">Pessoas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-300/40">
              <td className="px-4 py-3">
                <Link href={`/admin/workspaces/${row.id}`} className="font-semibold text-ink hover:text-primary hover:underline">{row.name}</Link>
                <p className="text-xs text-ink-muted">{row.owner.name} · {row.owner.email}</p>
              </td>
              <td className="px-3">{row.kind === "INTERNAL" ? "—" : row.subscription?.plan.name ?? "—"}</td>
              <td className="px-3">{statusOf(row)}</td>
              <td className="px-3 text-ink-muted">
                {row.subscription && row.kind === "CUSTOMER" ? `${BILLING_MODE_LABEL[row.subscription.billingMode].split(" (")[0]} · ${BILLING_CYCLE_LABEL[row.subscription.billingCycle]}` : "—"}
              </td>
              <td className="px-3 tabular-nums">{row.kind === "INTERNAL" ? "—" : dueOf(row)}</td>
              <td className="px-3 text-center tabular-nums">{row._count.accounts}</td>
              <td className="px-3 text-center tabular-nums">{row._count.members}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminClientesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = readPage(params);
  const { rows, total, plans } = await listClients(readClientFilters(params), page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-ink-muted">{total} cliente(s). Clique no nome para plano, cobrança, pagamentos e senhas.</p>
        </div>
        <Link href="/admin/clientes/novo" className={PRIMARY_BUTTON}><Plus size={16} aria-hidden /> Novo cliente</Link>
      </header>
      <Filters params={params} plans={plans} />
      <ClientsTable rows={rows} />
      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/clientes${withParams(params, { pagina: page - 1 })}`} className={SECONDARY_BUTTON}>Anterior</Link> : <span />}
          <span className="text-ink-muted">Página {page} de {pages}</span>
          {page < pages ? <Link href={`/admin/clientes${withParams(params, { pagina: page + 1 })}`} className={SECONDARY_BUTTON}>Próxima</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
