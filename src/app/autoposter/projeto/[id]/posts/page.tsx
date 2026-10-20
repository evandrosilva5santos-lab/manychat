import { requireProject } from "@/lib/autoposter/access";
import { POST_STATUSES, STATUS_FILTERS, type PostStatus } from "@/lib/autoposter/constants";
import { listPostsPage } from "@/lib/autoposter/queries";
import { PostsGrid } from "../../../_components/PostsGrid";
import { toCardDTO } from "../../../_lib/cards";

export const dynamic = "force-dynamic";

export default async function ProjectPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const { project } = await requireProject(id);
  const status = (POST_STATUSES as readonly string[]).includes(search.status ?? "") ? (search.status as PostStatus) : "all";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const { posts, pages, counts } = await listPostsPage(project.id, status, page);
  const base = `/autoposter/projeto/${project.id}/posts`;

  return (
    <PostsGrid
      chips={STATUS_FILTERS.map((filter) => ({
        key: filter.key,
        label: filter.label,
        href: `${base}?status=${filter.key}`,
        count: filter.key === "all" ? undefined : counts[filter.key as PostStatus],
        active: filter.key === status,
        tone: filter.key === "approved" ? "green" : filter.key === "scheduled" ? "blue" : undefined,
      }))}
      cards={posts.map((post) => toCardDTO(post, project.timezone, project.dateFormat))}
      page={page}
      pages={pages}
      pageBase={`${base}?status=${status}&page=`}
      emptyText={status === "all" ? "Nenhum post criado ainda. Use “Novo post” para começar." : "Nenhum post com este status."}
    />
  );
}
