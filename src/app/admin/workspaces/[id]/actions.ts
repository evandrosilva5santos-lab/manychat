"use server";

import { revalidatePath } from "next/cache";
import { setWorkspaceSubscription } from "@/lib/billing/admin";
import { recordManualPayment, resetMemberPassword } from "@/lib/billing/payments";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type AdminActionState = { ok: boolean; message: string };

async function run(workspaceId: string, label: string, success: string, action: () => Promise<unknown>): Promise<AdminActionState> {
  try {
    await action();
    revalidatePath(`/admin/workspaces/${workspaceId}`);
    return { ok: true, message: success };
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error(`[admin/workspace] falha: ${label}`, error instanceof Error ? error.name : "erro");
    return { ok: false, message: actionErrorMessage(error, "Não foi possível salvar agora.") };
  }
}

export async function setSubscriptionAction(workspaceId: string, input: unknown): Promise<AdminActionState> {
  return run(workspaceId, "assinatura", "Assinatura atualizada.", () => setWorkspaceSubscription(workspaceId, input));
}

export async function recordPaymentAction(workspaceId: string, input: unknown): Promise<AdminActionState> {
  return run(workspaceId, "pagamento", "Pagamento registrado. O cliente está ativo até o fim do período pago.", () =>
    recordManualPayment(workspaceId, input),
  );
}

export async function resetPasswordAction(workspaceId: string, userId: string, password: string): Promise<AdminActionState> {
  return run(workspaceId, "senha", "Senha redefinida. Envie a nova senha para a pessoa; as sessões antigas foram encerradas.", () =>
    resetMemberPassword(workspaceId, String(userId), String(password)),
  );
}
