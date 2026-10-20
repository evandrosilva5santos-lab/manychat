import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Sparkles } from "lucide-react";
import { AutoposterNotFoundError, requireProject } from "@/lib/autoposter/access";
import { Avatar, NetworkStack } from "../../_ui/primitives";
import { ProjectTabs } from "../../_components/ProjectTabs";

export const dynamic = "force-dynamic";

async function loadProject(id: string) {
  try {
    return (await requireProject(id)).project;
  } catch (error) {
    if (error instanceof AutoposterNotFoundError) notFound();
    throw error;
  }
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const logo = project.logoUrl ?? project.accounts[0]?.account.profilePicUrl ?? null;
  const networks = project.accounts.map(() => "instagram");
  const base = `/autoposter/projeto/${project.id}`;

  return (
    <>
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-white px-4 shadow lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/autoposter" className="rounded-full p-1.5 text-ap-subtle hover:bg-ap-line" aria-label="Voltar para Meus projetos">
            <ArrowLeft size={20} aria-hidden />
          </Link>
          <Avatar src={logo} name={project.name} size={32} />
          <h1 className="ap-title max-w-[160px] truncate text-lg sm:max-w-[320px]">Posts de {project.name}</h1>
          <span className="mx-2 hidden h-8 w-px bg-ap-line md:block" aria-hidden />
          <span className="hidden md:inline-flex">
            <NetworkStack networks={networks} max={3} size={24} />
          </span>
          <Link href={`${base}/configuracoes`} className="ap-btn ap-btn-tertiary ml-4 hidden lg:inline-flex">
            Gerenciar integrações
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`${base}/configuracoes`} className="ap-btn ap-btn-tertiary !px-2.5" aria-label="Editar projeto" title="Editar projeto">
            <Pencil size={18} aria-hidden />
          </Link>
          <span className="ap-btn ap-btn-purple hidden cursor-not-allowed opacity-60 xl:inline-flex" title="Em breve" aria-disabled="true">
            <Sparkles size={18} aria-hidden /> Criar post com IA
          </span>
          <Link href={`${base}/novo-post`} className="ap-btn ap-btn-primary">
            <Plus size={18} aria-hidden /> <span className="hidden sm:inline">Novo post</span>
          </Link>
        </div>
      </div>

      <div className="px-4 pt-9 pb-4 lg:px-10">
        <ProjectTabs base={base} />
      </div>
      <div className="flex-1 px-4 pb-12 lg:px-10">{children}</div>
    </>
  );
}
