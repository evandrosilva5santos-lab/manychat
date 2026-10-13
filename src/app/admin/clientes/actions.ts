"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/admin/console";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type NewClientResult = { ok: true; workspaceId: string; email: string } | { ok: false; message: string };

export async function createClientAction(input: unknown): Promise<NewClientResult> {
  try {
    const created = await createClient(input);
    revalidatePath("/admin/clientes");
    revalidatePath("/admin");
    return { ok: true, ...created };
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("[admin/clientes] falha ao criar cliente", error instanceof Error ? error.name : "erro");
    return { ok: false, message: actionErrorMessage(error, "Não foi possível criar o cliente agora.") };
  }
}
