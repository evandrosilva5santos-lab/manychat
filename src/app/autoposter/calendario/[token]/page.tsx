import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedCalendarProject, listCalendarPosts } from "@/lib/autoposter/queries";
import { CalendarView } from "../../_components/CalendarView";
import { calendarParams, type CalendarSearch } from "../../_lib/calendar";
import { toCardDTO } from "../../_lib/cards";
import { Avatar } from "../../_ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendário de posts", robots: { index: false, follow: false } };

const VISIBLE = new Set(["scheduled", "published", "publishing"]);

export default async function SharedCalendarPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<CalendarSearch> }) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
  const project = await getSharedCalendarProject(token);
  if (!project) notFound();
  const view = calendarParams(search, project.timezone);
  const posts = await listCalendarPosts(project.id, view.from, view.to, project.timezone, view.format ? [view.format] : undefined);
  const logo = project.logoUrl ?? project.accounts[0]?.account.profilePicUrl ?? null;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 sm:px-10">
      <header className="mb-10 flex items-center gap-4">
        <Avatar src={logo} name={project.name} size={48} />
        <div>
          <p className="text-xs font-semibold text-ap-subtle">{project.name}</p>
          <h1 className="ap-title text-[32px] leading-9">Calendário de posts</h1>
        </div>
      </header>
      <CalendarView
        mode={view.mode}
        anchor={view.anchor}
        today={view.today}
        days={view.days}
        weeks={view.weeks}
        prevAnchor={view.prevAnchor}
        nextAnchor={view.nextAnchor}
        format={view.format}
        cards={posts.filter((post) => VISIBLE.has(post.status)).map((post) => toCardDTO(post, project.timezone, project.dateFormat))}
        basePath={`/autoposter/calendario/${token}`}
        readOnly
      />
    </main>
  );
}
