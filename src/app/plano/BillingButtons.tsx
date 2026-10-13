"use client";

import { useActionState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { openBillingPortal, startCheckout } from "./actions";

export function SubscribeButton({ planId, label }: { planId: string; label: string }) {
  const [state, action, isPending] = useActionState(startCheckout, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="planId" value={planId} />
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
