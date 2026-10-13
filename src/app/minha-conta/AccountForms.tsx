"use client";

import { useActionState } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { changePasswordAction, saveNameAction, type AccountActionState } from "./actions";

function Feedback({ state }: { state: AccountActionState }) {
  if (!state) return null;
  return <p role={state.ok ? "status" : "alert"} className={`text-sm font-medium ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>;
}

export function NameForm({ name }: { name: string }) {
  const [state, action, isPending] = useActionState(saveNameAction, null);
  return (
    <form action={action} className={`${CARD} flex flex-col gap-3`} aria-labelledby="dados">
      <h2 id="dados" className="text-base font-bold text-ink">Seus dados</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Nome</span>
        <input name="name" defaultValue={name} required minLength={2} maxLength={80} className={INPUT} />
      </label>
      <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON} self-start`}>{isPending ? "Salvando…" : "Salvar nome"}</button>
      <Feedback state={state} />
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, isPending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className={`${CARD} flex flex-col gap-3`} aria-labelledby="senha">
      <h2 id="senha" className="text-base font-bold text-ink">{hasPassword ? "Trocar senha" : "Criar senha"}</h2>
      {hasPassword && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Senha atual</span>
          <input name="current" type="password" autoComplete="current-password" required className={INPUT} />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Nova senha</span>
        <input name="next" type="password" autoComplete="new-password" required minLength={8} className={INPUT} />
        <span className="text-xs text-ink-muted">Pelo menos 8 caracteres.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Repita a nova senha</span>
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={INPUT} />
      </label>
      <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON} self-start`}>{isPending ? "Salvando…" : hasPassword ? "Trocar senha" : "Criar senha"}</button>
      <Feedback state={state} />
    </form>
  );
}
