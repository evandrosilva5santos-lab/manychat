import Link from "next/link";
import { Activity, Bot, CheckCircle2, CreditCard, MessageSquare, ShieldCheck, Users, XCircle } from "lucide-react";
import { AdminAccountActions } from "@/components/admin/AdminAccountActions";
import { getSubscriptionMetrics } from "@/lib/admin/console";
import { getMrrCents } from "@/lib/billing/admin";
import { formatCents } from "@/lib/billing/billing-cycle";
import { getAdminOverview, requireSuperAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administração · instachat",
  description: "Visão operacional de clientes e contas conectadas.",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: Date | null): string {
  if (!value) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function accountHealthy(status: string, tokenExpiresAt: Date | null): boolean {
  if (status !== "CONNECTED") return false;
  if (!tokenExpiresAt) return true;
  return tokenExpiresAt.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000;
}

export default async function AdminPage() {
  const [admin, overview, mrrCents, billing] = await Promise.all([requireSuperAdmin(), getAdminOverview(), getMrrCents(), getSubscriptionMetrics()]);
  const { metrics, clients } = overview;
  const cards = [
    { label: "Clientes", value: metrics.clientCount, description: "workspaces cadastrados", icon: Users, tone: "text-primary" },
    { label: "Contas do Instagram", value: metrics.instagramAccountCount, description: "perfis profissionais", icon: Bot, tone: "text-primary" },
    { label: "Conexões saudáveis", value: metrics.activeConnections, description: `${metrics.unhealthyConnections} exigem atenção`, icon: ShieldCheck, tone: "text-success" },
    { label: "Volume no mês", value: metrics.messagesThisMonth, description: `${formatNumber(metrics.flowsThisMonth)} automações processadas`, icon: MessageSquare, tone: "text-warning" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-7">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck size={15} aria-hidden /> Operação instachat
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Painel Super Admin</h1>
            <p className="mt-1 text-sm text-ink-muted">Acompanhamento global de clientes, canais conectados e automações.</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="rounded-xl border border-border bg-surface-100 px-4 py-3 text-sm">
              <p className="font-semibold text-ink">{admin.name}</p>
              <p className="text-xs text-ink-muted">{admin.email}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-ink-muted">
                MRR: <strong className="text-ink">{(mrrCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
              </span>
              <Link href="/admin/clientes/novo" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:underline">
                <CreditCard size={15} aria-hidden /> Novo cliente
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Assinaturas e receita">
          {[
            { label: "MRR", value: formatCents(mrrCents), href: "/admin/clientes" },
            { label: "Recebido no mês", value: formatCents(billing.receivedThisMonthCents), href: "/admin/pagamentos" },
            { label: "Ativos", value: formatNumber(billing.active), href: "/admin/clientes?status=ACTIVE" },
            { label: "Em teste", value: formatNumber(billing.trialing), href: "/admin/clientes?status=TRIALING" },
            { label: "Pagamento pendente", value: formatNumber(billing.pastDue), href: "/admin/clientes?status=PAST_DUE" },
            { label: "Cortesia", value: formatNumber(billing.complimentary), href: "/admin/clientes?cobranca=COMPLIMENTARY" },
          ].map((card) => (
            <Link key={card.label} href={card.href} className="rounded-2xl border border-border bg-surface-200 p-4 shadow-xs transition hover:border-border-strong">
              <span className="text-xs font-semibold text-ink-muted">{card.label}</span>
              <p className="mt-2 text-xl font-extrabold tabular-nums tracking-tight text-ink">{card.value}</p>
            </Link>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Métricas globais">
          {cards.map(({ label, value, description, icon: Icon, tone }) => (
            <article key={label} className="rounded-2xl border border-border bg-surface-200 p-5 shadow-xs transition hover:border-border-strong">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-muted">{label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface-300 ${tone}`}><Icon size={18} /></span>
              </div>
              <p className="mt-5 text-3xl font-extrabold tracking-tight text-ink">{formatNumber(value)}</p>
              <p className="mt-1 text-xs text-ink-muted">{description}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface-200 shadow-xs">
          <div className="flex flex-col gap-1 border-b border-border px-5 py-5 sm:px-6">
            <h2 className="text-lg font-bold">Clientes e contas vinculadas</h2>
            <p className="text-sm text-ink-muted">Dados operacionais reais de cada workspace.</p>
          </div>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Activity size={28} className="text-ink-subtle" aria-hidden />
              <p className="font-semibold">Nenhum cliente cadastrado</p>
              <p className="max-w-md text-sm text-ink-muted">Os clientes e suas contas conectadas aparecerão aqui quando o primeiro workspace for criado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1060px] w-full text-left text-sm">
                <thead className="bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-5 py-3.5 sm:px-6">Cliente</th>
                    <th className="px-5 py-3.5">Contas vinculadas</th>
                    <th className="px-5 py-3.5 text-center">Contas</th>
                    <th className="px-5 py-3.5">Conexão</th>
                    <th className="px-5 py-3.5">Última atividade</th>
                    <th className="px-5 py-3.5">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((client) => {
                    const healthy = client.accounts.filter((account) => accountHealthy(account.status, account.tokenExpiresAt));
                    const latestActivity = client.accounts.reduce<Date | null>((latest, account) => !latest || (account.lastActivityAt && account.lastActivityAt > latest) ? account.lastActivityAt : latest, null);
                    return (
                      <tr key={client.workspaceId} className="align-top transition hover:bg-surface-100/70">
                        <td className="px-5 py-5 sm:px-6">
                          <p className="font-semibold text-ink">{client.owner.name}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">{client.owner.email}</p>
                          <p className="mt-2 text-[11px] text-ink-subtle">{client.workspaceName} · desde {formatDate(client.owner.createdAt)}</p>
                        </td>
                        <td className="px-5 py-5">
                          <div className="flex max-w-sm flex-col gap-2">
                            {client.accounts.length === 0 ? <span className="text-xs text-ink-subtle">Nenhuma conta conectada</span> : client.accounts.map((account) => (
                              <div key={account.id} className="flex items-center gap-2.5">
                                {account.profilePicUrl ? <img src={account.profilePicUrl} alt="" className="h-7 w-7 rounded-full border border-border object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-300 text-[10px] font-bold text-ink-muted">IG</span>}
                                <div className="min-w-0"><p className="truncate text-xs font-semibold">@{account.username}</p><p className="truncate font-mono text-[10px] text-ink-subtle">{account.igUserId}</p></div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-5 text-center font-mono text-base font-semibold">{client.accounts.length}</td>
                        <td className="px-5 py-5">
                          {client.accounts.length === 0 ? <span className="fx-badge fx-badge-draft">Sem conta</span> : healthy.length === client.accounts.length ? <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success"><CheckCircle2 size={13} /> Ativo</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger"><XCircle size={13} /> Reconexão necessária</span>}
                        </td>
                        <td className="px-5 py-5 text-xs text-ink-muted">{formatDate(latestActivity)}</td>
                        <td className="px-5 py-5">
                          <div className="flex flex-col items-start gap-2">
                            {client.accounts.length ? <AdminAccountActions workspaceId={client.workspaceId} accountId={client.accounts[0].id} username={client.accounts[0].username} /> : <span className="text-xs text-ink-subtle">Aguardando conexão</span>}
                            <Link href={`/admin/workspaces/${client.workspaceId}`} className="text-xs font-semibold text-primary hover:underline">Plano e cobrança</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
