import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReviewGroupByToken } from "@/lib/autoposter/queries";
import { ReviewStart } from "../../_components/review/ReviewStart";
import { Avatar } from "../../_ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aprovação de posts", robots: { index: false, follow: false } };

export default async function ReviewWelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const group = await getReviewGroupByToken(token);
  if (!group) notFound();
  const project = group.project;
  const logo = project.logoUrl ?? project.accounts[0]?.account.profilePicUrl ?? null;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <Avatar src={logo} name={project.name} size={64} />
      <p className="ap-title mt-5 text-xl !text-ap-ink">{project.workspace.name}</p>
      <ReviewStart token={token} groupName={group.name} />
    </main>
  );
}
