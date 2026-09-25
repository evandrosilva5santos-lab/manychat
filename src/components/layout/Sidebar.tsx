"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  MessageSquare,
  Send,
  Settings,
  HelpCircle,
  PanelLeftClose,
  LayoutGrid,
} from "lucide-react";

/** Ícone de Trevo / Automação característico do ManyChat */
function ManyChatAutomationIcon({
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

/** Ícone AI em caixinha estilizada do ManyChat */
function ManyChatAiIcon({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-[1.5px] border-current text-[9.5px] font-black tracking-tight leading-none select-none ${className}`}
    >
      AI
    </div>
  );
}

/** Logo oficial estilizado 'M' do ManyChat */
function ManyChatLogo() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 32 32"
      fill="currentColor"
      className="text-ink"
    >
      <path d="M5 24V8h4.5l6.5 8.5L22.5 8H27v16h-4.5V14.5L16 23l-6.5-8.5V24H5z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: "painel", label: "Painel", href: "/", icon: Home },
  { id: "contatos", label: "Contatos", href: "/contatos", icon: User },
  {
    id: "automacoes",
    label: "Automações",
    href: "/fluxos",
    customIcon: ManyChatAutomationIcon,
  },
  { id: "catalogo", label: "Catálogo", href: "/catalogo", icon: LayoutGrid },
  { id: "ai", label: "Agentes de IA", href: "/ai", customIcon: ManyChatAiIcon },
  {
    id: "conversas",
    label: "Conversas",
    href: "/conversas",
    icon: MessageSquare,
    hasNotification: true,
  },
  { id: "direct", label: "Transmissão", href: "/direct", icon: Send },
  { id: "ajustes", label: "Ajustes", href: "/ajustes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fx-side flex-none z-50 flex flex-col items-center justify-between border-r border-border bg-surface-200 py-3.5 select-none"
      style={{ width: "68px" }}
      aria-label="Menu principal"
    >
      {/* Top: Logo 'M' e Badge PRO gradiente colorido */}
      <div className="flex flex-col items-center gap-3 w-full">
        <Link
          href="/"
          className="flex flex-col items-center justify-center group transition-transform hover:scale-105"
          title="ManyChat"
        >
          <div className="flex h-9 w-9 items-center justify-center">
            <ManyChatLogo />
          </div>
          {/* Badge PRO idêntico ao print com gradiente arco-íris */}
          <div className="mt-1 flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 p-[1.5px] shadow-xs">
            <span className="rounded-full bg-surface-200 px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider text-ink">
              PRO
            </span>
          </div>
        </Link>

        {/* Itens de Navegação com ícones exatos */}
        <nav className="flex flex-col items-center gap-2 mt-2 w-full px-2">
          {NAV_ITEMS.map((item) => {
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

      {/* Bottom: Colapsar, Avatar do Usuário e Ajuda */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* Botão de colapsar / expandir (ícone ->|) */}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-300/60 hover:text-ink transition-colors"
          title="Recolher barra lateral"
          aria-label="Recolher barra lateral"
        >
          <PanelLeftClose size={18} />
        </button>

        {/* Avatar do Usuário */}
        <Link
          href="/ajustes"
          className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 p-[1.5px] shadow-sm hover:scale-105 transition-transform"
          title="Evandro Silva"
        >
          <div className="h-full w-full rounded-full bg-surface-200 flex items-center justify-center text-[11px] font-bold text-ink">
            E
          </div>
        </Link>

        {/* Central de Ajuda (?) */}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-300/60 hover:text-ink transition-colors"
          title="Ajuda e Suporte"
          aria-label="Ajuda"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </aside>
  );
}
