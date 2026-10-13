"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/session";
import { isRateLimited, recordFailure } from "@/lib/auth/rate-limit";
import { signUp } from "@/lib/billing/signup";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type SignupState = { message: string } | null;

export async function signUpAction(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limitKey = `signup|${ip}`;
  // Todo cadastro conta (não só os que falham): freia criação de contas em massa.
  if (isRateLimited(limitKey)) return { message: "Muitos cadastros deste endereço. Tente de novo em 15 minutos." };
  recordFailure(limitKey);

  let result: Awaited<ReturnType<typeof signUp>>;
  try {
    result = await signUp({
      name: formData.get("name"),
      company: formData.get("company"),
      email: formData.get("email"),
      password: formData.get("password"),
      plan: formData.get("plan") || undefined,
    });
    await startSession(result.userId);
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("[cadastro] falhou", error instanceof Error ? error.name : "erro desconhecido");
    return { message: actionErrorMessage(error, "Não foi possível criar a conta agora. Tente de novo em instantes.") };
  }
  // Com teste grátis, o próximo passo é conectar o Instagram; sem ele, assinar.
  redirect(result.trial ? "/contas" : "/plano");
}
