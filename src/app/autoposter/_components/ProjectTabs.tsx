"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "calendario", label: "Calendário de posts" },
  { slug: "posts", label: "Meus posts" },
  { slug: "grupos", label: "Grupos de aprovação" },
  { slug: "configuracoes", label: "Configurações" },
];

export function ProjectTabs({ base }: { base: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Seções do projeto" className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `${base}/${tab.slug}`;
        const active = pathname.startsWith(href);
        return (
          <Link key={tab.slug} href={href} className="ap-tab" aria-current={active ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
