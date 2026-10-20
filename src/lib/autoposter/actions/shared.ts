// Envelope comum das Server Actions do Autoposter: erro do usuário vira mensagem;
// qualquer outro erro vira texto genérico (detalhe só no log).
import { z } from "zod";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";
import { firstIssueMessage } from "@/lib/validation";

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string };

const GENERIC = "Não foi possível concluir agora. Tente de novo em instantes.";

export async function runAction<T>(label: string, action: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await action(), message };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: firstIssueMessage(error) };
    if (!(error instanceof UserFacingError)) console.error(`[autoposter] ${label} falhou:`, error instanceof Error ? error.message : error);
    return { ok: false, error: actionErrorMessage(error, GENERIC) };
  }
}
