"use client";

import { useState, useTransition } from "react";
import { INPUT, SECONDARY_BUTTON } from "@/components/ui/styles";
import { generatePassword } from "@/lib/auth/generate-password";
import { resetPasswordAction, type AdminActionState } from "./actions";

/** Super Admin define uma senha nova e a vê uma vez para repassar à pessoa. */
export function MemberPasswordReset({ workspaceId, userId, name }: { workspaceId: string; userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminActionState | null>(null);

  if (!open) {
    return (
      <button type="button" className={SECONDARY_BUTTON} onClick={() => { setPassword(generatePassword()); setFeedback(null); setOpen(true); }}>
        Redefinir senha
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink">Nova senha de {name}</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} className={`${INPUT} font-mono`} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          className={SECONDARY_BUTTON}
          onClick={() => startTransition(async () => setFeedback(await resetPasswordAction(workspaceId, userId, password)))}
        >
          {isPending ? "Salvando…" : "Salvar nova senha"}
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(false)}>Fechar</button>
      </div>
      {feedback && (
        <p role={feedback.ok ? "status" : "alert"} className={`text-sm font-medium ${feedback.ok ? "text-success" : "text-danger"}`}>{feedback.message}</p>
      )}
    </div>
  );
}
