// POST /api/auth/session — troca credenciais Basic Auth por cookie de sessão.
// DELETE — encerra a sessão atual.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { evaluateBasicAuth, isAccessAllowed, readBasicAuthConfig, getAuthorizedBasicUser } from "@/lib/auth/basic";
import { prisma } from "@/lib/prisma";
import { createUserSession, hashSessionToken, SESSION_COOKIE, upsertBootstrapSuperAdmin } from "@/lib/tenancy";

const SESSION_TTL_DAYS = 30;

export async function POST(request: NextRequest) {
  const config = readBasicAuthConfig();
  const auth = request.headers.get("authorization");

  if (!isAccessAllowed(evaluateBasicAuth(auth, config))) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const actor = await upsertBootstrapSuperAdmin(getAuthorizedBasicUser(auth, config) ?? "admin");
  const token = await createUserSession(actor.id, SESSION_TTL_DAYS);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
