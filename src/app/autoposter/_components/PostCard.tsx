"use client";

import { Check, Play } from "lucide-react";
import { STATUS_META } from "@/lib/autoposter/constants";
import type { CardDTO } from "../_lib/cards";
import { MediaThumb, NetworkStack, TONE_DOT, TONE_SOFT, TONE_TEXT } from "../_ui/primitives";

const PROBLEM = new Set(["not_published", "failed"]);

function Overlay({ card }: { card: CardDTO }) {
  if (PROBLEM.has(card.status)) {
    return <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ap-orange text-xs font-bold text-white">!</span>;
  }
  if (card.approved) {
    return (
      <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ap-green text-white">
        <Check size={13} strokeWidth={3} aria-label="Aprovado" />
      </span>
    );
  }
  return null;
}

/** Card do calendário semanal e da grade "Meus posts". */
export function PostCard({ card, onOpen, showDate = false }: { card: CardDTO; onOpen: (id: string) => void; showDate?: boolean }) {
  const meta = STATUS_META[card.status];
  const problem = PROBLEM.has(card.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className={`flex w-full flex-col gap-2 rounded-[12px] border-2 bg-ap-bg p-2 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ap-primary ${problem ? "border-ap-orange-line" : "border-transparent"}`}
      aria-label={`${card.title} — ${meta.label}`}
    >
      <span className="flex items-center justify-between gap-1">
        <NetworkStack networks={card.networks} size={22} />
        {card.categoryColor && <span className="h-2.5 w-2.5 rounded-full" style={{ background: card.categoryColor }} aria-hidden />}
      </span>
      <span className="relative block aspect-square w-full overflow-hidden rounded-[10px] bg-ap-line">
        <MediaThumb url={card.thumb} className="h-full w-full" />
        {card.isVideo && <Play size={16} className="absolute right-2 bottom-2 fill-white text-white drop-shadow" aria-hidden />}
        {(card.time || card.when) && (
          <span className="absolute top-2 left-2 max-w-[80%] truncate rounded-full bg-white/95 px-2 py-0.5 text-xs text-ap-muted">
            {showDate ? card.when : card.time}
          </span>
        )}
        <Overlay card={card} />
        <span className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
          <span className="rounded-full bg-white/95 px-2 py-0.5 text-xs text-ap-muted">{card.formatLabel}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${TONE_TEXT[meta.tone]} ${TONE_SOFT[meta.tone]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
            {meta.label}
          </span>
        </span>
      </span>
    </button>
  );
}

/** Pílula de uma linha do calendário mensal. */
export function PostPill({ card, onOpen }: { card: CardDTO; onOpen: (id: string) => void }) {
  const meta = STATUS_META[card.status];
  const problem = PROBLEM.has(card.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className={`flex h-6 w-full items-center gap-1.5 rounded-full px-2 text-left text-xs ${TONE_SOFT[meta.tone]} ${problem ? "ring-2 ring-ap-orange-line" : ""} hover:brightness-95`}
      aria-label={`${card.time ?? ""} ${card.title} — ${meta.label}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
      <NetworkStack networks={card.networks} size={16} />
      <span className="ml-auto text-ap-muted">{card.time}</span>
      {card.approved && !problem && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ap-green text-white">
          <Check size={10} strokeWidth={3} aria-hidden />
        </span>
      )}
      {problem && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ap-orange text-[10px] font-bold text-white">!</span>}
    </button>
  );
}
