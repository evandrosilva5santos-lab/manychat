import Link from "next/link";
import { AlertCircle, ArrowLeft, Home, Zap } from "lucide-react";

export default function NotFound() {
  return (
    <main className="fx mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 p-8 text-center my-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-200 border border-border text-danger shadow-card">
        <AlertCircle size={32} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-danger">
          Erro 404
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Página não encontrada
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          O link que você tentou acessar não existe, foi removido ou o identificador da automação é inválido.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <Link href="/fluxos" className="fx-btn fx-btn-primary">
          <Zap size={16} aria-hidden /> Minhas Automações
        </Link>
        <Link href="/" className="fx-btn">
          <Home size={16} aria-hidden /> Ir para o Painel
        </Link>
      </div>
    </main>
  );
}
