"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#090a0f] text-[#f1f3f9] p-6 text-center font-sans">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-4 border border-rose-500/20">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Falha crítica na aplicação</h1>
        <p className="mt-2 max-w-md text-sm text-[#949bb2]">
          {error.message || "Ocorreu um erro inesperado no sistema."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
        >
          <RefreshCw size={16} />
          Recarregar aplicação
        </button>
      </body>
    </html>
  );
}
