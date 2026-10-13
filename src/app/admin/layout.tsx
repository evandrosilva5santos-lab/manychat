import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentActor } from "@/lib/tenancy";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

/** Console do Super Admin (dono do SaaS). Cada página e ação confere o papel de novo no servidor. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/admin");
  if (actor.role !== "SUPERADMIN") redirect("/");

  return (
    <div className="fx min-h-full bg-surface-100 px-4 py-6 text-ink sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <ShieldCheck size={15} aria-hidden /> Console do Super Admin
          </p>
          <AdminNav />
        </div>
        {children}
      </div>
    </div>
  );
}
