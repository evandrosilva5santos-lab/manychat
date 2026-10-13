import Link from "next/link";
import {
  AlertTriangle,
  Plus,
  Users,
  MessageSquare,
  Zap,
  ArrowRight,
  CheckCircle2,
  Inbox,
  PauseCircle,
} from "lucide-react";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/format";
import { isAccountConnected, pausedFlowLabel } from "@/components/layout/account-status";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Painel · instachat",
  description: "Visão geral e métricas das suas automações do Instagram",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Instante de N dias atrás (fora do componente: o painel é renderizado por requisição). */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

type RecentContact = Prisma.ContactGetPayload<{ include: { messages: true } }>;

export default async function DashboardPage() {
  const account = await getCurrentAccount();

  let contactCount = 0;
  let active24h = 0;
  let totalSentMessages = 0;
  let totalReceivedMessages = 0;
  let liveFlows = 0;
  let stoppedFlows = 0;
  let draftFlows = 0;
  let recentContacts: RecentContact[] = [];
  const dailyCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

  if (account) {
    const yesterday = daysAgo(1);
    const sevenDaysAgo = daysAgo(7);

    const [
      cCount,
      a24Count,
      sentCount,
      inCount,
      liveCount,
      stopCount,
      dftCount,
      recent,
      recentMsgs,
    ] = await Promise.all([
      prisma.contact.count({ where: { accountId: account.id } }),
      prisma.contact.count({
        where: { accountId: account.id, lastInboundAt: { gte: yesterday } },
      }),
      prisma.message.count({
        where: { accountId: account.id, direction: "OUT" },
      }),
      prisma.message.count({
        where: { accountId: account.id, direction: "IN" },
      }),
      prisma.flow.count({
        where: { accountId: account.id, status: "LIVE" },
      }),
      prisma.flow.count({
        where: { accountId: account.id, status: "STOPPED" },
      }),
      prisma.flow.count({
        where: { accountId: account.id, status: "DRAFT" },
      }),
      prisma.contact.findMany({
        where: { accountId: account.id },
        orderBy: { lastInteractionAt: "desc" },
        take: 5,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.message.findMany({
        where: {
          accountId: account.id,
          direction: "OUT",
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true },
      }),
    ]);

    contactCount = cCount;
    active24h = a24Count;
    totalSentMessages = sentCount;
    totalReceivedMessages = inCount;
    liveFlows = liveCount;
    stoppedFlows = stopCount;
    draftFlows = dftCount;
    recentContacts = recent;

    // Agrupamento real por dia dos últimos 7 dias
    const now = new Date();
    for (const msg of recentMsgs) {
      const diffDays = Math.floor(
        (now.getTime() - new Date(msg.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (diffDays >= 0 && diffDays < 7) {
        dailyCounts[6 - diffDays] = (dailyCounts[6 - diffDays] || 0) + 1;
      }
    }
  }

  const connected = isAccountConnected(account?.status);
  // Automação "ao vivo" num perfil que não está conectado não roda: diz isso em vez de enganar.
  const livePaused = liveFlows > 0 ? pausedFlowLabel(account?.status) : null;

  const stats: Array<{
    label: string;
    value: string;
    sub: string;
    subColor: string;
    icon: typeof Users;
    pausedNote?: string | null;
  }> = [
    {
      label: "Contatos",
      value: String(contactCount),
      sub: `${active24h} ativos na janela 24h`,
      subColor: "text-success font-semibold",
      icon: Users,
    },
    {
      label: "DMs enviadas",
      value: String(totalSentMessages),
      sub: "respostas e mensagens automáticas",
      subColor: "text-ink-muted",
      icon: MessageSquare,
    },
    {
      label: "Automações ao vivo",
      value: String(liveFlows),
      sub: `${stoppedFlows} parada${stoppedFlows !== 1 ? "s" : ""} · ${draftFlows} rascunho${draftFlows !== 1 ? "s" : ""}`,
      subColor: "text-ink-muted",
      icon: Zap,
      pausedNote: livePaused,
    },
    {
      label: "Mensagens recebidas",
      value: String(totalReceivedMessages),
      sub: "inbounds de seguidores e leads",
      subColor: "text-primary font-semibold",
      icon: Inbox,
    },
  ];

  const maxCount = Math.max(...dailyCounts, 1);

  return (
    <main className="fx mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      {/* ── Banner de Conexão com o Instagram ─────────────────────────────── */}
      {account && connected ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-success/30 bg-success-soft p-4 text-ink shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success-soft text-success">
              <CheckCircle2 size={20} />
            </div>
            <div className="text-sm">
              <strong className="font-bold text-ink">Canal Instagram conectado: </strong>
              <span className="text-ink-muted">
                Perfil <b className="text-ink">@{account.username}</b> ({account.name || "Conta profissional"}) ativo para automações.
              </span>
            </div>
          </div>
          <Link
            href="/ajustes"
            className="flex-none rounded-xl bg-surface-100 hover:bg-surface-200 text-ink border border-border px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs"
          >
            Ajustes
          </Link>
        </div>
      ) : account ? null : (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-ink shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-warning-soft text-warning">
              <AlertTriangle size={20} />
            </div>
            <div className="text-sm">
              <strong className="font-bold text-ink">Nenhuma conta Instagram conectada: </strong>
              <span className="text-ink-muted">
                Conecte seu Instagram profissional para ativar respostas e automações.
              </span>
            </div>
          </div>
          <Link
            href="/ajustes"
            className="flex-none rounded-xl bg-warning hover:opacity-90 text-on-primary px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs"
          >
            Conectar Instagram
          </Link>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink leading-tight">
            Painel Geral
          </h1>
          <p className="text-[15px] text-ink-muted">
            Métricas em tempo real das interações no seu Instagram.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/fluxos/novo"
            className="fx-btn fx-btn-primary flex items-center gap-2 shadow-sm font-bold"
          >
            <Plus size={16} />
            <span>Nova automação</span>
          </Link>
        </div>
      </div>

      {/* ── 4 Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-5 shadow-xs hover:border-border-strong transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-muted">
                  {stat.label}
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-300 flex items-center justify-center text-ink-muted group-hover:text-primary transition-colors">
                  <Icon size={16} />
                </div>
              </div>

              <div className="mt-4 flex flex-col">
                <span className="text-[32px] font-extrabold text-ink leading-none font-mono">
                  {stat.value}
                </span>
                <span className={`text-[12px] mt-2 ${stat.subColor}`}>
                  {stat.sub}
                </span>
                {stat.pausedNote && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] font-semibold text-warning">
                    <PauseCircle size={13} aria-hidden />
                    {stat.pausedNote}
                    <Link href="/ajustes" className="text-primary underline underline-offset-2">
                      Ver motivo
                    </Link>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Gráfico & Últimas Conversas ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[380px]">
        {/* Gráfico de Mensagens (7 colunas) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-bold text-ink">Envios automáticos por dia</h2>
              <span className="text-xs text-ink-muted">Últimos 7 dias (dados reais do banco)</span>
            </div>
            <span className="text-xs font-semibold text-ink-muted bg-surface-300 px-2.5 py-1 rounded-md">
              Total: {totalSentMessages} envios
            </span>
          </div>

          {/* Barras do Gráfico */}
          <div className="flex-1 flex items-end gap-3 pt-8 pb-2 border-b border-border min-h-[180px]">
            {dailyCounts.map((count, i) => {
              const heightPct = Math.max(Math.round((count / maxCount) * 100), count > 0 ? 10 : 4);
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                  title={`${count} mensagens`}
                >
                  <span className="text-[10px] font-mono text-ink-subtle opacity-0 group-hover:opacity-100 transition-opacity">
                    {count}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all ${
                      count > 0 ? "bg-primary shadow-sm" : "bg-surface-300"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted pt-2">
            <span>7 dias atrás</span>
            <span>Hoje ({dailyCounts[6]} envios)</span>
          </div>
        </div>

        {/* Últimas Conversas (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-bold text-ink">Últimas conversas</h2>
              <Link
                href="/conversas"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Ver todas</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {recentContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-ink-muted">
                <Inbox size={32} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhuma conversa registrada ainda.</p>
                <p className="text-xs text-ink-subtle">
                  As interações de comentários e DMs aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {recentContacts.map((contact) => {
                  const lastMsg = contact.messages[0];
                  const initial =
                    contact.name?.slice(0, 1) || contact.username?.slice(0, 1).toUpperCase() || "C";
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 py-3 hover:bg-surface-300/40 px-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold text-xs bg-primary/10 text-primary">
                        {initial}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-bold text-ink truncate">
                          {contact.name || `@${contact.username || contact.igsid}`}
                        </span>
                        <span className="text-[12px] text-ink-muted truncate">
                          {lastMsg?.text ? lastMsg.text.replace(/\n+/g, " ").slice(0, 42) : "Interagiu com automação"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-ink-subtle flex-none">
                        {timeAgo(contact.lastInteractionAt || contact.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/fluxos"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-surface-300/60 hover:bg-surface-300 p-2.5 text-xs font-semibold text-ink transition-all"
          >
            <span>Gerenciar todas as automações</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </main>
  );
}
