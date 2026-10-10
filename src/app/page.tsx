import Link from "next/link";
import {
  AlertTriangle,
  Plus,
  Users,
  MessageSquare,
  Zap,
  TrendingUp,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { getStoredContacts, getStoredMessages, listStoredFlows } from "@/lib/storage/store";

export const metadata = {
  title: "Painel · Fluxo",
  description: "Visão geral e métricas das suas automações do Instagram",
};

export default async function DashboardPage() {
  const [contacts, flows] = await Promise.all([
    getStoredContacts(),
    listStoredFlows(),
  ]);

  const liveFlows = flows.filter((f) => f.status === "LIVE").length;
  const stoppedFlows = flows.filter((f) => f.status === "STOPPED").length;
  const draftFlows = flows.filter((f) => f.status === "DRAFT").length;
  const active24h = contacts.filter((c) => c.is24hActive).length;

  let totalSentMessages = 0;
  for (const c of contacts) {
    const msgs = await getStoredMessages(c.id);
    totalSentMessages += msgs.filter((m) => m.direction === "OUT").length;
  }

  const stats = [
    {
      label: "Contatos",
      value: String(contacts.length),
      sub: `${active24h} ativos na janela 24h`,
      subColor: "text-emerald-500 font-semibold",
      icon: Users,
    },
    {
      label: "Mensagens enviadas",
      value: String(totalSentMessages),
      sub: "automáticas e respostas",
      subColor: "text-ink-muted",
      icon: MessageSquare,
    },
    {
      label: "Automações ao vivo",
      value: String(liveFlows),
      sub: `${stoppedFlows} parada${stoppedFlows !== 1 ? "s" : ""} · ${draftFlows} rascunho${draftFlows !== 1 ? "s" : ""}`,
      subColor: "text-ink-muted",
      icon: Zap,
    },
    {
      label: "Taxa de clique (CTR)",
      value: "67%",
      sub: "média das automações",
      subColor: "text-primary font-bold",
      icon: TrendingUp,
    },
  ];

  const colors = [
    "bg-blue-500/10 text-blue-500",
    "bg-emerald-500/10 text-emerald-500",
    "bg-amber-500/10 text-amber-500",
    "bg-purple-500/10 text-purple-500",
  ];

  const recentChats = await Promise.all(
    contacts.slice(0, 4).map(async (c, idx) => {
      const msgs = await getStoredMessages(c.id);
      const lastMsg = msgs[msgs.length - 1];
      return {
        avatar: c.name?.slice(0, 1) || c.username?.slice(0, 1).toUpperCase() || "IG",
        color: colors[idx % colors.length],
        username: `@${c.username}`,
        action: lastMsg?.text ? lastMsg.text.replace(/\n+/g, " ").slice(0, 42) : "Interagiu com automação",
        time: c.remainingHours24h > 0 ? `${24 - c.remainingHours24h}h atrás` : "ontem",
      };
    })
  );

  const chartBars = [30, 42, 38, 55, 48, 36, 44, 60, 58, 70, 64, 76, 82, 92];

  return (
    <main className="fx mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      {/* ── Banner de Alerta / Meta ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-ink shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
            <AlertTriangle size={20} />
          </div>
          <div className="text-sm">
            <strong className="font-bold text-ink">Canal Instagram conectado: </strong>
            <span className="text-ink-muted">
              Perfil <b className="text-ink">@movingfestival</b> ativo para responder comentários e DMs.
            </span>
          </div>
        </div>
        <Link
          href="/ajustes"
          className="flex-none rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs"
        >
          Ver Ajustes
        </Link>
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink leading-tight">
            Bom dia, Evandro
          </h1>
          <p className="text-[15px] text-ink-muted">
            O que aconteceu no seu Instagram nas últimas 24 horas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/fluxos"
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
              <h2 className="text-[18px] font-bold text-ink">Mensagens por dia</h2>
              <span className="text-xs text-ink-muted">Últimos 14 dias</span>
            </div>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md">
              +18% vs semana anterior
            </span>
          </div>

          {/* Barras do Gráfico */}
          <div className="flex-1 flex items-end gap-2.5 pt-8 pb-2 border-b border-border min-h-[180px]">
            {chartBars.map((height, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
              >
                <div
                  style={{ height: `${height}%` }}
                  className={`w-full rounded-t-md transition-all ${
                    i === chartBars.length - 1
                      ? "bg-primary shadow-sm"
                      : "bg-primary/25 hover:bg-primary/50"
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted pt-2">
            <span>11 set</span>
            <span>Hoje (412 envios)</span>
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

            <div className="flex flex-col divide-y divide-border">
              {recentChats.map((chat) => (
                <div
                  key={chat.username}
                  className="flex items-center gap-3 py-3 hover:bg-surface-300/40 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <div
                    className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold text-xs ${chat.color}`}
                  >
                    {chat.avatar}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] font-bold text-ink truncate">
                      {chat.username}
                    </span>
                    <span className="text-[12px] text-ink-muted truncate">
                      {chat.action}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-ink-subtle flex-none">
                    {chat.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/fluxos/demo-casamento"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-surface-300/60 hover:bg-surface-300 p-2.5 text-xs font-semibold text-ink transition-all"
          >
            <span>Ver automação ativa “[2026] Casamento por DM”</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </main>
  );
}
