import { requireProject } from "@/lib/autoposter/access";
import { formatTimelineDate } from "@/lib/autoposter/dates";
import { listReviewGroups } from "@/lib/autoposter/queries";
import { GroupsClient } from "../../../_components/GroupsClient";

export const dynamic = "force-dynamic";

export default async function ProjectGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project } = await requireProject(id);
  const groups = await listReviewGroups(project.id);
  const when = (date: Date) => formatTimelineDate(date, project.timezone, project.dateFormat);

  return (
    <GroupsClient
      projectId={project.id}
      groups={groups.map((group) => ({
        id: group.id,
        name: group.name,
        token: group.token,
        createdAt: when(group.createdAt),
        updatedAt: when(group.updatedAt),
        count: group.count,
        covers: group.covers,
        statuses: group.statuses,
      }))}
    />
  );
}
