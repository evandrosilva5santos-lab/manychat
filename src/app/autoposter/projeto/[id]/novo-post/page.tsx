import { requireProject } from "@/lib/autoposter/access";
import { ymdInZone } from "@/lib/autoposter/dates";
import { getProjectLibrary } from "@/lib/autoposter/queries";
import { PostEditor } from "../../../_components/editor/PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project } = await requireProject(id);
  const library = await getProjectLibrary(project.id);

  return (
    <PostEditor
      project={{ id: project.id, name: project.name, publishOnlyIfApproved: project.publishOnlyIfApproved, today: ymdInZone(new Date(), project.timezone) }}
      accounts={project.accounts.map((link) => ({
        id: link.account.id,
        username: link.account.username,
        profilePicUrl: link.account.profilePicUrl,
        status: link.account.status,
      }))}
      library={library}
    />
  );
}
