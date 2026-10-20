"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { dayOfMonth, monthLabel, shortMonthLabel, WEEKDAYS_SHORT } from "@/lib/autoposter/dates";
import type { CardDTO } from "../_lib/cards";
import { PostCard, PostPill } from "./PostCard";
import { PostDetailModal } from "./PostDetailModal";
import { ShareCalendarModal } from "./ShareCalendarModal";

type Props = {
  mode: "weekly" | "monthly";
  anchor: string;
  today: string;
  days: string[];
  weeks: string[][];
  prevAnchor: string;
  nextAnchor: string;
  cards: CardDTO[];
  basePath: string;
  format: string;
  projectId?: string;
  readOnly?: boolean;
  initialPostId?: string | null;
};

const FORMAT_OPTIONS = [
  ["", "Feed, Story, Reels"],
  ["feed", "Feed"],
  ["story", "Story"],
  ["reels", "Reels"],
] as const;

export function CalendarView(props: Props) {
  const router = useRouter();
  const { mode, anchor, today, days, weeks, cards, basePath, format, readOnly } = props;
  const [openId, setOpenId] = useState<string | null>(props.initialPostId ?? null);
  const [sharing, setSharing] = useState(false);

  const href = (params: { type?: string; date?: string; formato?: string }) => {
    const query = new URLSearchParams({ type: params.type ?? mode, date: params.date ?? anchor });
    const f = params.formato ?? format;
    if (f) query.set("formato", f);
    return `${basePath}?${query.toString()}`;
  };

  const byDay = new Map<string, CardDTO[]>();
  for (const card of cards) if (card.ymd) byDay.set(card.ymd, [...(byDay.get(card.ymd) ?? []), card]);
  const open = (id: string) => {
    if (!readOnly) setOpenId(id);
  };
  const currentMonth = anchor.slice(0, 7);

  return (
    <section className="rounded-[12px] bg-white pb-10">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-6 pb-2 md:px-10">
        <h2 className="text-xl font-bold text-black">{monthLabel(mode === "weekly" ? days[3] : anchor)}</h2>
        <div className="flex items-center gap-1.5">
          <Link href={href({ date: props.prevAnchor })} className="ap-chip !h-8 !px-2" aria-label="Período anterior">
            <ArrowLeft size={16} aria-hidden />
          </Link>
          <Link href={href({ date: today })} className="ap-chip">
            Hoje
          </Link>
          <Link href={href({ date: props.nextAnchor })} className="ap-chip !h-8 !px-2" aria-label="Próximo período">
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href={href({ type: "weekly" })} className="ap-chip" aria-current={mode === "weekly" ? "true" : undefined}>
            Semanal
          </Link>
          <Link href={href({ type: "monthly" })} className="ap-chip" aria-current={mode === "monthly" ? "true" : undefined}>
            Mensal
          </Link>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="ap-field">
            <span className="ap-field-label">Formato</span>
            <select className="ap-input !min-h-8 !py-1 pr-8 text-sm" value={format} onChange={(event) => router.push(href({ formato: event.target.value }))}>
              {FORMAT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {!readOnly && props.projectId && (
            <button type="button" className="ap-btn ap-btn-tertiary ap-btn-md" onClick={() => setSharing(true)}>
              <ExternalLink size={14} aria-hidden /> Compartilhar
            </button>
          )}
        </div>
      </div>

      {mode === "weekly" ? (
        <div className="relative overflow-x-auto px-4 md:px-10">
          <div className="grid min-w-[840px] grid-cols-7">
            {days.map((day, index) => {
              const list = byDay.get(day) ?? [];
              return (
                <div key={day} className={`flex min-h-[460px] flex-col gap-2 px-2 pb-6 ${index > 0 ? "border-l border-ap-line" : ""}`}>
                  <div className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-ap-subtle">
                    {WEEKDAYS_SHORT[index]}
                    <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-bold ${day === today ? "bg-ap-pink text-white" : "bg-ap-bg text-ap-subtle"}`}>
                      {dayOfMonth(day)}
                    </span>
                  </div>
                  {list.map((card) => (
                    <PostCard key={card.id} card={card} onOpen={open} />
                  ))}
                </div>
              );
            })}
          </div>
          {cards.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xl text-ap-muted">
              <span className="bg-white px-3">Nenhum post para essa semana</span>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto px-4 md:px-10">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-7 py-2 text-center text-xs font-bold text-ap-subtle">
              {WEEKDAYS_SHORT.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} className="grid grid-cols-7 border-b border-ap-line-strong/60">
                {week.map((day, index) => {
                  const list = byDay.get(day) ?? [];
                  const outside = day.slice(0, 7) !== currentMonth;
                  return (
                    <div key={day} className={`flex min-h-[146px] flex-col gap-1.5 p-2 ${index > 0 ? "border-l border-ap-line-strong/60" : ""} ${day === today ? "bg-ap-bg" : ""}`}>
                      <span
                        className={`ml-auto flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold ${
                          day === today ? "bg-ap-pink text-white" : outside ? "text-ap-line-strong" : "bg-ap-bg text-ap-subtle"
                        }`}
                      >
                        {outside && dayOfMonth(day) >= 28 ? `${dayOfMonth(day)} de ${shortMonthLabel(day)}.` : dayOfMonth(day)}
                      </span>
                      {list.map((card) => (
                        <PostPill key={card.id} card={card} onOpen={open} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {openId && <PostDetailModal postId={openId} onClose={() => setOpenId(null)} />}
      {sharing && props.projectId && <ShareCalendarModal projectId={props.projectId} onClose={() => setSharing(false)} />}
    </section>
  );
}
