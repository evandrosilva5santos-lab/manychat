import { requireProject } from "@/lib/autoposter/access";
import { listCalendarPosts } from "@/lib/autoposter/queries";
import { CalendarView } from "../../../_components/CalendarView";
import { calendarParams, type CalendarSearch } from "../../../_lib/calendar";
import { toCardDTO } from "../../../_lib/cards";

export const dynamic = "force-dynamic";

export default async function ProjectCalendarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<CalendarSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const { project } = await requireProject(id);
  const view = calendarParams(search, project.timezone);
  const posts = await listCalendarPosts(project.id, view.from, view.to, project.timezone, view.format ? [view.format] : undefined);

  return (
    <CalendarView
      mode={view.mode}
      anchor={view.anchor}
      today={view.today}
      days={view.days}
      weeks={view.weeks}
      prevAnchor={view.prevAnchor}
      nextAnchor={view.nextAnchor}
      format={view.format}
      cards={posts.map((post) => toCardDTO(post, project.timezone, project.dateFormat))}
      basePath={`/autoposter/projeto/${project.id}/calendario`}
      projectId={project.id}
      initialPostId={typeof search.post === "string" ? search.post : null}
    />
  );
}
