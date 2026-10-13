"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/auditoria", label: "Auditoria" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/clientes") return pathname.startsWith("/admin/clientes") || pathname.startsWith("/admin/workspaces");
  return pathname.startsWith(href);
}

export function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Seções do console" className="-mx-1 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition ${
              active ? "bg-surface-300 text-ink" : "text-ink-muted hover:bg-surface-300/60 hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
