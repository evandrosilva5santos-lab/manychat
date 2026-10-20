"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Search } from "lucide-react";
import { Avatar, EmptyState, NetworkBadge } from "../_ui/primitives";

export type ProjectCard = {
  id: string;
  name: string;
  logoUrl: string | null;
  accounts: Array<{ id: string; username: string }>;
  scheduled: number;
  published: number;
  failures: number;
  lastPostAt: string | null;
  createdAt: string;
};

const SORTS = {
  lastPost: "Último post criado",
  name: "Nome",
  newest: "Projeto mais recente",
} as const;
type SortKey = keyof typeof SORTS;

function sortProjects(projects: ProjectCard[], key: SortKey) {
  const copy = [...projects];
  if (key === "name") return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (key === "newest") return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return copy.sort((a, b) => (b.lastPostAt ?? b.createdAt).localeCompare(a.lastPostAt ?? a.createdAt));
}

export function ProjectsGrid({ projects }: { projects: ProjectCard[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("lastPost");
  const [sortOpen, setSortOpen] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sortProjects(projects.filter((project) => !term || project.name.toLowerCase().includes(term)), sort);
  }, [projects, query, sort]);

  return (
    <section aria-label="Projetos" className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-[333px]">
          <span className="sr-only">Buscar projeto</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ap-muted" aria-hidden />
          <input id="project-search" name="projectSearch" className="ap-search" placeholder="Buscar projeto" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="relative flex items-center gap-1.5 text-base text-ap-ink">
          Ordenar por
          <button type="button" className="inline-flex items-center gap-1 font-bold text-ap-title" aria-haspopup="listbox" aria-expanded={sortOpen} onClick={() => setSortOpen((open) => !open)}>
            {SORTS[sort]} <ChevronDown size={16} aria-hidden />
          </button>
          {sortOpen && (
            <ul role="listbox" className="absolute top-8 left-24 z-20 min-w-52 rounded-xl bg-white py-1 shadow-lg ring-1 ring-ap-line">
              {(Object.keys(SORTS) as SortKey[]).map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={key === sort}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-ap-ink hover:bg-ap-bg"
                    onClick={() => {
                      setSort(key);
                      setSortOpen(false);
                    }}
                  >
                    {SORTS[key]} {key === sort && <Check size={14} className="text-ap-primary" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="ap-card mt-6">
          <EmptyState title={projects.length === 0 ? "Nenhum projeto ainda." : "Nenhum projeto encontrado."}>
            {projects.length === 0 && (
              <Link href="/autoposter/projeto/novo" className="ap-btn ap-btn-primary mt-3">
                Criar o primeiro projeto
              </Link>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="my-6 grid grid-cols-1 gap-x-6 gap-y-[34px] sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <article key={project.id} className="group relative flex items-start gap-3 rounded-[12px] bg-white px-5 py-4 shadow-sm transition duration-100 ease-in-out hover:shadow-lg">
              <Link href={`/autoposter/projeto/${project.id}`} className="absolute inset-0 rounded-[12px]" aria-label={`Abrir ${project.name}`} />
              <Avatar src={project.logoUrl} name={project.name} size={64} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base leading-snug font-bold tracking-tight text-ap-ink">{project.name}</h3>
                <div className="mt-1.5 flex min-h-[18px] items-center gap-1.5">
                  {project.accounts.map((account) => (
                    <span key={account.id} title={`@${account.username}`}>
                      <NetworkBadge network="instagram" size={18} />
                    </span>
                  ))}
                  {project.accounts.length === 0 && <span className="text-xs text-ap-muted">Nenhuma conta conectada</span>}
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-ap-ink">
                  <li className="flex items-center gap-1.5">
                    <CalendarDays size={12} className="text-ap-muted" aria-hidden />
                    <strong className="font-semibold">{project.scheduled}</strong> posts agendados
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check size={12} className="text-ap-muted" aria-hidden />
                    <strong className="font-semibold">{project.published}</strong> posts publicados
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-3 text-center font-bold text-ap-muted">!</span>
                    <strong className="font-semibold">{project.failures}</strong> falhas nos últimos 7 dias
                  </li>
                </ul>
                <Link href={`/autoposter/projeto/${project.id}/novo-post`} className="relative z-10 mt-4 inline-block text-xs font-semibold text-ap-primary hover:underline">
                  + Novo post
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
