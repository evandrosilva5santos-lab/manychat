// Datas do calendário no fuso do projeto. Dias são strings "YYYY-MM-DD" (sem fuso);
// instantes são Date em UTC. Semana começa no domingo, como no Flux.

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string | null | undefined): value is string {
  if (!value || !YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const date = toUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
}

export function weekday(ymd: string): number {
  return toUtcDate(ymd).getUTCDay();
}

export function dayOfMonth(ymd: string): number {
  return Number(ymd.slice(8, 10));
}

export function startOfWeek(ymd: string): string {
  return addDays(ymd, -weekday(ymd));
}

export function weekDays(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Grade do mês: semanas completas (domingo a sábado) que cobrem o mês do `anchor`. */
export function monthGrid(anchor: string): string[][] {
  const first = `${anchor.slice(0, 7)}-01`;
  const lastDate = toUtcDate(first);
  lastDate.setUTCMonth(lastDate.getUTCMonth() + 1, 0);
  const last = fromUtcDate(lastDate);
  const weeks: string[][] = [];
  for (let day = startOfWeek(first); day <= last; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  return weeks;
}

export function shiftMonth(anchor: string, months: number): string {
  const date = toUtcDate(`${anchor.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return fromUtcDate(date);
}

export function monthLabel(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]}, ${ymd.slice(0, 4)}`;
}

export function shortMonthLabel(ymd: string): string {
  return MONTHS[Number(ymd.slice(5, 7)) - 1].slice(0, 3).toLowerCase();
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Diferença (ms) entre o relógio do fuso e o UTC no instante dado. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(Number(p.y), Number(p.m) - 1, Number(p.d), Number(p.h), Number(p.min), Number(p.s));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function ymdInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.y}-${p.m}-${p.d}`;
}

export function timeInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.h}:${p.min}`;
}

/** Converte "dia + hora no relógio do fuso" para o instante UTC correspondente. */
export function zonedToUtc(ymd: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** Intervalo UTC [início, fim) que cobre os dias `from`..`to` inteiros no fuso. */
export function utcRange(from: string, to: string, timeZone: string): { gte: Date; lt: Date } {
  return { gte: zonedToUtc(from, "00:00", timeZone), lt: zonedToUtc(addDays(to, 1), "00:00", timeZone) };
}

export function formatDate(date: Date, timeZone: string, format: string): string {
  const [y, m, d] = ymdInZone(date, timeZone).split("-");
  return format === "MM/DD/YYYY" ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

export function formatDateTime(date: Date, timeZone: string, format: string): string {
  return `${formatDate(date, timeZone, format)} ${timeInZone(date, timeZone)}`;
}

/** "07/10/26 às 10:06", como no histórico do Flux. */
export function formatTimelineDate(date: Date, timeZone: string, format: string): string {
  const full = formatDate(date, timeZone, format);
  return `${full.slice(0, 6)}${full.slice(8)} às ${timeInZone(date, timeZone)}`;
}
