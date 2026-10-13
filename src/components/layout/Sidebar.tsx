"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  MessageSquare,
  Send,
  Settings,
  LayoutGrid,
  TriangleAlert,
  Shield,
} from "lucide-react";
import { BrandSymbol } from "@/components/brand/BrandLogo";
import { ActiveAccountMenu, type ActiveMenuAccount } from "./ActiveAccountMenu";
import { UserMenu, type MenuUser } from "./UserMenu";

/** Ícone de Trevo / Automação característico do instachat */
function FlowAutomationIcon({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="7.5" cy="7.5" r="3.5" />
      <circle cx="16.5" cy="7.5" r="3.5" />
      <circle cx="7.5" cy="16.5" r="3.5" />
      <circle cx="16.5" cy="16.5" r="3.5" />
      <path d="M7.5 11v2" />
      <path d="M16.5 11v2" />
      <path d="M11 7.5h2" />
      <path d="M11 16.5h2" />
    </svg>
  );
}

/** Ícone AI em caixinha estilizada do instachat */
function FlowAiIcon({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-[1.5px] border-current text-[9.5px] font-black tracking-tight leading-none select-none ${className}`}
    >
      AI
    </div>
  );
}

const NAV_ITEMS = [
  { id: "painel", label: "Painel", href: "/", icon: Home },
  { id: "contatos", label: "Contatos", href: "/contatos", icon: User },
  {
    id: "automacoes",
    label: "Automações",
    href: "/fluxos",
    customIcon: FlowAutomationIcon,
  },
  { id: "catalogo", label: "Catálogo", href: "/catalogo", icon: LayoutGrid },
  { id: "ai", label: "Agentes de IA", href: "/ai", customIcon: FlowAiIcon },
  {
    id: "conversas",
    label: "Conversas",
    href: "/conversas",
    icon: MessageSquare,
    hasNotification: true,
  },
  { id: "falhas", label: "Envios com falha", href: "/conversas/falhas", icon: TriangleAlert },
  { id: "direct", label: "Transmissão", href: "/direct", icon: Send },
  { id: "ajustes", label: "Ajustes", href: "/ajustes", icon: Settings },
];

type SidebarProps = {
  isSuperAdmin?: boolean;
  accounts: ActiveMenuAccount[];
  activeAccountId: string | null;
  user: MenuUser | null;
};

export function Sidebar({ isSuperAdmin = false, accounts, activeAccountId, user }: SidebarProps) {
  const pathname = usePathname();

  // Telas públicas isoladas, sem menu interno do app: conexão do cliente e "Você saiu"
  if (pathname?.startsWith("/conectar") || pathname === "/sair") {
    return null;
  }

  return (
    <aside
      className="fx-side flex-none z-50 flex flex-col items-center justify-between border-r border-border bg-surface-200 py-3.5 select-none"
      style={{ width: "68px" }}
      aria-label="Menu principal"
    >
      {/* Top: símbolo instachat e perfil ativo (troca de perfil) */}
      <div className="flex flex-col items-center gap-3 w-full">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center transition-transform hover:scale-105"
          title="instachat"
          aria-label="instachat — Painel"
        >
          <BrandSymbol size={30} />
        </Link>
        <ActiveAccountMenu accounts={accounts} activeAccountId={activeAccountId} />

        {/* Itens de Navegação com ícones exatos */}
        <nav className="flex flex-col items-center gap-2 mt-2 w-full px-2">
          {(isSuperAdmin ? [...NAV_ITEMS, { id: "admin", label: "Admin", href: "/admin", icon: Shield }] : NAV_ITEMS).map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all group ${
                  isActive
                    ? "bg-surface-300 text-ink shadow-xs"
                    : "text-ink-muted hover:bg-surface-300/60 hover:text-ink"
                }`}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
              >
                {item.customIcon ? (
                  <item.customIcon size={20} />
                ) : item.icon ? (
                  <div className="relative">
                    <item.icon
                      size={20}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      aria-hidden
                    />
                    {item.hasNotification && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface-200" />
                    )}
                  </div>
                ) : null}

                {/* Tooltip flutuante no hover */}
                <span className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-surface-100 shadow-md group-hover:block whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: menu do usuário (dados, atalhos e Sair) */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {user ? (
          <UserMenu user={user} />
        ) : (
          <Link
            href="/ajustes"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-300/60 hover:text-ink"
            title="Ajustes"
            aria-label="Ajustes"
          >
            <User size={18} aria-hidden />
          </Link>
        )}
      </div>
    </aside>
  );
}
