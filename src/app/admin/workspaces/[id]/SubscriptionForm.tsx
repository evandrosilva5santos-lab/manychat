"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { setSubscriptionAction, type AdminActionState } from "./actions";

const STATUS_OPTIONS = [
  ["TRIALING", "Teste grátis"],
  ["ACTIVE", "Ativo"],
  ["PAST_DUE", "Pagamento pendente"],
  ["SUSPENDED", "Suspenso"],
  ["CANCELED", "Cancelado"],
] as const;

type Initial = { planId: string; status: string; trialEndsAt: string; limitOverrides: string };

export function SubscriptionForm(props: { workspaceId: string; plans: { id: string; name: string; isActive: boolean }[]; initial: Initial }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminActionState | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let limitOverrides: Record<string, unknown>;
    try {
      limitOverrides = JSON.parse(String(data.get("limitOverrides") || "{}"));
    } catch {
      setFeedback({ ok: false, message: "Ajustes de limite precisam ser um JSON válido, ex.: {\"maxMembers\": 10}." });
      return;
    }
    const trialEndsAt = String(data.get("trialEndsAt") || "");
    startTransition(async () => {
      setFeedback(
        await setSubscriptionAction(props.workspaceId, {
          planId: String(data.get("planId")),
          status: String(data.get("status")),
          trialEndsAt: trialEndsAt ? `${trialEndsAt}T23:59:59.000Z` : null,
          limitOverrides,
        }),
      );
    });
  }

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4`} aria-labelledby="assinatura">
      <h2 id="assinatura" className="text-base font-bold text-ink">Assinatura</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Plano</span>
          <select name="planId" defaultValue={props.initial.planId} className={INPUT}>
            {props.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}{plan.isActive ? "" : " (inativo)"}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Status</span>
          <select name="status" defaultValue={props.initial.status} className={INPUT}>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Fim do teste (se em teste)</span>
          <input name="trialEndsAt" type="date" defaultValue={props.initial.trialEndsAt} className={INPUT} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink">Ajustes de limite deste cliente (JSON; null = ilimitado)</span>
        <textarea
          name="limitOverrides"
          rows={3}
          defaultValue={props.initial.limitOverrides}
          className={`${INPUT} py-2 font-mono`}
          placeholder='{"maxInstagramAccounts": 5}'
        />
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>{isPending ? "Salvando…" : "Salvar assinatura"}</button>
        {feedback && (
          <p role={feedback.ok ? "status" : "alert"} className={`text-sm font-medium ${feedback.ok ? "text-success" : "text-danger"}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}
