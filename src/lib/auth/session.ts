import { cookies } from "next/headers";
import { createUserSession, SESSION_COOKIE } from "@/lib/tenancy";

export const SESSION_TTL_DAYS = 30;

/** Cria a sessão opaca no banco e grava o cookie HTTP-only. */
export async function startSession(userId: string): Promise<void> {
  const token = await createUserSession(userId, SESSION_TTL_DAYS);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS,
  });
}
