import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FORMAT_LABEL, type PostFormat, type PostStatus } from "@/lib/autoposter/constants";
import { formatDateTime } from "@/lib/autoposter/dates";
import { getReviewerByToken, getReviewGroupByToken, listReviewPosts } from "@/lib/autoposter/queries";
import { ReviewBoard } from "../../../../_components/review/ReviewBoard";
import { Avatar } from "../../../../_ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aprovação de posts", robots: { index: false, follow: false } };

const CLOSED = new Set(["publishing", "published", "not_published", "failed"]);

export default async function ReviewPostsPage({ params }: { params: Promise<{ token: string; reviewer: string }> }) {
  const { token, reviewer: reviewerToken } = await params;
  const group = await getReviewGroupByToken(token);
  if (!group) notFound();
  const reviewer = await getReviewerByToken(group.id, reviewerToken);
  if (!reviewer) notFound();
  const posts = await listReviewPosts(group.id);
  const { timezone, dateFormat } = group.project;
  const logo = group.project.logoUrl ?? group.project.accounts[0]?.account.profilePicUrl ?? null;

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-10">
      <header className="mb-8 flex items-center gap-4">
        <Avatar src={logo} name={group.project.name} size={48} />
        <div>
          <p className="text-xs font-semibold text-ap-subtle">{group.project.workspace.name}</p>
          <h1 className="ap-title text-2xl">{group.name}</h1>
          <p className="text-sm text-ap-subtle">Olá, {reviewer.name}. Revise cada post e envie no fim da página.</p>
        </div>
      </header>
      <ReviewBoard
        token={token}
        reviewerToken={reviewerToken}
        posts={posts.map((post) => {
          const last = post.reviews[0];
          const formats = [...new Set(post.targets.map((target) => FORMAT_LABEL[target.format as PostFormat] ?? target.format))];
          return {
            id: post.id,
            title: post.title ?? "",
            caption: post.caption,
            firstComment: post.firstComment,
            mediaUrls: post.mediaUrls,
            when: post.scheduledAt ? formatDateTime(post.scheduledAt, timezone, dateFormat).replace(" ", " às ") : null,
            formatLabel: formats.join(", ") || "Feed",
            networks: post.targets.map((target) => target.network),
            username: post.targets[0]?.account.username ?? "",
            status: post.status as PostStatus,
            closed: CLOSED.has(post.status),
            last: last
              ? {
                  media: last.mediaDecision ?? last.decision,
                  mediaComment: last.comment,
                  caption: last.captionDecision ?? last.decision,
                  captionComment: last.captionComment,
                  by: last.reviewer.name,
                }
              : null,
          };
        })}
      />
    </main>
  );
}
