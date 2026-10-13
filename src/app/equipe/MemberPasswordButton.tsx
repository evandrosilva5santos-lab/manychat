"use client";

import { useState } from "react";
import { INPUT, SECONDARY_BUTTON } from "@/components/ui/styles";
import { generatePassword } from "@/lib/auth/generate-password";

/** Abre um campo com senha sugerida; ao salvar, quem chamou mostra o resultado. */
export function MemberPasswordButton({ name, onSave }: { name: string; onSave: (password: string) => void }) {
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (password === null) {
    return (
      <button type="button" className={SECONDARY_BUTTON} onClick={() => { setCopied(false); setPassword(generatePassword()); }}>
        Redefinir senha
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} aria-label={`Nova senha de ${name}`} className={`${INPUT} w-40 font-mono`} />
      <button
        type="button"
        className={SECONDARY_BUTTON}
        onClick={() => {
          onSave(password);
          navigator.clipboard?.writeText(password).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        Salvar
      </button>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => setPassword(null)}>{copied ? "Fechar (senha copiada)" : "Cancelar"}</button>
    </div>
  );
}
