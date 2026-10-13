// POST /api/auth/session — entra com e-mail e senha (cliente) ou com o usuário do operador.
// DELETE — encerra a sessão atual.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { evaluateBasicAuth, isAccessAllowed, readBasicAuthConfig } from "@/lib/auth/basic";
import { verifyPassword } from "@/lib/auth/password";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth/session";
import { hashSessionToken, SESSION_COOKIE, upsertBootstrapSuperAdmin } from "@/lib/tenancy";

const INVALID = "E-mail ou senha incorretos.";

const credentialsSchema = z.object({
  login: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

/** Cliente com senha cadastrada. A senha é sempre verificada, mesmo sem usuário, para não revelar quais e-mails existem. */
async function authenticateClient(login: string, password: string) {
  const user = login.includes("@")
    ? await prisma.user.findUnique({ where: { email: login.toLowerCase() } })
    : null;
  const ok = await verifyPassword(password, user?.passwordHash);
  return ok && user ? user : null;
}

/** Operador da plataforma (SITE_USER/SITE_PASSWORD). */
async function authenticateOperator(login: string, password: string) {
  const header = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  if (!isAccessAllowed(evaluateBasicAuth(header, readBasicAuthConfig()))) return null;
  return upsertBootstrapSuperAdmin(login);
}

export async function POST(request: NextRequest) {
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: INVALID }, { status: 400 });
  const { login, password } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limitKey = `${ip}|${login.toLowerCase()}`;
  if (isRateLimited(limitKey)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." }, { status: 429 });
  }

  const user = (await authenticateClient(login, password)) ?? (await authenticateOperator(login, password));
  if (!user) {
    recordFailure(limitKey);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  clearFailures(limitKey);
  await startSession(user.id);
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
