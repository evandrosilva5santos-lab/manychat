import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAutoposterActor } from "@/lib/autoposter/access";
import type { PostStatus } from "@/lib/autoposter/constants";
import { listPostsAcrossProjects } from "@/lib/autoposter/queries";
import { PostsGrid } from "../_components/PostsGrid";
import { toCardDTO } from "../_lib/cards";

export const dynamic = "force-dynamic";

const VIEWS: Record<string, { label: string; statuses: PostStatus[] }> = {
  reviewing: { label: "Aguardando revisão", statuses: ["reviewing"] },
  needs_adjustment: { label: "Pedido de ajuste", statuses: ["needs_adjustment"] },
  approved: { label: "Aprovados", statuses: ["approved"] },
  scheduled: { label: "Agendados", statuses: ["scheduled"] },
  published: { label: "Publicados", statuses: ["published"] },
  failed: { label: "Não concluídos", statuses: ["failed", "not_published"] },
};

export default async function AllPostsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireAutoposterActor();
  const search = await searchParams;
  const key = search.status && VIEWS[search.status] ? search.status : "reviewing";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const { posts, pages } = await listPostsAcrossProjects(actor, VIEWS[key].statuses, page);

  return (
    <>
      <header className="border-b border-ap-line">
        <div className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-4 py-8 sm:px-10">
          <Link href="/autoposter" className="rounded-full p-1.5 text-ap-subtle hover:bg-ap-line" aria-label="Voltar para Meus projetos">
            <ArrowLeft size={20} aria-hidden />
          </Link>
          <h1 className="ap-title text-[28px] leading-8">Central de posts</h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-10">
        <PostsGrid
          chips={Object.entries(VIEWS).map(([value, view]) => ({ key: value, label: view.label, href: `/autoposter/posts?status=${value}`, active: value === key }))}
          cards={posts.map((post) => toCardDTO(post, post.project.timezone, post.project.dateFormat))}
          page={page}
          pages={pages}
          pageBase={`/autoposter/posts?status=${key}&page=`}
          emptyText="Nenhum post nesta situação."
        />
      </main>
    </>
  );
}
