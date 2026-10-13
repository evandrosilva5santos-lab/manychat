"use server";

import { assertCanAddMember } from "@/lib/billing/entitlements";
import { startSession } from "@/lib/auth/session";
import { acceptInvitation } from "@/lib/team/team";
import { getCurrentActor } from "@/lib/tenancy";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type AcceptResult = { ok: true } | { ok: false; message: string };

export async function acceptInvite(token: string, name?: string, password?: string): Promise<AcceptResult> {
  try {
    const actor = await getCurrentActor();
    const { userId } = await acceptInvitation(token, { actor, name, password }, assertCanAddMember);
    if (!actor) await startSession(userId);
    return { ok: true };
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("[convite] aceite falhou", error instanceof Error ? error.name : "erro desconhecido");
    return { ok: false, message: actionErrorMessage(error, "Não foi possível aceitar o convite agora. Tente de novo.") };
  }
}
