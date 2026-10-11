"use client";

import { useTransition } from "react";
import { AtSign, ChevronDown, CircleAlert, Link as LinkIcon, LoaderCircle } from "lucide-react";
import { switchActiveInstagramAccount } from "@/app/actions/tenancy";

type Account = { id: string; username: string; profilePicUrl: string | null; status: string };

export function AccountSwitcher({ accounts, activeAccountId }: { accounts: Account[]; activeAccountId: string | null }) {
  const [pending, startTransition] = useTransition();
  const active = accounts.find((account) => account.id === activeAccountId) ?? null;

  if (!active) {
    return (
      <a href="/conectar" className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-ink hover:bg-warning/20" aria-label="Conectar meu Instagram">
        <LinkIcon size={15} aria-hidden /> Conectar Instagram
      </a>
    );
  }

  return (
    <label className="relative flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-200 px-2 py-1.5 text-xs text-ink shadow-xs">
      {active.profilePicUrl ? <img src={active.profilePicUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary"><AtSign size={15} /></span>}
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-bold">@{active.username}</span>
        <span className={active.status === "CONNECTED" ? "text-success" : "text-danger"}>{active.status === "CONNECTED" ? "● Automação ativa" : "● Reconexão necessária"}</span>
      </span>
      {pending ? <LoaderCircle size={14} className="animate-spin" /> : <ChevronDown size={14} aria-hidden />}
      <select
        aria-label="Selecionar conta do Instagram"
        value={active.id}
        disabled={pending || accounts.length < 2}
        onChange={(event) => startTransition(async () => { await switchActiveInstagramAccount(event.target.value); })}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {accounts.map((account) => <option key={account.id} value={account.id}>@{account.username}{account.status === "CONNECTED" ? "" : " — reconectar"}</option>)}
      </select>
      <span className="sr-only">{accounts.length > 1 ? "Alternar conta" : "Conta ativa"}</span>
    </label>
  );
}

export function AccountStatusNotice({ hasAccount }: { hasAccount: boolean }) {
  if (hasAccount) return null;
  return <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-ink"><CircleAlert size={18} className="text-warning" /> Conecte uma conta profissional do Instagram para começar.</div>;
}
