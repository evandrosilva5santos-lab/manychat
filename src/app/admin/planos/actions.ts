"use server";

import { revalidatePath } from "next/cache";
import { savePlan } from "@/lib/billing/admin";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type AdminActionState = { ok: boolean; message: string };

export async function savePlanAction(planId: string | null, input: unknown): Promise<AdminActionState> {
  try {
    const plan = await savePlan(planId, input);
    revalidatePath("/admin/planos");
    return { ok: true, message: `Plano ${plan.name} salvo.` };
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("[admin/planos] falha ao salvar", error instanceof Error ? error.name : "erro");
    return { ok: false, message: actionErrorMessage(error, "Não foi possível salvar o plano.") };
  }
}
