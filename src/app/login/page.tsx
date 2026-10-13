import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandWordmark } from "@/components/brand/BrandLogo";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar · instachat",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-100 px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <BrandWordmark height={32} />
          <p className="text-sm text-ink-muted text-center">
            Automações inteligentes para o seu Instagram
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface-200 p-7 shadow-sm">
          <h1 className="text-[20px] font-extrabold text-ink mb-1">Bem-vindo de volta</h1>
          <p className="text-sm text-ink-muted mb-6">Entre com seu e-mail e senha para continuar.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-ink-subtle">
          instachat by Start Company · Automação de Instagram
        </p>
      </div>
    </main>
  );
}
