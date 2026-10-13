"use client";

import Link from "next/link";
import { CircleUser, CreditCard, FileText, LogOut, Settings, Shield, ShieldCheck, UserPlus, Users, type LucideIcon } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { menuItemsFor, ROLE_BADGE, type MenuItemKey, type MenuRole } from "@/lib/access/menu-rules";
import { initialsOf } from "./AccountAvatar";
import { POPOVER_ITEM_CLASS, POPOVER_PANEL_CLASS, useEntered, usePopover } from "./usePopover";

export type MenuUser = { name: string; email: string; role: "SUPERADMIN" | "CLIENT"; menuRole: MenuRole };

const ITEMS: Record<MenuItemKey, { href: string; label: string; icon: LucideIcon }> = {
  "minha-conta": { href: "/minha-conta", label: "Minha conta", icon: CircleUser },
  contas: { href: "/contas", label: "Gerenciamento de contas", icon: Users },
  equipe: { href: "/equipe", label: "Equipe", icon: UserPlus },
  plano: { href: "/plano", label: "Plano e cobrança", icon: CreditCard },
  ajustes: { href: "/ajustes", label: "Ajustes", icon: Settings },
  admin: { href: "/admin", label: "Painel Admin", icon: Shield },
  privacidade: { href: "/privacidade", label: "Privacidade", icon: FileText },
  termos: { href: "/termos", label: "Termos", icon: FileText },
};

/** Avatar do usuário no rodapé da sidebar: dados da pessoa, atalhos e Sair. */
export function UserMenu({ user }: { user: MenuUser }) {
  const { open, close, panelId, panelRef, triggerProps, onPanelKeyDown } = usePopover();
  const entered = useEntered(open);
  const isAdmin = user.menuRole === "SUPERADMIN";

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
                {ROLE_BADGE[user.menuRole]}
              </span>
            </div>
          </div>

          <div role="menu" aria-label="Conta e sessão" className="flex flex-col gap-0.5 px-2 py-2">
            {menuItemsFor(user.menuRole).map((key) => {
              const { href, label, icon: Icon } = ITEMS[key];
              return (
                <Link key={key} role="menuitem" href={href} onClick={() => close(false)} className={POPOVER_ITEM_CLASS}>
                  <Icon size={18} aria-hidden /> {label}
                </Link>
              );
            })}
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
