"use server";

import { revalidatePath } from "next/cache";
import { setWorkspaceSubscription } from "@/lib/billing/admin";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type AdminActionState = { ok: boolean; message: string };

export async function setSubscriptionAction(workspaceId: string, input: unknown): Promise<AdminActionState> {
  try {
    await setWorkspaceSubscription(workspaceId, input);
    revalidatePath(`/admin/workspaces/${workspaceId}`);
    return { ok: true, message: "Assinatura atualizada." };
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("[admin/workspace] falha ao salvar", error instanceof Error ? error.name : "erro");
    return { ok: false, message: actionErrorMessage(error, "Não foi possível salvar a assinatura.") };
  }
}
