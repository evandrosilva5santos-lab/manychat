"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { FEATURES, LIMIT_KEYS, LIMIT_LABELS } from "@/lib/billing/plan-rules";
import { savePlanAction, type AdminActionState } from "./actions";

export type PlanFormValues = {
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  priceMonthlyCents: number;
  trialDays: number;
  graceDays: number;
  stripePriceId: string | null;
  maxInstagramAccounts: number | null;
  maxMembers: number | null;
  maxActiveFlows: number | null;
  maxDmsPerMonth: number | null;
  features: string[];
};

const EMPTY: PlanFormValues = {
  slug: "", name: "", description: null, isPublic: true, isActive: true, sortOrder: 100, priceMonthlyCents: 0,
  trialDays: 0, graceDays: 7, stripePriceId: null, maxInstagramAccounts: 1, maxMembers: 1, maxActiveFlows: 5,
  maxDmsPerMonth: 1000, features: [],
};

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}
function optionalInt(data: FormData, key: string): number | null {
  const raw = text(data, key);
  return raw === "" ? null : Number(raw);
}

/** Lê o formulário no formato que o servidor valida (o servidor confere tudo de novo). */
function readForm(data: FormData): PlanFormValues {
  return {
    slug: text(data, "slug"),
    name: text(data, "name"),
    description: text(data, "description") || null,
    isPublic: data.get("isPublic") === "on",
    isActive: data.get("isActive") === "on",
    sortOrder: Number(text(data, "sortOrder") || 0),
    priceMonthlyCents: Math.round(Number(text(data, "price").replace(",", ".") || 0) * 100),
    trialDays: Number(text(data, "trialDays") || 0),
    graceDays: Number(text(data, "graceDays") || 0),
    stripePriceId: text(data, "stripePriceId") || null,
    maxInstagramAccounts: optionalInt(data, "maxInstagramAccounts"),
    maxMembers: optionalInt(data, "maxMembers"),
    maxActiveFlows: optionalInt(data, "maxActiveFlows"),
    maxDmsPerMonth: optionalInt(data, "maxDmsPerMonth"),
    features: data.getAll("features").map(String),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink first-letter:uppercase">{label}</span>
      {children}
    </label>
  );
}

export function PlanForm({ planId, subscribers, initial }: { planId: string | null; subscribers: number; initial: PlanFormValues | null }) {
  const values = initial ?? EMPTY;
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminActionState | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = readForm(new FormData(form));
    startTransition(async () => {
      const result = await savePlanAction(planId, input);
      setFeedback(result);
      if (result.ok && !planId) form.reset();
    });
  }

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4`} aria-label={planId ? `Plano ${values.name}` : "Novo plano"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-ink">{planId ? values.name : "Novo plano"}</h2>
        {planId && <span className="text-xs text-ink-muted">{subscribers} workspace(s) neste plano</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Nome"><input name="name" required maxLength={60} defaultValue={values.name} className={INPUT} /></Field>
        <Field label="Identificador"><input name="slug" required defaultValue={values.slug} pattern="[a-z0-9\-]{2,40}" className={INPUT} /></Field>
        <Field label="Ordem"><input name="sortOrder" type="number" min={0} defaultValue={values.sortOrder} className={INPUT} /></Field>
      </div>
      <Field label="Descrição"><input name="description" maxLength={200} defaultValue={values.description ?? ""} className={INPUT} /></Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Preço mensal (R$)">
          <input name="price" inputMode="decimal" defaultValue={(values.priceMonthlyCents / 100).toFixed(2)} className={INPUT} />
        </Field>
        <Field label="Dias de teste"><input name="trialDays" type="number" min={0} max={90} defaultValue={values.trialDays} className={INPUT} /></Field>
        <Field label="Dias de carência"><input name="graceDays" type="number" min={0} max={60} defaultValue={values.graceDays} className={INPUT} /></Field>
        <Field label="ID de preço no Stripe">
          <input name="stripePriceId" placeholder="price_..." defaultValue={values.stripePriceId ?? ""} className={INPUT} />
        </Field>
      </div>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold text-ink-muted">Limites (vazio = ilimitado)</legend>
        {LIMIT_KEYS.map((key) => (
          <Field key={key} label={LIMIT_LABELS[key]}>
            <input name={key} type="number" min={0} defaultValue={values[key] ?? ""} className={INPUT} />
          </Field>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-xs font-semibold text-ink-muted">Recursos liberados</legend>
        {(Object.keys(FEATURES) as (keyof typeof FEATURES)[]).map((key) => (
          <label key={key} className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="features" value={key} defaultChecked={values.features.includes(key)} /> {FEATURES[key]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isActive" defaultChecked={values.isActive} /> Ativo
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isPublic" defaultChecked={values.isPublic} /> Aparece na página de preços
        </label>
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON} ml-auto`}>
          {isPending ? "Salvando…" : planId ? "Salvar alterações" : "Criar plano"}
        </button>
      </div>

      {feedback && (
        <p role={feedback.ok ? "status" : "alert"} className={`text-sm font-medium ${feedback.ok ? "text-success" : "text-danger"}`}>
          {feedback.message}
        </p>
      )}
    </form>
  );
}
