"use server";

import { revalidatePath } from "next/cache";
import { assertCanAddMember } from "@/lib/billing/entitlements";
import { addCollaborator, resetCollaboratorPassword } from "@/lib/team/collaborators";
import { changeMemberRole, createInvitation, removeMember, revokeInvitation } from "@/lib/team/team";
import { getCurrentWorkspace } from "@/lib/tenancy";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type TeamActionResult = { ok: true; message: string; invitePath?: string; passwordSet?: boolean } | { ok: false; message: string };

const GENERIC_FAILURE = "Não foi possível concluir agora. Tente de novo em instantes.";

async function run(action: (workspaceId: string) => Promise<TeamActionResult>): Promise<TeamActionResult> {
  try {
    const { workspace } = await getCurrentWorkspace();
    const result = await action(workspace.id);
    revalidatePath("/equipe");
    return result;
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("[equipe] ação falhou", error instanceof Error ? error.name : "erro desconhecido");
    return { ok: false, message: actionErrorMessage(error, GENERIC_FAILURE) };
  }
}

export async function inviteMember(email: string, role: string): Promise<TeamActionResult> {
  return run(async (workspaceId) => {
    const invite = await createInvitation(workspaceId, email, role, () => assertCanAddMember(workspaceId));
    return { ok: true, message: `Convite criado para ${invite.email}. Copie o link e envie para a pessoa.`, invitePath: invite.path };
  });
}

export async function cancelInvitation(invitationId: string): Promise<TeamActionResult> {
  return run(async (workspaceId) => {
    await revokeInvitation(workspaceId, invitationId);
    return { ok: true, message: "Convite cancelado." };
  });
}

export async function removeTeamMember(memberId: string): Promise<TeamActionResult> {
  return run(async (workspaceId) => {
    await removeMember(workspaceId, memberId);
    return { ok: true, message: "Pessoa removida da equipe." };
  });
}

export async function updateTeamMemberRole(memberId: string, role: string): Promise<TeamActionResult> {
  return run(async (workspaceId) => {
    await changeMemberRole(workspaceId, memberId, role);
    return { ok: true, message: "Papel atualizado." };
  });
}

export async function addTeamCollaborator(input: unknown): Promise<TeamActionResult> {
  return run(async (workspaceId) => {
    const added = await addCollaborator(workspaceId, input, () => assertCanAddMember(workspaceId));
    return {
      ok: true,
      passwordSet: added.passwordSet,
      message: added.passwordSet
        ? `Acesso criado para ${added.email}. Copie os dados abaixo e envie para a pessoa.`
        : `${added.email} já tinha conta no instachat: agora tem acesso a esta equipe e entra com a senha que já usa.`,
    };
  });
}

export async function resetTeamMemberPassword(memberId: string, password: string): Promise<TeamActionResult> {
  return run(async (workspaceId) => {
    await resetCollaboratorPassword(workspaceId, String(memberId), String(password));
    return { ok: true, message: "Senha redefinida. Envie a nova senha para a pessoa; ela foi desconectada dos outros aparelhos." };
  });
}
