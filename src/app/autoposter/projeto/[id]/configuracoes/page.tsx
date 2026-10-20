import Link from "next/link";
import { Hash, PenLine, Settings, Tag, LayoutGrid, Trash2 } from "lucide-react";
import { requireProject } from "@/lib/autoposter/access";
import { getProjectLibrary } from "@/lib/autoposter/queries";
import { listAccessibleAccounts } from "@/lib/tenancy";
import { ProjectForm } from "../../../_components/ProjectForm";
import { LibraryManager } from "../../../_components/settings/LibraryManager";
import { DeleteProject, PublishRulesForm } from "../../../_components/settings/PublishRulesForm";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "dados", label: "Dados do projeto", icon: Settings },
  { key: "hashtags", label: "Hashtags", icon: Hash },
  { key: "assinaturas", label: "Assinaturas", icon: PenLine },
  { key: "categorias", label: "Categorias", icon: Tag },
  { key: "regras", label: "Regras de publicações", icon: LayoutGrid },
  { key: "excluir", label: "Excluir projeto", icon: Trash2 },
] as const;

export default async function ProjectSettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const { actor, project } = await requireProject(id);
  const section = SECTIONS.find((item) => item.key === search.aba)?.key ?? "dados";
  const [library, accounts] = await Promise.all([getProjectLibrary(project.id), listAccessibleAccounts(actor)]);
  const base = `/autoposter/projeto/${project.id}/configuracoes`;

  return (
    <div className="grid gap-8 rounded-[12px] bg-white px-4 py-10 md:grid-cols-[265px_1fr] md:gap-16 md:px-10">
      <nav aria-label="Configurações do projeto" className="flex flex-row gap-1 overflow-x-auto md:flex-col">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = item.key === section;
          const tone = active ? "bg-ap-blue-soft font-medium text-ap-title" : item.key === "excluir" ? "text-ap-red hover:bg-ap-bg" : "text-ap-subtle hover:bg-ap-bg";
          return (
            <Link key={item.key} href={`${base}?aba=${item.key}`} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-base whitespace-nowrap ${tone}`}>
              <Icon size={20} aria-hidden /> {item.label}
            </Link>
          );
        })}
      </nav>

      <div>
        {section === "dados" && (
          <div className="max-w-[773px]">
            <ProjectForm
              accounts={accounts.map((account) => ({ id: account.id, username: account.username, profilePicUrl: account.profilePicUrl, status: account.status }))}
              project={{
                id: project.id,
                name: project.name,
                timezone: project.timezone,
                dateFormat: project.dateFormat,
                accountIds: project.accounts.map((link) => link.accountId),
              }}
            />
          </div>
        )}
        {section === "hashtags" && (
          <LibraryManager projectId={project.id} kind="hashtag" items={library.hashtags.map((item) => ({ id: item.id, name: item.name, value: item.hashtags }))} />
        )}
        {section === "assinaturas" && (
          <LibraryManager projectId={project.id} kind="signature" items={library.signatures.map((item) => ({ id: item.id, name: item.name, value: item.content }))} />
        )}
        {section === "categorias" && (
          <LibraryManager projectId={project.id} kind="category" items={library.categories.map((item) => ({ id: item.id, name: item.name, value: item.color }))} />
        )}
        {section === "regras" && (
          <PublishRulesForm projectId={project.id} initial={{ publishOnlyIfApproved: project.publishOnlyIfApproved, retryOnFailure: project.retryOnFailure }} />
        )}
        {section === "excluir" && <DeleteProject projectId={project.id} name={project.name} />}
      </div>
    </div>
  );
}
