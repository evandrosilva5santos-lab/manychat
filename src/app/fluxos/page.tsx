import Link from "next/link";
import { PauseCircle, Workflow, Zap } from "lucide-react";
import { getCurrentAccount } from "@/lib/account";
import { pausedFlowLabel } from "@/components/layout/account-status";
import { describeTrigger, STATUS_BADGE, timeAgo } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automações · instachat" };

export default async function FlowsPage() {
  let accountStatus: string | null = null;
  let flows: Array<{
    id: string;
    name: string;
    folder: string | null;
    status: any;
    mode: any;
    updatedAt: Date;
    triggers: any[];
  }> = [];

  try {
    const account = await getCurrentAccount();
    if (account) {
      accountStatus = account.status;
      flows = await prisma.flow.findMany({
        where: { accountId: account.id, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        include: { triggers: { take: 1, orderBy: { createdAt: "asc" } } },
      });
    }
  } catch (error) {
    console.error("[fluxos] Erro ao buscar fluxos:", error);
  }

  const pausedLabel = pausedFlowLabel(accountStatus);

  return (
    <main className="fx mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-10 font-bold tracking-tight">Minhas automações</h1>
          <p className="text-ink-muted">
            Automação rápida: comentário → DM → link, pronta em minutos. Fluxo avançado: monte do seu jeito, com caixinhas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/fluxos/novo?mode=ADVANCED" className="fx-btn">
            <Workflow size={18} aria-hidden /> Fluxo avançado
          </Link>
          <Link href="/fluxos/novo" className="fx-btn fx-btn-primary">
            <Zap size={18} aria-hidden /> Automação rápida
          </Link>
        </div>
      </header>

      {flows.length === 0 ? (
        <p className="rounded-lg bg-surface-200 p-6 text-ink-muted shadow-card">
          Nenhuma automação ainda. Comece por uma “Automação rápida”.
        </p>
      ) : (
        <div className="fx-list p-0!">
          <div className="fx-list-head" style={{ gridTemplateColumns: "1fr 160px" }}>
            <span>Nome</span>
            <span>Modificado</span>
          </div>
          {flows.map((flow) => {
            const badge = STATUS_BADGE[flow.status as keyof typeof STATUS_BADGE] || STATUS_BADGE.DRAFT;
            const trigger = flow.triggers[0];
            return (
              <div key={flow.id} className="flex flex-col gap-1">
              <Link href={`/fluxos/${flow.id}`} className="fx-auto" style={{ gridTemplateColumns: "1fr 160px" }}>
                <div className="min-w-0">
                  <div className="fx-auto-title">
                    <span className={`fx-badge ${badge.className}`}>{badge.label}</span>
                    <span className="truncate">{flow.name}</span>
                  </div>
                  <div className="fx-auto-sub">
                    {flow.mode === "SIMPLE" ? "Automação rápida · " : "Fluxo avançado · "}
                    {trigger ? describeTrigger(trigger) : "Sem gatilho configurado"}
                  </div>
                </div>
                <span className="fx-meta">{timeAgo(flow.updatedAt)}</span>
              </Link>
              {flow.status === "LIVE" && pausedLabel && (
                <p className="flex flex-wrap items-center gap-x-2 px-4 text-sm font-semibold text-warning">
                  <PauseCircle size={14} aria-hidden />
                  {pausedLabel}
                  <Link href="/ajustes" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2">
                    Ver motivo
                  </Link>
                </p>
              )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
