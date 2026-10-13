"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Copy, UserPlus } from "lucide-react";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { generatePassword } from "@/lib/auth/generate-password";
import { addTeamCollaborator, type TeamActionResult } from "./actions";

type Props = { canCreateAdmin: boolean; onDone: (result: TeamActionResult) => void };
type Created = { email: string; password: string | null };

function CredentialsCard({ created, onClose }: { created: Created; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = created.password
    ? `Seu acesso ao instachat:\n${window.location.origin}/login\nE-mail: ${created.email}\nSenha: ${created.password}`
    : `Você agora tem acesso à nossa equipe no instachat:\n${window.location.origin}/login\nEntre com o e-mail ${created.email} e a senha que você já usa.`;
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-live="polite" aria-label="Dados de acesso">
      <pre className="whitespace-pre-wrap rounded-md bg-surface-300 p-3 font-mono text-sm text-ink">{text}</pre>
      <p className="text-xs text-ink-muted">A senha não aparece de novo. Se a pessoa perder, use Redefinir senha.</p>
      <div className="flex gap-2">
        <button type="button" className={PRIMARY_BUTTON} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}>
          <Copy size={16} aria-hidden /> {copied ? "Copiado!" : "Copiar acesso"}
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>Fechar</button>
      </div>
    </section>
  );
}

/** Dono/admin cria o login do colaborador na hora, com senha inicial. */
export function AddCollaboratorForm({ canCreateAdmin, onDone }: Props) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState(() => generatePassword());
  const [created, setCreated] = useState<Created | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    startTransition(async () => {
      const result = await addTeamCollaborator({ name: String(data.get("name") ?? ""), email, role: String(data.get("role")), password });
      onDone(result);
      if (!result.ok) return;
      setCreated({ email, password: result.passwordSet ? password : null });
      setPassword(generatePassword());
      form.reset();
    });
  }

  if (created) return <CredentialsCard created={created} onClose={() => setCreated(null)} />;

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-3`} aria-labelledby="novo-colaborador">
      <h2 id="novo-colaborador" className="text-base font-bold text-ink">Adicionar colaborador</h2>
      <p className="text-sm text-ink-muted">Cria o login da pessoa agora. Você recebe os dados de acesso para enviar a ela.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Nome</span>
          <input name="name" required minLength={2} maxLength={80} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">E-mail de login</span>
          <input name="email" type="email" required maxLength={200} placeholder="pessoa@empresa.com" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Papel</span>
          <select name="role" defaultValue="OPERATOR" className={INPUT}>
            <option value="OPERATOR">Atendente</option>
            {canCreateAdmin && <option value="ADMIN">Administrador</option>}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Senha inicial</span>
          <div className="flex gap-2">
            <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className={`${INPUT} w-full font-mono`} aria-label="Senha inicial" />
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setPassword(generatePassword())}>Gerar</button>
          </div>
        </label>
      </div>
      <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON} self-start`}>
        <UserPlus size={16} aria-hidden /> {isPending ? "Criando…" : "Criar acesso"}
      </button>
    </form>
  );
}
