import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listPlans } from "@/lib/billing/admin";
import { PlanForm, type PlanFormValues } from "./PlanForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Planos · Administração · instachat" };

export default async function AdminPlanosPage() {
  const plans = await listPlans();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Painel Super Admin
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Planos</h1>
        <p className="text-sm text-ink-muted">
          Limite vazio = ilimitado. Recurso desmarcado = bloqueado. Sem ID de preço do Stripe, o plano não aparece no checkout.
        </p>
      </header>
      {plans.map((plan) => (
        <PlanForm key={plan.id} planId={plan.id} subscribers={plan._count.subscriptions} initial={toValues(plan)} />
      ))}
      <PlanForm planId={null} subscribers={0} initial={null} />
    </main>
  );
}

function toValues(plan: Awaited<ReturnType<typeof listPlans>>[number]): PlanFormValues {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    isPublic: plan.isPublic,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    priceMonthlyCents: plan.priceMonthlyCents,
    trialDays: plan.trialDays,
    graceDays: plan.graceDays,
    stripePriceId: plan.stripePriceId,
    maxInstagramAccounts: plan.maxInstagramAccounts,
    maxMembers: plan.maxMembers,
    maxActiveFlows: plan.maxActiveFlows,
    maxDmsPerMonth: plan.maxDmsPerMonth,
    features: plan.features,
  };
}
