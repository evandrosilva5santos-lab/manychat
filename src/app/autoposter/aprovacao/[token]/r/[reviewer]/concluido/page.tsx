import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getReviewerByToken, getReviewGroupByToken } from "@/lib/autoposter/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisão enviada", robots: { index: false, follow: false } };

function summary(approved: number, adjustments: number) {
  const parts: string[] = [];
  if (approved > 0) parts.push(`${approved} post${approved > 1 ? "s" : ""} aprovado${approved > 1 ? "s" : ""}`);
  if (adjustments > 0) parts.push(`${adjustments} pedido${adjustments > 1 ? "s" : ""} de ajuste`);
  return parts.join(" e ");
}

export default async function ReviewDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; reviewer: string }>;
  searchParams: Promise<{ aprovados?: string; ajustes?: string }>;
}) {
  const [{ token, reviewer: reviewerToken }, search] = await Promise.all([params, searchParams]);
  const group = await getReviewGroupByToken(token);
  if (!group) notFound();
  const reviewer = await getReviewerByToken(group.id, reviewerToken);
  if (!reviewer) notFound();
  const text = summary(Number.parseInt(search.aprovados ?? "0", 10) || 0, Number.parseInt(search.ajustes ?? "0", 10) || 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-24 text-center">
      <CheckCircle2 size={72} className="text-ap-green" aria-hidden />
      <h1 className="ap-title mt-6 text-3xl">Parabéns, revisão enviada!</h1>
      <p className="mt-4 max-w-md text-ap-ink">
        Obrigado, {reviewer.name}.{text ? ` ${text}.` : ""} A equipe de {group.project.workspace.name} já vê a sua revisão no histórico de cada post.
      </p>
      <Link href={`/autoposter/aprovacao/${token}/r/${reviewerToken}`} className="ap-btn ap-btn-outline mt-10">
        Voltar aos posts
      </Link>
    </main>
  );
}
