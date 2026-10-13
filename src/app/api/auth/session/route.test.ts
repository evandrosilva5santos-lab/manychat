import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, db } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  db: {
    user: { upsert: vi.fn() },
    userSession: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore, headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/tenancy";

function loginRequest(user: string, password: string) {
  return new NextRequest("http://localhost/api/auth/session", {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${user}:${password}`)}` },
  });
}

describe("/api/auth/session", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_USER", "fluxo");
    vi.stubEnv("SITE_PASSWORD", "segredo-de-teste");
    vi.stubEnv("SUPERADMIN_EMAIL", "");
    db.user.upsert.mockResolvedValue({ id: "u1", name: "Administrador", email: "fluxo@fluxo.local", role: "SUPERADMIN" });
    db.userSession.create.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("recusa credenciais erradas sem criar sessão", async () => {
    const res = await POST(loginRequest("fluxo", "errada"));
    expect(res.status).toBe(401);
    expect(db.userSession.create).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("cria sessão opaca e cookie HTTP-only com credenciais certas", async () => {
    const res = await POST(loginRequest("fluxo", "segredo-de-teste"));
    expect(res.status).toBe(200);
    expect(db.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "fluxo@fluxo.local" } }));
    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    // Só o hash vai para o banco.
    expect(db.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "u1", tokenHash: hashSessionToken(token) }),
    });
  });

  it("recusa login com o site sem senha em produção", async () => {
    vi.stubEnv("SITE_PASSWORD", "");
    const res = await POST(loginRequest("fluxo", "qualquer"));
    expect(res.status).toBe(401);
  });

  it("DELETE apaga a sessão pelo hash e o cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "tok" });
    await DELETE();
    expect(db.userSession.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken("tok") } });
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});
