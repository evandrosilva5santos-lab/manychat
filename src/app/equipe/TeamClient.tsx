"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Copy, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { canResetPassword } from "@/lib/team/roles";
import { AddCollaboratorForm } from "./AddCollaboratorForm";
import { cancelInvitation, inviteMember, removeTeamMember, resetTeamMemberPassword, updateTeamMemberRole, type TeamActionResult } from "./actions";
import { MemberPasswordButton } from "./MemberPasswordButton";

type Role = "OWNER" | "ADMIN" | "OPERATOR";
type Member = { id: string; userId: string; name: string; email: string; role: Role };
type Invitation = { id: string; email: string; role: Role; expiresAt: string };

const ROLE_LABEL: Record<Role, string> = { OWNER: "Dono", ADMIN: "Administrador", OPERATOR: "Atendente" };
const ROLE_HINT: Record<Role, string> = {
  OWNER: "Plano, cobrança e tudo o mais.",
  ADMIN: "Conecta perfis, cria automações e cuida da equipe.",
  OPERATOR: "Atende conversas e contatos.",
};

export function TeamClient(props: {
  workspaceName: string;
  currentUserId: string;
  canManage: boolean;
  currentRole: Role;
  members: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<TeamActionResult | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  function run(action: () => Promise<TeamActionResult>, after?: (result: TeamActionResult) => void) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) {
        after?.(result);
        router.refresh();
      }
    });
  }

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () => inviteMember(String(data.get("email") ?? ""), String(data.get("role") ?? "")),
      (result) => {
        form.reset();
        if (result.ok && result.invitePath) setInviteLink(`${window.location.origin}${result.invitePath}`);
      },
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Equipe</h1>
        <p className="mt-1 text-sm text-ink-muted">Quem tem acesso ao workspace {props.workspaceName} e o que cada pessoa pode fazer.</p>
      </header>

      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`rounded-md border px-4 py-3 text-sm font-medium text-ink ${feedback.ok ? "border-success bg-success-soft" : "border-danger bg-danger-soft"}`}
        >
          {feedback.message}
        </p>
      )}

      {inviteLink && (
        <section className={`${CARD} flex flex-col gap-3`} aria-label="Link do convite">
          <p className="text-sm text-ink">Envie este link para a pessoa. Ele vale por 7 dias e só pode ser usado uma vez.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={inviteLink} className={`${INPUT} flex-1`} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={SECONDARY_BUTTON} onClick={() => navigator.clipboard?.writeText(inviteLink)}>
              <Copy size={16} aria-hidden /> Copiar
            </button>
          </div>
        </section>
      )}

      {props.canManage && (
        <AddCollaboratorForm
          canCreateAdmin={props.currentRole === "OWNER"}
          onDone={(result) => {
            setFeedback(result);
            if (result.ok) router.refresh();
          }}
        />
      )}

      {props.canManage && (
        <form onSubmit={onInvite} className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-end`} aria-label="Convidar por link">
          <p className="text-sm text-ink-muted sm:w-48">Ou convide por link: a pessoa escolhe a própria senha.</p>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">E-mail</span>
            <input name="email" type="email" required placeholder="pessoa@empresa.com" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Papel</span>
            <select name="role" defaultValue="OPERATOR" className={INPUT}>
              <option value="OPERATOR">{ROLE_LABEL.OPERATOR}</option>
              {props.currentRole === "OWNER" && <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>}
            </select>
          </label>
          <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
            <UserPlus size={16} aria-hidden /> Convidar
          </button>
        </form>
      )}

      <section aria-labelledby="membros" className="flex flex-col gap-3">
        <h2 id="membros" className="text-base font-bold text-ink">Pessoas ({props.members.length})</h2>
        <ul className="flex flex-col gap-2" aria-busy={isPending}>
          {props.members.map((member) => {
            const editable = props.canManage && member.role !== "OWNER" && member.userId !== props.currentUserId;
            return (
              <li key={member.id} className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-center`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{member.name}</p>
                  <p className="truncate text-xs text-ink-muted">{member.email}</p>
                </div>
                {editable ? (
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label={`Papel de ${member.name}`}
                      value={member.role}
                      disabled={isPending}
                      onChange={(e) => run(() => updateTeamMemberRole(member.id, e.target.value))}
                      className={INPUT}
                    >
                      <option value="OPERATOR">{ROLE_LABEL.OPERATOR}</option>
                      <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                    </select>
                    {canResetPassword(props.currentRole, member.role) && (
                      <MemberPasswordButton name={member.name} onSave={(password) => run(() => resetTeamMemberPassword(member.id, password))} />
                    )}
                    <button type="button" className={SECONDARY_BUTTON} onClick={() => setRemoveTarget(member)}>
                      Remover
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-ink-muted" title={ROLE_HINT[member.role]}>{ROLE_LABEL[member.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {props.invitations.length > 0 && (
        <section aria-labelledby="convites" className="flex flex-col gap-3">
          <h2 id="convites" className="text-base font-bold text-ink">Convites pendentes</h2>
          <ul className="flex flex-col gap-2">
            {props.invitations.map((invite) => (
              <li key={invite.id} className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-center`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{invite.email}</p>
                  <p className="text-xs text-ink-muted">
                    {ROLE_LABEL[invite.role]} · vence em {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {props.canManage && (
                  <button type="button" className={SECONDARY_BUTTON} disabled={isPending} onClick={() => run(() => cancelInvitation(invite.id))}>
                    Cancelar convite
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${CARD} text-sm text-ink-muted`} aria-label="O que cada papel pode fazer">
        <ul className="flex flex-col gap-1">
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <li key={role}>
              <strong className="text-ink">{ROLE_LABEL[role]}:</strong> {ROLE_HINT[role]}
            </li>
          ))}
        </ul>
      </section>

      {removeTarget && (
        <ConfirmDialog
          open
          tone="danger"
          title={`Remover ${removeTarget.name}?`}
          description="A pessoa perde o acesso a este workspace na hora. Dá para convidar de novo depois."
          confirmLabel="Remover"
          busyLabel="Removendo…"
          busy={isPending}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => run(() => removeTeamMember(removeTarget.id), () => setRemoveTarget(null))}
        />
      )}
    </main>
  );
}
