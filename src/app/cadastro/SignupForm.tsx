"use client";

import { useActionState } from "react";
import { INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { signUpAction } from "./actions";

const FIELDS = [
  { name: "name", label: "Seu nome", type: "text", autoComplete: "name" },
  { name: "company", label: "Empresa ou perfil", type: "text", autoComplete: "organization" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { name: "password", label: "Senha (mín. 8 caracteres)", type: "password", autoComplete: "new-password" },
] as const;

export function SignupForm({ plan }: { plan: string }) {
  const [state, action, isPending] = useActionState(signUpAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="plan" value={plan} />
      {FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">{field.label}</span>
          <input
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
            maxLength={field.name === "password" ? 200 : 80}
            minLength={field.name === "password" ? 8 : undefined}
            className={INPUT}
          />
        </label>
      ))}
      {state && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-ink">{state.message}</p>}
      <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>{isPending ? "Criando…" : "Criar conta"}</button>
      <p className="text-center text-xs text-ink-muted">
        Ao criar a conta você aceita os <a href="/termos" className="underline">Termos</a> e a <a href="/privacidade" className="underline">Privacidade</a>.
      </p>
    </form>
  );
}
