"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { BILLING_CYCLE_LABEL, BILLING_CYCLES, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, type BillingCycle } from "@/lib/billing/billing-cycle";
import { recordPaymentAction, type AdminActionState } from "./actions";

type Props = { workspaceId: string; cycle: BillingCycle; priceByCycle: Record<BillingCycle, number> };

function toReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function toCents(typed: string): number {
  const raw = typed.includes(",") ? typed.replace(/\./g, "").replace(",", ".") : typed;
  return Math.round(Number(raw || 0) * 100);
}

/** Registrar Pix, boleto ou transferência recebidos fora do Stripe. */
export function PaymentForm({ workspaceId, cycle: initialCycle, priceByCycle }: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminActionState | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [amount, setAmount] = useState(toReais(priceByCycle[initialCycle]));
  const today = new Date().toISOString().slice(0, 10);

  function changeCycle(next: BillingCycle) {
    setCycle(next);
    setAmount(toReais(priceByCycle[next]));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await recordPaymentAction(workspaceId, {
        amountCents: toCents(amount),
        method: String(data.get("method")),
        paidAt: `${String(data.get("paidAt"))}T12:00:00.000Z`,
        cycle,
        reference: String(data.get("reference") ?? "").trim() || null,
        notes: String(data.get("notes") ?? "").trim() || null,
      });
      setFeedback(result);
      if (result.ok) form.reset();
    });
  }

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4`} aria-labelledby="registrar-pagamento">
      <h2 id="registrar-pagamento" className="text-base font-bold text-ink">Registrar pagamento (Pix, boleto, transferência)</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Ciclo pago</span>
          <select name="cycle" value={cycle} onChange={(event) => changeCycle(event.target.value as BillingCycle)} className={INPUT}>
            {BILLING_CYCLES.map((value) => <option key={value} value={value}>{BILLING_CYCLE_LABEL[value]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Valor (R$)</span>
          <input name="amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Método</span>
          <select name="method" defaultValue="PIX" className={INPUT}>
            {PAYMENT_METHODS.map((value) => <option key={value} value={value}>{PAYMENT_METHOD_LABEL[value]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Pago em</span>
          <input name="paidAt" type="date" required defaultValue={today} max={today} className={INPUT} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Referência (ID do Pix, nº do boleto…)</span>
          <input name="reference" maxLength={120} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">Observação</span>
          <input name="notes" maxLength={500} className={INPUT} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>{isPending ? "Registrando…" : "Registrar pagamento"}</button>
        {feedback && (
          <p role={feedback.ok ? "status" : "alert"} className={`text-sm font-medium ${feedback.ok ? "text-success" : "text-danger"}`}>{feedback.message}</p>
        )}
      </div>
    </form>
  );
}
