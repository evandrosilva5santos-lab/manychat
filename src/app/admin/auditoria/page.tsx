import type { Metadata } from "next";
import Link from "next/link";
import { INPUT, SECONDARY_BUTTON } from "@/components/ui/styles";
import { listAudit } from "@/lib/admin/console";
import { PAGE_SIZE, readAuditFilters, readPage, withParams } from "@/lib/admin/filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auditoria · Administração · instachat" };

type SearchParams = Record<string, string | string[] | undefined>;

const ACTION_LABEL: Record<string, string> = {
  "plan.create": "Plano criado",
  "plan.update": "Plano alterado",
  "subscription.set": "Assinatura alterada",
  "payment.record": "Pagamento registrado",
  "user.password_reset": "Senha redefinida",
  "client.create": "Cliente criado",
};

export default async function AdminAuditoriaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = readAuditFilters(params);
  const page = readPage(params);
  const { rows, total, actions, workspaceNames } = await listAudit(filters, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-sm text-ink-muted">Tudo o que foi alterado no console: quem fez, quando e o que mudou. {total} registro(s).</p>
      </header>
      <form className="flex flex-col gap-2 sm:flex-row" role="search" aria-label="Filtrar auditoria">
        <select name="acao" defaultValue={filters.action ?? ""} className={INPUT} aria-label="Ação">
          <option value="">Todas as ações</option>
          {actions.map((action) => <option key={action} value={action}>{ACTION_LABEL[action] ?? action}</option>)}
        </select>
        {filters.workspaceId && <input type="hidden" name="cliente" value={filters.workspaceId} />}
        <button type="submit" className={SECONDARY_BUTTON}>Filtrar</button>
        <Link href="/admin/auditoria" className={SECONDARY_BUTTON}>Limpar</Link>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-200 p-6 text-sm text-ink-muted">Nenhum registro com esses filtros.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface-200">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <p className="text-ink">
                <strong>{ACTION_LABEL[row.action] ?? row.action}</strong>
                {row.workspaceId && (
                  <> · <Link href={`/admin/workspaces/${row.workspaceId}`} className="font-semibold text-primary hover:underline">{workspaceNames.get(row.workspaceId) ?? "cliente"}</Link></>
                )}
                <span className="text-ink-muted"> · {row.actorEmail} · {row.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink-muted">{JSON.stringify(row.changes)}</pre>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/auditoria${withParams(params, { pagina: page - 1 })}`} className={SECONDARY_BUTTON}>Anterior</Link> : <span />}
          <span className="text-ink-muted">Página {page} de {pages}</span>
          {page < pages ? <Link href={`/admin/auditoria${withParams(params, { pagina: page + 1 })}`} className={SECONDARY_BUTTON}>Próxima</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
