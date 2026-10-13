"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ACCOUNT_COOKIE, IMPERSONATION_COOKIE, SESSION_COOKIE, hashSessionToken } from "@/lib/tenancy";

/**
 * Encerra a sessão: apaga a UserSession pelo hash do token, limpa os 3 cookies
 * e leva para /sair (que explica o caso do operador autenticado por Basic Auth).
 */
export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  try {
    if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  } finally {
    // Cookies saem mesmo se o banco falhar: o navegador deixa de apresentar o token.
    store.delete(SESSION_COOKIE);
    store.delete(ACTIVE_ACCOUNT_COOKIE);
    store.delete(IMPERSONATION_COOKIE);
  }
  revalidatePath("/", "layout");
  redirect("/sair");
}
