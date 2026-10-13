"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Link as LinkIcon, LoaderCircle, Plus, Settings2 } from "lucide-react";
import { switchActiveInstagramAccount } from "@/app/actions/tenancy";
import { AccountAvatar, StatusIcon, TONE_TEXT } from "./AccountAvatar";
import { accountStatusLabel } from "./account-status";
import { POPOVER_ITEM_CLASS, POPOVER_PANEL_CLASS, useEntered, usePopover } from "./usePopover";

export type ActiveMenuAccount = { id: string; username: string; profilePicUrl: string | null; status: string };

const SEARCH_THRESHOLD = 6;
const LOGIN_URL = "/api/auth/instagram/login";

/** Avatar do perfil ativo no topo da sidebar; abre a lista de perfis para trocar. */
export function ActiveAccountMenu({ accounts, activeAccountId }: { accounts: ActiveMenuAccount[]; activeAccountId: string | null }) {
  const router = useRouter();
  const { open, close, panelId, panelRef, triggerProps, onPanelKeyDown } = usePopover();
  const entered = useEntered(open);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const active = accounts.find((account) => account.id === activeAccountId) ?? null;
  const activeState = accountStatusLabel(active?.status);
  const showSearch = accounts.length > SEARCH_THRESHOLD;
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^@/, "");
    return term ? accounts.filter((account) => account.username.toLowerCase().includes(term)) : accounts;
  }, [accounts, query]);

  function choose(accountId: string) {
    if (accountId === activeAccountId) {
      close();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await switchActiveInstagramAccount(accountId);
        router.refresh();
        close();
      } catch {
        setError("Não foi possível trocar de perfil. Tente de novo.");
      }
    });
  }

  const triggerLabel = active ? `Perfil ativo: @${active.username}, ${activeState.label}. Trocar de perfil` : "Perfis do Instagram";

  return (
    <div className="relative">
      <button
        {...triggerProps}
        aria-label={triggerLabel}
        title={active ? `@${active.username}` : "Perfis do Instagram"}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl hover:bg-surface-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {active ? (
          <AccountAvatar username={active.username} profilePicUrl={active.profilePicUrl} status={active.status} size={32} />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border-strong text-ink-muted">
            <LinkIcon size={16} aria-hidden />
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          onKeyDown={onPanelKeyDown}
          aria-busy={isPending}
          className={`${POPOVER_PANEL_CLASS} sm:top-3 ${entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
        >
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-ink-muted">Perfis do Instagram</p>

          {showSearch && (
            <div className="px-3 pb-2">
              <label htmlFor={`${panelId}-busca`} className="sr-only">Buscar perfil</label>
              <input
                id={`${panelId}-busca`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar @usuário"
                autoComplete="off"
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="mx-3 mb-2 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm font-medium text-ink">
              {error}
            </p>
          )}

          <div role="menu" aria-label="Trocar de perfil" className="flex flex-col gap-0.5 px-2 pb-1">
            {accounts.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">Nenhum perfil carregado ainda.</p>}
            {accounts.length > 0 && visible.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">Nenhum perfil encontrado.</p>}
            {visible.map((account) => {
              const state = accountStatusLabel(account.status);
              const isActive = account.id === activeAccountId;
              return (
                <button
                  key={account.id}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                  aria-disabled={isPending || undefined}
                  onClick={() => !isPending && choose(account.id)}
                  className={`${POPOVER_ITEM_CLASS} ${isActive ? "bg-surface-300" : ""} ${isPending ? "cursor-wait opacity-60" : ""}`}
                >
                  <AccountAvatar username={account.username} profilePicUrl={account.profilePicUrl} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">@{account.username}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${TONE_TEXT[state.tone]}`}>
                      <StatusIcon tone={state.tone} size={12} />
                      <span className="truncate">{state.label}</span>
                    </span>
                  </span>
                  {isActive && <span className="shrink-0 text-xs font-semibold text-primary">Ativo</span>}
                </button>
              );
            })}
          </div>

          <div role="menu" aria-label="Gerenciar perfis" className="flex flex-col gap-0.5 border-t border-border px-2 py-2">
            {isPending && (
              <p role="status" className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-ink-muted">
                <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden /> Trocando de perfil…
              </p>
            )}
            <a role="menuitem" href={`${LOGIN_URL}?mode=instagram`} className={POPOVER_ITEM_CLASS}>
              <Plus size={18} aria-hidden /> Conectar nova conta (Instagram)
            </a>
            <a role="menuitem" href={`${LOGIN_URL}?mode=facebook`} className={POPOVER_ITEM_CLASS}>
              <Plus size={18} aria-hidden /> Conectar nova conta (Facebook)
            </a>
            <Link role="menuitem" href="/contas" onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
              <Settings2 size={18} aria-hidden /> Gerenciar contas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
