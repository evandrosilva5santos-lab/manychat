"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { changeMyPassword, updateMyName } from "@/lib/team/my-account";
import { SESSION_COOKIE } from "@/lib/tenancy";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type AccountActionState = { ok: boolean; message: string } | null;

function failure(error: unknown, fallback: string): AccountActionState {
  if (!(error instanceof UserFacingError)) console.error("[minha-conta] falha", error instanceof Error ? error.name : "erro");
  return { ok: false, message: actionErrorMessage(error, fallback) };
}

export async function saveNameAction(_previous: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await updateMyName(String(formData.get("name") ?? ""));
    revalidatePath("/", "layout");
    return { ok: true, message: "Nome atualizado." };
  } catch (error) {
    return failure(error, "Não foi possível salvar o nome agora.");
  }
}

export async function changePasswordAction(_previous: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    await changeMyPassword(
      { current: String(formData.get("current") ?? ""), next: String(formData.get("next") ?? ""), confirm: String(formData.get("confirm") ?? "") },
      token,
    );
    return { ok: true, message: "Senha trocada. Os outros aparelhos foram desconectados." };
  } catch (error) {
    return failure(error, "Não foi possível trocar a senha agora.");
  }
}
