import Link from "next/link";
import { ArrowRight, CalendarCheck2, CheckCheck, Clock3, PenLine, Plus, AlertCircle, CircleCheck, CalendarDays } from "lucide-react";
import { requireAutoposterActor } from "@/lib/autoposter/access";
import { listProjectsOverview } from "@/lib/autoposter/queries";
import { formatDate } from "@/lib/autoposter/dates";
import { Avatar } from "./_ui/primitives";
import { ProjectsGrid } from "./_components/ProjectsGrid";

export const dynamic = "force-dynamic";

const PERIOD_DAYS = 7;
const TZ = "America/Sao_Paulo";

function SummaryColumn({ icon, title, tone, children, href }: { icon: React.ReactNode; title: string; tone: string; children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="group flex w-full flex-col gap-3 rounded-[12px] bg-white px-2 py-4 transition-colors hover:bg-gray-100 md:px-6">
      <span className={`flex items-center gap-2 text-base font-bold leading-snug ${tone}`}>
        {icon}
        {title}
      </span>
      <div className="flex-1 text-xs text-ap-ink">{children}</div>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ap-muted group-hover:text-ap-ink">
        Ver detalhes <ArrowRight size={12} aria-hidden />
      </span>
    </Link>
  );
}

function Line({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <p className="flex items-center gap-1.5 leading-[22px]">
      {icon}
      <strong className="font-semibold">{value}</strong> {label}
    </p>
  );
}

export default async function AutoposterHome() {
  const actor = await requireAutoposterActor();
  const { summary, projects, since } = await listProjectsOverview(actor, PERIOD_DAYS);
  const period = `Últimos ${PERIOD_DAYS} dias | ${formatDate(since, TZ, "DD/MM/YYYY").slice(0, 5)} - ${formatDate(new Date(), TZ, "DD/MM/YYYY").slice(0, 5)}`;

  return (
    <>
      <header className="border-b border-ap-line bg-ap-bg">
        <div className="mx-auto flex w-full max-w-[1140px] flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-4">
            <Avatar name={actor.name} size={48} />
            <h1 className="ap-title text-[32px] leading-8">Meus projetos</h1>
          </div>
          <Link href="/autoposter/projeto/novo" className="ap-btn ap-btn-primary">
            <Plus size={18} aria-hidden /> Novo projeto
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1140px] flex-1 px-4 pb-16 sm:px-6">
        <div className="mt-6 flex justify-end">
          <span className="rounded bg-ap-blue-soft px-1.5 py-0.5 text-[11px] font-semibold text-ap-title">{period}</span>
        </div>

        <section aria-label="Resumo" className="ap-card mt-2 grid grid-cols-2 gap-y-2 p-2 md:grid-cols-4 md:divide-x md:divide-ap-line md:p-0">
          <SummaryColumn href="/autoposter/posts?status=reviewing" title="Aprovação" tone="text-ap-ink" icon={<CircleCheck size={20} className="fill-ap-ink text-white" aria-hidden />}>
            <Line icon={<Clock3 size={12} className="text-ap-muted" aria-hidden />} value={summary.reviewing} label="aguardando revisão" />
            <Line icon={<PenLine size={12} className="text-ap-muted" aria-hidden />} value={summary.adjustments} label="com pedidos de ajuste" />
            <Line icon={<CheckCheck size={12} className="text-ap-muted" aria-hidden />} value={summary.approved} label="aprovados" />
          </SummaryColumn>
          <SummaryColumn href="/autoposter/posts?status=scheduled" title="Agendados" tone="text-ap-primary" icon={<CalendarDays size={20} aria-hidden />}>
            <p className="text-xl font-bold tracking-tighter text-ap-ink">{summary.scheduled}</p>
            <p className="text-sm font-medium text-ap-muted">posts</p>
          </SummaryColumn>
          <SummaryColumn href="/autoposter/posts?status=published" title="Publicados" tone="text-ap-purple" icon={<CalendarCheck2 size={20} aria-hidden />}>
            <p className="text-xl font-bold tracking-tighter text-ap-ink">{summary.published}</p>
            <p className="text-sm font-medium text-ap-muted">posts</p>
          </SummaryColumn>
          <SummaryColumn href="/autoposter/posts?status=failed" title="Não concluídos" tone="text-ap-red" icon={<AlertCircle size={20} className="fill-ap-red text-white" aria-hidden />}>
            <Line icon={<span className="font-bold text-ap-red">!</span>} value={summary.notPublished} label="posts não publicados" />
            <Line icon={<span className="font-bold text-ap-red">!</span>} value={summary.failed} label="posts com falha" />
          </SummaryColumn>
        </section>

        <ProjectsGrid
          projects={projects.map((project) => ({
            ...project,
            lastPostAt: project.lastPostAt?.toISOString() ?? null,
            createdAt: project.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
