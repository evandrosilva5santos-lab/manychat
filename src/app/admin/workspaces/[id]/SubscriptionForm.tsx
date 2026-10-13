"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { BILLING_CYCLE_LABEL, BILLING_CYCLES, BILLING_MODE_LABEL, BILLING_MODES } from "@/lib/billing/billing-cycle";
import { LIMIT_KEYS, LIMIT_LABELS, type LimitKey } from "@/lib/billing/plan-rules";
import { setSubscriptionAction, type AdminActionState } from "./actions";

const STATUS_OPTIONS = [
  ["TRIALING", "Teste grátis"],
  ["ACTIVE", "Ativo"],
  ["PAST_DUE", "Pagamento pendente"],
  ["SUSPENDED", "Suspenso"],
  ["CANCELED", "Cancelado"],
] as const;

const COMPLIMENTARY_OPTIONS = [
  ["keep", "Manter como está"],
  ["none", "Sem cortesia (cobrar normalmente)"],
  ["1", "Grátis por 1 mês"],
  ["3", "Grátis por 3 meses"],
  ["6", "Grátis por 6 meses"],
  ["9", "Grátis por 9 meses"],
  ["indefinite", "Grátis por tempo indeterminado"],
] as const;

type PlanOption = { id: string; name: string; isActive: boolean; limits: Record<LimitKey, number | null> };
type Initial = {
  planId: string;
  status: string;
  trialEndsAt: string;
  billingMode: string;
  billingCycle: string;
  limitOverrides: Partial<Record<LimitKey, number | null>>;
  complimentaryLabel: string | null;
};

/** Campos de limite → ajustes: vazio = vale o do plano; "ilimitado" marcado = null. */
function readOverrides(data: FormData): Partial<Record<LimitKey, number | null>> {
  const out: Partial<Record<LimitKey, number | null>> = {};
  for (const key of LIMIT_KEYS) {
    if (data.get(`${key}-unlimited`) === "on") out[key] = null;
    else if (String(data.get(key) ?? "").trim() !== "") out[key] = Math.max(0, Math.floor(Number(data.get(key))));
  }
  return out;
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: readonly (readonly [string, string])[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <select name={name} defaultValue={value} className={INPUT}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function LimitFields({ initial, plan }: { initial: Initial["limitOverrides"]; plan: PlanOption | undefined }) {
  return (
    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-xs font-semibold text-ink">Limites só deste cliente (vazio = vale o do plano)</legend>
      {LIMIT_KEYS.map((key) => {
        const fromPlan = plan?.limits[key];
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={`limit-${key}`} className="text-xs font-semibold text-ink first-letter:uppercase">{LIMIT_LABELS[key]}</label>
            <div className="flex items-center gap-3">
              <input
                id={`limit-${key}`}
                name={key}
                type="number"
                min={0}
                defaultValue={typeof initial[key] === "number" ? String(initial[key]) : ""}
                placeholder={`plano: ${fromPlan === null || fromPlan === undefined ? "ilimitado" : fromPlan}`}
                className={`${INPUT} w-full`}
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink">
                <input type="checkbox" name={`${key}-unlimited`} defaultChecked={initial[key] === null} /> ilimitado
              </label>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function SubscriptionForm(props: { workspaceId: string; plans: PlanOption[]; initial: Initial }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminActionState | null>(null);
  const [planId, setPlanId] = useState(props.initial.planId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const trialEndsAt = String(data.get("trialEndsAt") || "");
    startTransition(async () => {
      setFeedback(
        await setSubscriptionAction(props.workspaceId, {
          planId: String(data.get("planId")),
          status: String(data.get("status")),
          trialEndsAt: trialEndsAt ? `${trialEndsAt}T23:59:59.000Z` : null,
          limitOverrides: readOverrides(data),
          complimentary: String(data.get("complimentary") || "keep"),
          billingMode: String(data.get("billingMode")),
          billingCycle: String(data.get("billingCycle")),
        }),
      );
    });
  }

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4`} aria-labelledby="assinatura">
      <h2 id="assinatura" className="text-base font-bold text-ink">Plano e forma de cobrança</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Plano</span>
          <select name="planId" value={planId} onChange={(event) => setPlanId(event.target.value)} className={INPUT}>
            {props.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}{plan.isActive ? "" : " (inativo)"}</option>
            ))}
          </select>
        </label>
        <Select label="Forma de cobrança" name="billingMode" value={props.initial.billingMode} options={BILLING_MODES.map((mode) => [mode, BILLING_MODE_LABEL[mode]] as const)} />
        <Select label="Ciclo" name="billingCycle" value={props.initial.billingCycle} options={BILLING_CYCLES.map((cycle) => [cycle, BILLING_CYCLE_LABEL[cycle]] as const)} />
        <Select label="Status" name="status" value={props.initial.status} options={STATUS_OPTIONS} />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Fim do teste (se em teste)</span>
          <input name="trialEndsAt" type="date" defaultValue={props.initial.trialEndsAt} className={INPUT} />
        </label>
        <Select label="Cortesia (fora do MRR)" name="complimentary" value="keep" options={COMPLIMENTARY_OPTIONS} />
      </div>
      <p className="text-xs text-ink-muted">
        {props.initial.complimentaryLabel ?? "Sem cortesia hoje."} O prazo da cortesia conta a partir de hoje; ao vencer, as automações pausam até o cliente pagar.
        Na cobrança manual, registrar um pagamento abaixo ativa o cliente até o fim do período pago.
      </p>
      <LimitFields initial={props.initial.limitOverrides} plan={props.plans.find((plan) => plan.id === planId)} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>{isPending ? "Salvando…" : "Salvar"}</button>
        {feedback && (
          <p role={feedback.ok ? "status" : "alert"} className={`text-sm font-medium ${feedback.ok ? "text-success" : "text-danger"}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}
