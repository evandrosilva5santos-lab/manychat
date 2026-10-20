// Período do calendário a partir da URL (?type=weekly|monthly&date=YYYY-MM-DD&formato=feed).
import { addDays, isYmd, monthGrid, shiftMonth, weekDays, ymdInZone } from "@/lib/autoposter/dates";

export type CalendarSearch = { type?: string; date?: string; formato?: string; post?: string };

export function calendarParams(search: CalendarSearch, timeZone: string) {
  const today = ymdInZone(new Date(), timeZone);
  const mode: "weekly" | "monthly" = search.type === "monthly" ? "monthly" : "weekly";
  const anchor = isYmd(search.date) ? search.date : today;
  const days = weekDays(anchor);
  const weeks = monthGrid(anchor);
  const from = mode === "weekly" ? days[0] : weeks[0][0];
  const to = mode === "weekly" ? days[6] : weeks[weeks.length - 1][6];
  const format = ["feed", "story", "reels"].includes(search.formato ?? "") ? (search.formato as string) : "";
  return {
    today,
    mode,
    anchor,
    days,
    weeks,
    from,
    to,
    format,
    prevAnchor: mode === "weekly" ? addDays(anchor, -7) : shiftMonth(anchor, -1),
    nextAnchor: mode === "weekly" ? addDays(anchor, 7) : shiftMonth(anchor, 1),
  };
}
