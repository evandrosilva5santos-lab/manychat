import Link from "next/link";
import { FeatureLocked } from "@/components/billing/FeatureLocked";
import { canUseFeature } from "@/lib/access/context";
import { Send, Users, ArrowLeft, Radio, Clock, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Transmissão · instachat",
  description: "Dispare mensagens e comunicados segmentados para seus contatos dentro da política da Meta.",
};

export default async function DirectBroadcastPage() {
  const { allowed, context } = await canUseFeature("broadcast");
  if (!allowed) return <FeatureLocked feature="broadcast" role={context?.menuRole ?? null} />;
  return (
    <main className="fx mx-auto flex w-full max-w-4xl flex-col gap-8 p-8">
      <div>
        <Link
          href="/fluxos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Voltar para Automações
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary border border-primary/20">
            <Send size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink">Transmissão & Broadcast</h1>
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                Em breve
              </span>
            </div>
            <p className="text-sm text-ink-muted mt-0.5">
              Envie mensagens em lote e comunicados para bases segmentadas respeitando as diretrizes oficiais da Meta.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300 text-ink">
            <Clock size={20} />
          </div>
          <h2 className="text-sm font-bold text-ink">Janela de 24h Meta</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Filtro automático de segurança para disparar somente para seguidores que interagiram nas últimas 24 horas.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300 text-ink">
            <Users size={20} />
          </div>
          <h2 className="text-sm font-bold text-ink">Segmentação por Etiquetas</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Filtre por tags como “lead-quente”, “casamento-2026” ou “cliente” para mensagens hiper-personalizadas.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300 text-ink">
            <Radio size={20} />
          </div>
          <h2 className="text-sm font-bold text-ink">Taxa de Abertura Real</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Métricas de entrega, leitura e cliques em links em tempo real para cada disparo realizado.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-surface-200/50 p-8 text-center flex flex-col items-center gap-3">
        <Send size={36} className="text-ink-subtle" />
        <h3 className="text-base font-bold text-ink">Módulo de Transmissão em Desenvolvimento</h3>
        <p className="text-xs text-ink-muted max-w-md">
          A fila com controle de vazão (rate limiting) para evitar bloqueios no Instagram está em fase final de testes.
        </p>
        <Link href="/conversas" className="fx-btn fx-btn-primary mt-2">
          Abrir Live Inbox (Conversas)
        </Link>
      </div>
    </main>
  );
}
