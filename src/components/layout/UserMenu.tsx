"use client";

import Link from "next/link";
import { FileText, LogOut, Settings, Shield, ShieldCheck, Users } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { initialsOf } from "./AccountAvatar";
import { POPOVER_ITEM_CLASS, POPOVER_PANEL_CLASS, useEntered, usePopover } from "./usePopover";

export type MenuUser = { name: string; email: string; role: "SUPERADMIN" | "CLIENT" };

const ROLE_LABEL = { SUPERADMIN: "Operador", CLIENT: "Cliente" } as const;

/** Avatar do usuário no rodapé da sidebar: dados da pessoa, atalhos e Sair. */
export function UserMenu({ user }: { user: MenuUser }) {
  const { open, close, panelId, panelRef, triggerProps, onPanelKeyDown } = usePopover();
  const entered = useEntered(open);
  const isAdmin = user.role === "SUPERADMIN";

  return (
    <div className="relative">
      <button
        {...triggerProps}
        aria-label={`Menu de ${user.name}`}
        title={user.name}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl hover:bg-surface-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
          {initialsOf(user.name)}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          onKeyDown={onPanelKeyDown}
          className={`${POPOVER_PANEL_CLASS} sm:bottom-3 ${entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-sm border border-border-strong bg-surface-300 px-1.5 py-0.5 text-xs font-semibold text-ink">
                {isAdmin ? <ShieldCheck size={12} aria-hidden /> : <Users size={12} aria-hidden />}
                {ROLE_LABEL[user.role]}
              </span>
            </div>
          </div>

          <div role="menu" aria-label="Conta e sessão" className="flex flex-col gap-0.5 px-2 py-2">
            <Link role="menuitem" href="/contas" onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
              <Users size={18} aria-hidden /> Gerenciamento de contas
            </Link>
            <Link role="menuitem" href="/ajustes" onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
              <Settings size={18} aria-hidden /> Ajustes
            </Link>
            {isAdmin && (
              <Link role="menuitem" href="/admin" onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
                <Shield size={18} aria-hidden /> Painel Admin
              </Link>
            )}
            <Link role="menuitem" href="/privacidade" onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
              <FileText size={18} aria-hidden /> Privacidade
            </Link>
            <Link role="menuitem" href="/termos" onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
              <FileText size={18} aria-hidden /> Termos
            </Link>
            <form action={logout} className="border-t border-border pt-1 mt-1">
              <button type="submit" role="menuitem" className={`${POPOVER_ITEM_CLASS} text-danger`}>
                <LogOut size={18} aria-hidden /> Sair
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
