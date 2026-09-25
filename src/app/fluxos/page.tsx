import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { getCurrentAccount } from "@/lib/account";
import { describeTrigger, STATUS_BADGE, timeAgo } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createFlow } from "./actions";

export const metadata = { title: "Automações · Fluxo" };

export default async function FlowsPage() {
  await connection();
  const account = await getCurrentAccount();
  const flows = await prisma.flow.findMany({
    where: { accountId: account.id },
    orderBy: { updatedAt: "desc" },
    include: { triggers: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  return (
    <main className="fx mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-10 font-bold tracking-tight">Minhas automações</h1>
          <p className="text-ink-muted">Clique numa automação para abrir o editor.</p>
        </div>
        <form action={createFlow}>
          <button type="submit" className="fx-btn fx-btn-primary">
            <Plus size={18} aria-hidden /> Novo fluxo
          </button>
        </form>
      </header>

      {flows.length === 0 ? (
        <p className="rounded-lg bg-surface-200 p-6 text-ink-muted shadow-card">
          Nenhuma automação ainda. Crie a primeira em “Novo fluxo”.
        </p>
      ) : (
        <div className="fx-list p-0!">
          <div className="fx-list-head" style={{ gridTemplateColumns: "1fr 160px" }}>
            <span>Nome</span>
            <span>Modificado</span>
          </div>
          {flows.map((flow) => {
            const badge = STATUS_BADGE[flow.status];
            const trigger = flow.triggers[0];
            return (
              <Link key={flow.id} href={`/fluxos/${flow.id}`} className="fx-auto" style={{ gridTemplateColumns: "1fr 160px" }}>
                <div className="min-w-0">
                  <div className="fx-auto-title">
                    <span className={`fx-badge ${badge.className}`}>{badge.label}</span>
                    <span className="truncate">{flow.name}</span>
                  </div>
                  <div className="fx-auto-sub">{trigger ? describeTrigger(trigger) : "Sem gatilho configurado"}</div>
                </div>
                <span className="fx-meta">{timeAgo(flow.updatedAt)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
