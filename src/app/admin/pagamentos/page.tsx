import type { Metadata } from "next";
import Link from "next/link";
import { CARD, INPUT, SECONDARY_BUTTON } from "@/components/ui/styles";
import { listPayments } from "@/lib/admin/console";
import { PAGE_SIZE, readPage, readPaymentFilters, withParams } from "@/lib/admin/filters";
import { formatCents, formatDay, PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from "@/lib/billing/billing-cycle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pagamentos · Administração · instachat" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function Total({ label, cents }: { label: string; cents: number }) {
  return (
    <div className={`${CARD} flex flex-col gap-1`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums text-ink">{formatCents(cents)}</span>
    </div>
  );
}

export default async function AdminPagamentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = readPaymentFilters(params);
  const page = readPage(params);
  const { rows, total, totals } = await listPayments(filters, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
        <p className="text-sm text-ink-muted">Recebidos por Pix, boleto e transferência (registrados à mão) e faturas pagas no Stripe.</p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Total label="Recebido no mês" cents={totals.month} />
        <Total label="Recebido no ano" cents={totals.year} />
        <Total label="Total do filtro" cents={totals.filtered} />
      </div>
      <form className="grid grid-cols-1 gap-2 sm:grid-cols-5" role="search" aria-label="Filtrar pagamentos">
        <select name="metodo" defaultValue={filters.method ?? ""} className={INPUT} aria-label="Método">
          <option value="">Todos os métodos</option>
          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABEL[method]}</option>)}
        </select>
        <select name="origem" defaultValue={filters.source ?? ""} className={INPUT} aria-label="Origem">
          <option value="">Manual e Stripe</option>
          <option value="manual">Só manual</option>
          <option value="stripe">Só Stripe</option>
        </select>
        <input type="date" name="de" defaultValue={one(params, "de")} className={INPUT} aria-label="De" />
        <input type="date" name="ate" defaultValue={one(params, "ate")} className={INPUT} aria-label="Até" />
        <div className="flex gap-2">
          <button type="submit" className={`${SECONDARY_BUTTON} flex-1`}>Filtrar</button>
          <Link href="/admin/pagamentos" className={SECONDARY_BUTTON}>Limpar</Link>
        </div>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-200 p-6 text-sm text-ink-muted">
          Nenhum pagamento ainda. Para registrar um Pix ou boleto, abra o cliente em Clientes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-300/60 text-xs uppercase tracking-wide text-ink-muted">
              <tr><th className="px-4 py-3">Pago em</th><th className="px-3">Cliente</th><th className="px-3">Valor</th><th className="px-3">Método</th><th className="px-3">Período</th><th className="px-3">Referência</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 tabular-nums">{formatDay(row.paidAt)}</td>
                  <td className="px-3">
                    <Link href={`/admin/workspaces/${row.subscription.workspace.id}`} className="font-semibold hover:text-primary hover:underline">{row.subscription.workspace.name}</Link>
                  </td>
                  <td className="px-3 font-semibold tabular-nums">{formatCents(row.amountCents, row.currency)}</td>
                  <td className="px-3">{PAYMENT_METHOD_LABEL[row.method]}{row.source === "stripe" ? " · Stripe" : ""}</td>
                  <td className="px-3 text-ink-muted">{formatDay(row.periodStart)} – {formatDay(row.periodEnd)}</td>
                  <td className="px-3 text-ink-muted">{row.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/pagamentos${withParams(params, { pagina: page - 1 })}`} className={SECONDARY_BUTTON}>Anterior</Link> : <span />}
          <span className="text-ink-muted">Página {page} de {pages}</span>
          {page < pages ? <Link href={`/admin/pagamentos${withParams(params, { pagina: page + 1 })}`} className={SECONDARY_BUTTON}>Próxima</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
