import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandLogo";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { FEATURES, LIMIT_KEYS, LIMIT_LABELS } from "@/lib/billing/plan-rules";
import { isPublicSignupEnabled } from "@/lib/billing/signup";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Preços · instachat",
  description: "Planos do instachat para automatizar comentários e Direct do Instagram.",
};

function price(cents: number): string {
  return cents > 0 ? `${(cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês` : "Sob consulta";
}

function limitText(value: number | null): string {
  return value === null ? "Ilimitado" : value.toLocaleString("pt-BR");
}

export default async function PrecosPage() {
  const plans = await prisma.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } });
  const signupOpen = isPublicSignupEnabled();

  return (
    <main className="min-h-screen bg-surface-100 px-4 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col items-center gap-4 text-center">
          <BrandWordmark height={32} />
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Responda todo comentário e Direct, no automático</h1>
          <p className="max-w-xl text-base text-ink-muted">Escolha o plano pelo tamanho da sua operação no Instagram. Troque ou cancele quando quiser.</p>
        </header>

        {plans.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">Os planos estão sendo preparados. Volte em breve.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan, index) => {
              const featured = plans.length > 2 && index === 1;
              return (
                <li
                  key={plan.id}
                  className={`flex flex-col gap-5 rounded-2xl border bg-surface-200 p-6 ${featured ? "border-primary shadow-md md:-translate-y-2" : "border-border shadow-xs"}`}
                >
                  <div className="flex flex-col gap-1">
                    {featured && <span className="text-xs font-bold uppercase tracking-wide text-primary">Mais escolhido</span>}
                    <h2 className="text-xl font-bold text-ink">{plan.name}</h2>
                    {plan.description && <p className="text-sm text-ink-muted">{plan.description}</p>}
                  </div>
                  <p className="text-2xl font-extrabold text-ink">{price(plan.priceMonthlyCents)}</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {LIMIT_KEYS.map((key) => (
                      <li key={key} className="flex justify-between gap-3 border-b border-border pb-1.5">
                        <span className="text-ink-muted first-letter:uppercase">{LIMIT_LABELS[key]}</span>
                        <span className="font-semibold tabular-nums text-ink">{limitText(plan[key])}</span>
                      </li>
                    ))}
                    {(Object.keys(FEATURES) as (keyof typeof FEATURES)[])
                      .filter((key) => plan.features.includes(key))
                      .map((key) => (
                        <li key={key} className="flex items-center gap-2 text-ink">
                          <Check size={15} className="text-success" aria-hidden /> {FEATURES[key]}
                        </li>
                      ))}
                  </ul>
                  <div className="mt-auto">
                    {signupOpen ? (
                      <Link href={`/cadastro?plano=${encodeURIComponent(plan.slug)}`} className={`${featured ? PRIMARY_BUTTON : SECONDARY_BUTTON} w-full`}>
                        {plan.trialDays > 0 ? `Testar ${plan.trialDays} dias grátis` : `Começar com o ${plan.name}`}
                      </Link>
                    ) : (
                      <p className="text-center text-sm text-ink-muted">Cadastro em breve</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-center text-sm text-ink-muted">
          Já tem conta? <Link href="/login" className="font-semibold text-primary underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
