"use client";

import { useActionState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { openBillingPortal, startCheckout } from "./actions";

type CycleOption = { cycle: "MONTHLY" | "YEARLY"; label: string };

export function SubscribeButton({ planId, label, cycles }: { planId: string; label: string; cycles: CycleOption[] }) {
  const [state, action, isPending] = useActionState(startCheckout, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="planId" value={planId} />
      {cycles.length > 1 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Ciclo de cobrança</legend>
          {cycles.map((option, index) => (
            <label key={option.cycle} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input type="radio" name="cycle" value={option.cycle} defaultChecked={index === 0} /> {option.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="cycle" value={cycles[0]?.cycle ?? "MONTHLY"} />
      )}
      <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>{isPending ? "Abrindo…" : label}</button>
      {state && <p role="alert" className="text-sm font-medium text-danger">{state.message}</p>}
    </form>
  );
}

export function ManageBillingButton() {
  const [state, action, isPending] = useActionState(openBillingPortal, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <button type="submit" disabled={isPending} className={SECONDARY_BUTTON}>{isPending ? "Abrindo…" : "Gerenciar pagamento"}</button>
      {state && <p role="alert" className="text-sm font-medium text-danger">{state.message}</p>}
    </form>
  );
}
