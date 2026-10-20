import { notFound, redirect } from "next/navigation";
import { AutoposterNotFoundError, requirePost, requireProject } from "@/lib/autoposter/access";
import { timeInZone, ymdInZone } from "@/lib/autoposter/dates";
import { getProjectLibrary } from "@/lib/autoposter/queries";
import { canEdit } from "@/lib/autoposter/state";
import type { PostStatus } from "@/lib/autoposter/constants";
import { PostEditor } from "../../../../../_components/editor/PostEditor";

export const dynamic = "force-dynamic";

async function load(postId: string) {
  try {
    return (await requirePost(postId)).post;
  } catch (error) {
    if (error instanceof AutoposterNotFoundError) notFound();
    throw error;
  }
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  const post = await load(postId);
  if (post.projectId !== id) notFound();
  if (!canEdit(post.status as PostStatus)) redirect(`/autoposter/projeto/${id}/calendario?post=${post.id}`);
  const { project } = await requireProject(id);
  const library = await getProjectLibrary(project.id);
  const tz = project.timezone;

  return (
    <PostEditor
      project={{ id: project.id, name: project.name, publishOnlyIfApproved: project.publishOnlyIfApproved, today: ymdInZone(new Date(), tz) }}
      accounts={project.accounts.map((link) => ({
        id: link.account.id,
        username: link.account.username,
        profilePicUrl: link.account.profilePicUrl,
        status: link.account.status,
      }))}
      library={library}
      initial={{
        postId: post.id,
        targets: post.targets.map((target) => `${target.accountId}:${target.format}`),
        title: post.title,
        caption: post.caption,
        firstComment: post.firstComment,
        mediaUrls: post.mediaUrls,
        scheduleDate: post.scheduledAt ? ymdInZone(post.scheduledAt, tz) : null,
        scheduleTime: post.scheduledAt ? timeInZone(post.scheduledAt, tz) : null,
        reviewGroupId: post.reviewGroupId,
        reviewing: post.reviewStatus === "pending",
        categoryId: post.categoryId,
        publishOnlyIfApproved: post.publishOnlyIfApproved,
      }}
    />
  );
}
