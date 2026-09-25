// Textos da interface no padrão do design system (pt-BR, datas relativas, "—" sem dado).
import type { KeywordMatch, TriggerType } from "@/generated/prisma/enums";

const quoted = (words: string[]) => words.map((word) => `“${word}”`).join(" ou ");

/** Gatilho descrito como uma frase que o cliente entende. */
export function describeTrigger(trigger: { type: TriggerType; keywords: string[]; match: KeywordMatch; payload?: string | null }) {
  const has = trigger.match === "EXACT" ? "que é exatamente" : "que inclui";
  const any = trigger.match === "ANY" || trigger.keywords.length === 0;
  switch (trigger.type) {
    case "COMMENT_KEYWORD":
      return any
        ? "O usuário deixa um comentário em uma publicação ou Reel"
        : `O usuário deixa um comentário em uma publicação ou Reel ${has} ${quoted(trigger.keywords)}`;
    case "DM_KEYWORD":
      return any ? "O usuário manda uma DM" : `O usuário manda uma DM ${has} ${quoted(trigger.keywords)}`;
    case "STORY_REPLY":
      return any ? "O usuário responde ao story" : `O usuário responde ao story com ${quoted(trigger.keywords)}`;
    case "BUTTON_CLICK":
      return trigger.payload ? `O usuário toca num botão com o payload “${trigger.payload}”` : "O usuário toca num botão";
  }
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 5 minutos", "há 2 dias". */
export function timeAgo(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "agora mesmo";
}

export const STATUS_BADGE = {
  LIVE: { label: "Ao vivo", className: "fx-badge-live" },
  DRAFT: { label: "Rascunho", className: "fx-badge-draft" },
  STOPPED: { label: "Parado", className: "fx-badge-stopped" },
} as const;
