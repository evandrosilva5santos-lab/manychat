"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger mb-4 shadow-xs">
        <AlertCircle size={28} />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Ocorreu um erro ao carregar esta página
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        {error.message || "Falha de comunicação com o servidor ou banco de dados."}
      </p>
      {error.digest && (
        <span className="mt-2 text-xs font-mono text-ink-subtle">
          Código: {error.digest}
        </span>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary/90 cursor-pointer"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-200 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-300"
        >
          <Home size={16} />
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}
