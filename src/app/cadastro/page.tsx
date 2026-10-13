import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand/BrandLogo";
import { isPublicSignupEnabled } from "@/lib/billing/signup";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar conta · instachat" };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-100 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <BrandWordmark height={32} />
        </div>
        <div className="rounded-2xl border border-border bg-surface-200 p-7 shadow-sm">
          {isPublicSignupEnabled() ? (
            <>
              <h1 className="mb-1 text-[20px] font-extrabold text-ink">Criar sua conta</h1>
              <p className="mb-6 text-sm text-ink-muted">Em seguida você conecta o Instagram e cria a primeira automação.</p>
              <SignupForm plan={plano ?? ""} />
            </>
          ) : (
            <>
              <h1 className="mb-2 text-[20px] font-extrabold text-ink">Cadastro em breve</h1>
              <p className="text-sm text-ink-muted">Ainda estamos abrindo as vagas. Fale com a gente para começar agora.</p>
            </>
          )}
        </div>
        <p className="text-center text-sm text-ink-muted">
          Já tem conta? <Link href="/login" className="font-semibold text-primary underline">Entrar</Link> ·{" "}
          <Link href="/precos" className="font-semibold text-primary underline">Ver preços</Link>
        </p>
      </div>
    </main>
  );
}
