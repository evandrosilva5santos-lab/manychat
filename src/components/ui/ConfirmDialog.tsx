"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { matchesConfirmation } from "./confirm-match";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Rótulo do botão destrutivo enquanto a ação roda (ex.: "Descarregando…"). */
  busyLabel?: string;
  cancelLabel?: string;
  tone?: "danger";
  busy?: boolean;
  /** Recebe o texto digitado (vazio quando não há `requireText`), para o servidor conferir de novo. */
  onConfirm: (typed: string) => void;
  onCancel: () => void;
  /** Texto que a pessoa precisa digitar (ex.: o @ do perfil) para liberar o botão destrutivo. */
  requireText?: string;
  requireTextLabel?: string;
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BUTTON_BASE = `inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold ${FOCUS_RING}`;

/**
 * Diálogo de confirmação acessível sobre o <dialog> nativo. Existe só enquanto
 * `open` for verdadeiro: montar abre o diálogo e desmontar devolve o foco ao
 * elemento que o abriu. O foco inicial nunca cai no botão destrutivo.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <OpenConfirmDialog {...props} />;
}

function OpenConfirmDialog({
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
  requireText,
  requireTextLabel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;
  const hintId = `${uid}-hint`;
  const inputId = `${uid}-input`;

  const needsText = requireText !== undefined;
  const unlocked = !needsText || matchesConfirmation(typed, requireText);
  const canConfirm = unlocked && !busy;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    (inputRef.current ?? cancelRef.current)?.focus();
    return () => {
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canConfirm) onConfirm(typed);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      aria-busy={busy}
      // Esc: o <dialog> nativo dispararia "cancel" e fecharia sozinho; quem decide é o pai.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border-strong bg-surface-200 p-0 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert size={22} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <h2 id={titleId} className="text-lg font-bold leading-6 text-ink">
            {title}
          </h2>
        </div>

        <div id={bodyId} className="space-y-3 text-sm leading-6 text-ink-muted">
          {description}
        </div>

        {needsText && (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
              {requireTextLabel}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`min-h-11 w-full rounded-md border border-border-strong bg-surface-100 px-3 text-sm text-ink ${FOCUS_RING}`}
            />
            <p id={hintId} className="text-xs text-ink-muted">
              {unlocked ? "Nome conferido. O botão está liberado." : "O botão fica liberado quando o nome digitado conferir."}
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 min-[400px]:flex-row min-[400px]:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`${BUTTON_BASE} border border-border-strong bg-surface-200 text-ink hover:bg-surface-300 disabled:opacity-45`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            aria-disabled={!canConfirm}
            aria-busy={busy}
            aria-describedby={needsText && !unlocked ? hintId : undefined}
            className={`${BUTTON_BASE} bg-danger text-on-primary ${
              canConfirm ? "hover:opacity-90" : "cursor-not-allowed opacity-45"
            }`}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
