"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AccountAvatar, StatusIcon, TONE_TEXT } from "@/components/layout/AccountAvatar";
import { accountStatusLabel, describeValidity } from "@/components/layout/account-status";
import { activateAccount, unloadAccount, type AccountActionResult } from "./actions";

export type ContaRow = {
  id: string;
  username: string;
  name: string | null;
  profilePicUrl: string | null;
  status: string;
  authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  tokenExpiresAt: string | null;
};

const LOGIN_URL = "/api/auth/instagram/login";
const PROVIDER_LABEL = { INSTAGRAM_LOGIN: "Instagram", FACEBOOK_LOGIN: "Facebook" } as const;
const PROVIDER_MODE = { INSTAGRAM_LOGIN: "instagram", FACEBOOK_LOGIN: "facebook" } as const;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${FOCUS}`;
const SECONDARY = `${BUTTON} border border-border-strong bg-surface-200 text-ink hover:bg-surface-300`;

export function ContasClient({
  accounts,
  activeAccountId,
  signedIn,
}: {
  accounts: ContaRow[];
  activeAccountId: string | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AccountActionResult | null>(null);
  const [unloadTarget, setUnloadTarget] = useState<ContaRow | null>(null);

  function run(action: () => Promise<AccountActionResult>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Contas do Instagram</h1>
          <p className="mt-1 text-sm text-ink-muted">Escolha o perfil ativo, reconecte quando o acesso vencer ou descarregue um perfil.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`${LOGIN_URL}?mode=instagram`} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`}>
            <Plus size={16} aria-hidden /> Conectar com Instagram
          </a>
          <a href={`${LOGIN_URL}?mode=facebook`} className={SECONDARY}>
            <Plus size={16} aria-hidden /> Conectar com Facebook
          </a>
        </div>
      </header>

      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`rounded-md border px-4 py-3 text-sm font-medium text-ink ${
            feedback.ok ? "border-success bg-success-soft" : "border-danger bg-danger-soft"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {!signedIn ? (
        <p className="rounded-lg border border-border bg-surface-200 p-6 text-sm text-ink-muted">Entre no painel para ver as contas.</p>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-200 p-6 text-sm text-ink-muted">
          Nenhum perfil conectado ainda. Use os botões acima para conectar o primeiro.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-busy={isPending}>
          {accounts.map((account) => {
            const state = accountStatusLabel(account.status);
            const isActive = account.id === activeAccountId;
            return (
              <li
                key={account.id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-surface-200 p-4 shadow-card sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <AccountAvatar username={account.username} profilePicUrl={account.profilePicUrl} size={44} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      <span className="truncate">@{account.username}</span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">
                          <CheckCircle2 size={12} aria-hidden /> Ativo
                        </span>
                      )}
                    </p>
                    <p className={`flex items-center gap-1 text-sm font-medium ${TONE_TEXT[state.tone]}`}>
                      <StatusIcon tone={state.tone} size={14} /> {state.label}
                    </p>
                    <p className="text-xs text-ink-subtle">
                      Login {PROVIDER_LABEL[account.authProvider]} · {describeValidity(account)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isActive && account.status !== "DISCONNECTED" && (
                    <button type="button" disabled={isPending} onClick={() => run(() => activateAccount(account.id))} className={SECONDARY}>
                      Tornar ativo
                    </button>
                  )}
                  {account.status !== "CONNECTED" && (
                    <a href={`${LOGIN_URL}?mode=${PROVIDER_MODE[account.authProvider]}`} className={SECONDARY}>
                      <RefreshCw size={16} aria-hidden /> {account.status === "DISCONNECTED" ? "Carregar de novo" : "Reconectar"}
                    </a>
                  )}
                  {account.status !== "DISCONNECTED" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setUnloadTarget(account)}
                      className={`${BUTTON} border border-danger text-danger hover:bg-danger-soft`}
                    >
                      Descarregar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={unloadTarget !== null}
        title={`Descarregar @${unloadTarget?.username ?? ""}?`}
        description={
          <p>
            Isto desconecta o Instagram do instachat. Enquanto o perfil estiver descarregado, as automações ficam paradas e
            execuções em andamento são encerradas. Fluxos, contatos e conversas continuam guardados; para voltar, use
            Carregar de novo.
          </p>
        }
        confirmLabel="Descarregar perfil"
        busyLabel="Descarregando…"
        tone="danger"
        busy={isPending}
        onConfirm={() => {
          const target = unloadTarget;
          if (target) run(() => unloadAccount(target.id), () => setUnloadTarget(null));
        }}
        onCancel={() => setUnloadTarget(null)}
      />
    </main>
  );
}
