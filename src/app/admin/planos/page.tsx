import type { Metadata } from "next";
import { listPlans } from "@/lib/billing/admin";
import { PlanForm, type PlanFormValues } from "./PlanForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Planos · Administração · instachat" };

export default async function AdminPlanosPage() {
  const plans = await listPlans();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Planos</h1>
        <p className="text-sm text-ink-muted">
          Limite vazio = ilimitado. Recurso desmarcado = bloqueado. Sem ID de preço do Stripe, o plano não aparece no checkout.
        </p>
      </header>
      {plans.map((plan) => (
        <PlanForm key={plan.id} planId={plan.id} subscribers={plan._count.subscriptions} initial={toValues(plan)} />
      ))}
      <PlanForm planId={null} subscribers={0} initial={null} />
    </div>
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
    priceYearlyCents: plan.priceYearlyCents,
    trialDays: plan.trialDays,
    graceDays: plan.graceDays,
    stripePriceId: plan.stripePriceId,
    stripeYearlyPriceId: plan.stripeYearlyPriceId,
    maxInstagramAccounts: plan.maxInstagramAccounts,
    maxMembers: plan.maxMembers,
    maxActiveFlows: plan.maxActiveFlows,
    maxDmsPerMonth: plan.maxDmsPerMonth,
    features: plan.features,
  };
}
