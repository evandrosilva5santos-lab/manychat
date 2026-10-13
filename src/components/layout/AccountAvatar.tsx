import { CheckCircle2, CircleAlert, PauseCircle } from "lucide-react";
import { accountStatusLabel, type AccountTone } from "./account-status";

export function initialsOf(text: string | null | undefined): string {
  const parts = (text ?? "").replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

export const TONE_TEXT: Record<AccountTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-ink-muted",
};

export function StatusIcon({ tone, size = 14 }: { tone: AccountTone; size?: number }) {
  if (tone === "success") return <CheckCircle2 size={size} aria-hidden />;
  if (tone === "warning") return <CircleAlert size={size} aria-hidden />;
  return <PauseCircle size={size} aria-hidden />;
}

type AvatarProps = {
  username: string;
  profilePicUrl: string | null;
  /** Estado do perfil: mostra a bolinha com ícone + texto para leitores de tela. */
  status?: string;
  size?: number;
};

/** Foto do perfil (ou iniciais). O estado nunca depende só da cor: ícone dentro da bolinha + texto sr-only. */
export function AccountAvatar({ username, profilePicUrl, status, size = 36 }: AvatarProps) {
  const state = status ? accountStatusLabel(status) : null;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {profilePicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profilePicUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full bg-surface-300 font-bold text-ink"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initialsOf(username)}
        </span>
      )}
      {state && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-200 ring-2 ring-surface-200 ${TONE_TEXT[state.tone]}`}
        >
          <StatusIcon tone={state.tone} size={14} />
          <span className="sr-only">{state.label}</span>
        </span>
      )}
    </span>
  );
}
