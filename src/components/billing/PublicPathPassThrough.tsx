"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Em rota pública, mostra o conteúdo; nas demais, a tela de bloqueio. */
export function PublicPathPassThrough({ prefixes, locked, children }: { prefixes: string[]; locked: ReactNode; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? <>{children}</> : <>{locked}</>;
}
