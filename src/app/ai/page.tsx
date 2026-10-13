import Link from "next/link";
import { Bot, Sparkles, ArrowLeft, Zap, MessageSquare, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Agentes de IA · instachat",
  description: "Crie agentes de IA inteligentes para atender e qualificar leads 24h no Instagram Direct.",
};

export default function AiAgentsPage() {
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink">Agentes de IA</h1>
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                Em breve
              </span>
            </div>
            <p className="text-sm text-ink-muted mt-0.5">
              Atendimento autônomo e qualificação inteligente de leads com IA generativa no Instagram Direct.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300 text-ink">
            <Sparkles size={20} />
          </div>
          <h2 className="text-sm font-bold text-ink">Respostas Humanizadas</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Treine seu agente com FAQs, catálogos e informações do seu negócio para tirar dúvidas complexas.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300 text-ink">
            <Zap size={20} />
          </div>
          <h2 className="text-sm font-bold text-ink">Gatilhos Híbridos</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Combine fluxos fixos de comentários com transição suave para conversa fluida com o agente.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300 text-ink">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-sm font-bold text-ink">Segurança & Moderação</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Controle absoluto de guardrails para evitar respostas inadequadas ou alucinações.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-surface-200/50 p-8 text-center flex flex-col items-center gap-3">
        <Bot size={36} className="text-ink-subtle" />
        <h3 className="text-base font-bold text-ink">Módulo em fase de homologação</h3>
        <p className="text-xs text-ink-muted max-w-md">
          A integração com os modelos de IA da Meta está sendo preparada para a próxima versão. Enquanto isso, aproveite as automações rápidas e o fluxo avançado!
        </p>
        <Link href="/fluxos" className="fx-btn fx-btn-primary mt-2">
          Ver Minhas Automações
        </Link>
      </div>
    </main>
  );
}
