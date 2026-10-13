"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user.trim() || !password) return;
    setError(null);
    startTransition(async () => {
      try {
        const credentials = btoa(`${user.trim()}:${password}`);
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${credentials}`,
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? "Credenciais inválidas.");
          return;
        }
        router.replace("/");
        router.refresh();
      } catch {
        setError("Erro de rede. Tente novamente.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">Usuário</span>
        <input
          type="text"
          autoComplete="username"
          required
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="rounded-xl border border-border bg-surface-100 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="fluxo"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">Senha</span>
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-100 px-3.5 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
            aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      {error && (
        <p className="rounded-xl bg-error/10 px-3.5 py-2.5 text-sm text-error font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus transition-all disabled:opacity-60"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
