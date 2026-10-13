import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listPlans } from "@/lib/billing/admin";
import { NewClientForm } from "./NewClientForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo cliente · Administração · instachat" };

export default async function NovoClientePage() {
  const plans = await listPlans();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href="/admin/clientes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Clientes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-ink-muted">Cria a conta do cliente com o login do dono. Depois, o dono adiciona a equipe dele em Equipe.</p>
      </header>
      <NewClientForm
        plans={plans.filter((plan) => plan.isActive).map((plan) => ({ id: plan.id, name: plan.name, trialDays: plan.trialDays }))}
      />
    </div>
  );
}
