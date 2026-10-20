"use client";

import { useState, useTransition } from "react";
import { FORMAT_LABEL, type PostFormat } from "@/lib/autoposter/constants";
import { invalidateReview } from "@/lib/autoposter/actions/posts";
import type { PostDetailDTO } from "@/lib/autoposter/actions/detail";
import { actorLabel, TIMELINE_PILL, timelinePhrase, timelineTone } from "@/lib/autoposter/timeline";
import { NetworkBadge, TONE_DOT, TONE_TEXT } from "../_ui/primitives";

export function PostTimeline({ timeline, onChanged }: { timeline: PostDetailDTO["timeline"]; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (timeline.length === 0) return <p className="py-6 text-sm text-ap-muted">Nenhum evento ainda.</p>;

  const invalidate = (reviewId: string) =>
    startTransition(async () => {
      const result = await invalidateReview(reviewId);
      if (!result.ok) return setError(result.error);
      onChanged();
    });

  return (
    <ol className="flex flex-col">
      {error && <li role="alert" className="mb-3 rounded-lg bg-ap-red-soft px-3 py-2 text-sm text-ap-red">{error}</li>}
      {timeline.map((entry, index) => {
        const tone = timelineTone(entry.code);
        const pill = TIMELINE_PILL[entry.code];
        const who = actorLabel(entry);
        return (
          <li key={entry.id} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ap-ink">
              <span>{entry.when}</span>
              {entry.network && <NetworkBadge network={entry.network} size={18} />}
              {entry.format && <span className="font-semibold">{FORMAT_LABEL[entry.format as PostFormat] ?? entry.format}</span>}
              {pill && (
                <span className={`inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-ap-line ${TONE_TEXT[tone]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
                  {pill}
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${entry.actorType === "client" ? "bg-ap-pink" : entry.actorType === "system" ? "bg-ap-title" : "bg-ap-purple"}`}
                aria-hidden
              >
                {who.charAt(0)}
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-ap-subtle">{who}</span>
              <span className="text-ap-subtle">{timelinePhrase(entry)}</span>
            </p>
            {entry.note && <p className="rounded-lg bg-ap-bg px-3 py-2 text-sm whitespace-pre-wrap text-ap-ink">{entry.note}</p>}
            {entry.reviewId && entry.reviewValid && entry.actorType === "client" && (
              <p className="text-[11px] text-ap-muted">
                Não reconhece essa revisão?{" "}
                <button type="button" disabled={pending} onClick={() => invalidate(entry.reviewId as string)} className="font-semibold text-ap-ink underline">
                  Invalidar
                </button>
                .
              </p>
            )}
            {index < timeline.length - 1 && <span className="my-2 ml-2 h-6 w-px bg-ap-line-strong" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
