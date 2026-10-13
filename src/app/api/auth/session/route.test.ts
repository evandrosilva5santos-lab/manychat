import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, db } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  db: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    userSession: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore, headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";
import { hashPassword } from "@/lib/auth/password";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/tenancy";

let ipCounter = 0;
function login(loginValue: string, password: string, ip = `10.0.0.${++ipCounter}`) {
  return POST(
    new NextRequest("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ login: loginValue, password }),
    }),
  );
}

describe("/api/auth/session", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_USER", "fluxo");
    vi.stubEnv("SITE_PASSWORD", "segredo-de-teste");
    vi.stubEnv("SUPERADMIN_EMAIL", "");
    db.user.findUnique.mockResolvedValue(null);
    db.user.upsert.mockResolvedValue({ id: "u1", name: "Administrador", email: "fluxo@fluxo.local", role: "SUPERADMIN" });
    db.userSession.create.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("cliente entra com e-mail e senha", async () => {
    db.user.findUnique.mockResolvedValue({ id: "c1", email: "ana@loja.com", passwordHash: await hashPassword("senha-da-ana") });
    const res = await login("Ana@Loja.com", "senha-da-ana");
    expect(res.status).toBe(200);
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: "ana@loja.com" } });
    expect(db.userSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "c1" }) });
    expect(db.user.upsert).not.toHaveBeenCalled();
  });

  it("senha errada do cliente não cria sessão", async () => {
    db.user.findUnique.mockResolvedValue({ id: "c1", email: "ana@loja.com", passwordHash: await hashPassword("senha-da-ana") });
    const res = await login("ana@loja.com", "outra-senha");
    expect(res.status).toBe(401);
    expect(db.userSession.create).not.toHaveBeenCalled();
  });

  it("cliente sem senha cadastrada não entra", async () => {
    db.user.findUnique.mockResolvedValue({ id: "c1", email: "ana@loja.com", passwordHash: null });
    expect((await login("ana@loja.com", "qualquer-coisa")).status).toBe(401);
  });

  it("operador entra com SITE_USER/SITE_PASSWORD e vira Super Admin", async () => {
    const res = await login("fluxo", "segredo-de-teste");
    expect(res.status).toBe(200);
    expect(db.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "fluxo@fluxo.local" } }));
    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    expect(db.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "u1", tokenHash: hashSessionToken(token) }),
    });
  });

  it("recusa o operador com o site sem senha em produção", async () => {
    vi.stubEnv("SITE_PASSWORD", "");
    expect((await login("fluxo", "qualquer")).status).toBe(401);
  });

  it("corpo inválido responde 400", async () => {
    const res = await POST(new NextRequest("http://localhost/api/auth/session", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("bloqueia depois de 10 erros seguidos do mesmo IP e login", async () => {
    for (let i = 0; i < 10; i++) expect((await login("fluxo", "errada", "9.9.9.9")).status).toBe(401);
    const blocked = await login("fluxo", "segredo-de-teste", "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect(db.userSession.create).not.toHaveBeenCalled();
  }, 30_000); // 11 verificações scrypt de propósito lentas; folga para máquina carregada.

  it("DELETE apaga a sessão pelo hash e o cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "tok" });
    await DELETE();
    expect(db.userSession.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken("tok") } });
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});
