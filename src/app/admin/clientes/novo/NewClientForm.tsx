"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { generatePassword } from "@/lib/auth/generate-password";
import { BILLING_CYCLE_LABEL, BILLING_CYCLES, BILLING_MODE_LABEL, BILLING_MODES } from "@/lib/billing/billing-cycle";
import { createClientAction, type NewClientResult } from "../actions";

type PlanOption = { id: string; name: string; trialDays: number };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function Credentials({ result, password }: { result: Extract<NewClientResult, { ok: true }>; password: string }) {
  const [copied, setCopied] = useState(false);
  const loginUrl = `${window.location.origin}/login`;
  const text = `Seu acesso ao instachat:\n${loginUrl}\nE-mail: ${result.email}\nSenha: ${password}`;
  return (
    <section className={`${CARD} flex flex-col gap-3 border-success`} aria-live="polite">
      <h2 className="text-base font-bold text-success">Cliente criado</h2>
      <p className="text-sm text-ink-muted">Copie e envie ao cliente. A senha não aparece de novo (dá para redefinir na página do cliente).</p>
      <pre className="whitespace-pre-wrap rounded-md bg-surface-300 p-3 font-mono text-sm text-ink">{text}</pre>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}
        >
          {copied ? "Copiado!" : "Copiar acesso"}
        </button>
        <Link href={`/admin/workspaces/${result.workspaceId}`} className={SECONDARY_BUTTON}>Abrir cliente</Link>
        <Link href="/admin/clientes" className={SECONDARY_BUTTON}>Voltar para clientes</Link>
      </div>
    </section>
  );
}

export function NewClientForm({ plans }: { plans: PlanOption[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<NewClientResult | null>(null);
  const [password, setPassword] = useState(() => generatePassword());
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const trialDefault = plans.find((plan) => plan.id === planId)?.trialDays ?? 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      setResult(
        await createClientAction({
          workspaceName: String(data.get("workspaceName") ?? ""),
          ownerName: String(data.get("ownerName") ?? ""),
          ownerEmail: String(data.get("ownerEmail") ?? ""),
          password,
          planId,
          billingMode: String(data.get("billingMode")),
          billingCycle: String(data.get("billingCycle")),
          trialDays: Number(data.get("trialDays") || 0),
        }),
      );
    });
  }

  if (result?.ok) return <Credentials result={result} password={password} />;

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4`} aria-label="Dados do novo cliente">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome do cliente (empresa)"><input name="workspaceName" required minLength={2} maxLength={80} className={INPUT} /></Field>
        <Field label="Nome do dono da conta"><input name="ownerName" required minLength={2} maxLength={80} className={INPUT} /></Field>
        <Field label="E-mail de login do dono"><input name="ownerEmail" type="email" required maxLength={200} className={INPUT} /></Field>
        <Field label="Senha inicial" hint="Mínimo 8 caracteres. O dono pode trocar em Minha conta.">
          <div className="flex gap-2">
            <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className={`${INPUT} w-full font-mono`} aria-label="Senha inicial" />
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setPassword(generatePassword())}>Gerar</button>
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Plano">
          <select value={planId} onChange={(event) => setPlanId(event.target.value)} className={INPUT}>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </Field>
        <Field label="Forma de cobrança">
          <select name="billingMode" defaultValue="MANUAL" className={INPUT}>
            {BILLING_MODES.map((mode) => <option key={mode} value={mode}>{BILLING_MODE_LABEL[mode]}</option>)}
          </select>
        </Field>
        <Field label="Ciclo">
          <select name="billingCycle" defaultValue="MONTHLY" className={INPUT}>
            {BILLING_CYCLES.map((cycle) => <option key={cycle} value={cycle}>{BILLING_CYCLE_LABEL[cycle]}</option>)}
          </select>
        </Field>
        <Field label="Dias de teste grátis" hint="0 = começa ativo">
          <input key={planId} name="trialDays" type="number" min={0} max={90} defaultValue={trialDefault} className={INPUT} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>{isPending ? "Criando…" : "Criar cliente"}</button>
        {result && !result.ok && <p role="alert" className="text-sm font-medium text-danger">{result.message}</p>}
      </div>
    </form>
  );
}
