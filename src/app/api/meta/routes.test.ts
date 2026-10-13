import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const { db, life } = vi.hoisted(() => ({
  db: { dataDeletionRequest: { findUnique: vi.fn(), create: vi.fn() } },
  life: { disconnectAccount: vi.fn(), runDeletion: vi.fn(), findAccountsForCallback: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => { void fn(); } }));
vi.mock("@/lib/meta/account-lifecycle", () => life);

import { POST as deauthorize } from "./deauthorize/route";
import { POST as dataDeletion } from "./data-deletion/route";

function signed(over: Record<string, unknown> = {}, secret = "ig-secret") {
  const body = Buffer.from(JSON.stringify({
    algorithm: "HMAC-SHA256", user_id: "123", issued_at: Math.floor(Date.now() / 1000), ...over,
  })).toString("base64url");
  return `${crypto.createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
}
const req = (sr: string | null, headers: Record<string, string> = {}) =>
  new Request("https://app.test/api/meta/x", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: sr === null ? "" : new URLSearchParams({ signed_request: sr }).toString(),
  });

beforeEach(() => {
  process.env.IG_APP_SECRET = "ig-secret";
  process.env.META_APP_SECRET = "fb-secret";
  process.env.APP_URL = "https://app.test";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  life.findAccountsForCallback.mockResolvedValue(["a1", "a2"]);
  db.dataDeletionRequest.findUnique.mockResolvedValue(null);
  db.dataDeletionRequest.create.mockImplementation(async ({ data }) => ({ id: "r1", ...data }));
  life.runDeletion.mockResolvedValue("COMPLETED");
});
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); delete process.env.APP_URL; });

describe.each([["deauthorize", deauthorize], ["data-deletion", dataDeletion]] as const)("%s: validação", (_n, POST) => {
  it("400 com assinatura inválida, sem tocar no banco", async () => {
    const res = await POST(req(signed({}, "errado")));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
    expect(life.findAccountsForCallback).not.toHaveBeenCalled();
    expect(db.dataDeletionRequest.findUnique).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("errado");
  });
  it("400 sem signed_request", async () => {
    expect((await POST(req(null))).status).toBe(400);
  });
  it("400 com content-length acima do limite", async () => {
    const res = await POST(req(signed(), { "content-length": "9000" }));
    expect(res.status).toBe(400);
    expect(life.findAccountsForCallback).not.toHaveBeenCalled();
  });
  it("400 e nada feito com mais de 20 contas", async () => {
    life.findAccountsForCallback.mockResolvedValue(null);
    expect((await POST(req(signed()))).status).toBe(400);
    expect(life.disconnectAccount).not.toHaveBeenCalled();
    expect(db.dataDeletionRequest.create).not.toHaveBeenCalled();
  });
});

describe("deauthorize", () => {
  it("desconecta as contas do usuário usando o provedor da assinatura", async () => {
    const res = await deauthorize(req(signed()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(life.findAccountsForCallback).toHaveBeenCalledWith(expect.objectContaining({ provider: "INSTAGRAM_LOGIN", userId: "123" }));
    expect(life.disconnectAccount).toHaveBeenCalledTimes(2);
    expect(life.disconnectAccount).toHaveBeenCalledWith("a1", { reason: "META_DEAUTHORIZE", notifyMeta: false });
  });
});

describe("data-deletion", () => {
  it("cria o pedido BUSINESS para Instagram, devolve url e código e roda a exclusão", async () => {
    const res = await dataDeletion(req(signed()));
    const body = await res.json();
    expect(body.confirmation_code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(body.url).toBe(`https://app.test/exclusao-de-dados?codigo=${body.confirmation_code}`);
    const data = db.dataDeletionRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ source: "META_CALLBACK", provider: "INSTAGRAM_LOGIN", scope: "BUSINESS", accountIds: ["a1", "a2"] });
    expect(data.metaUserIdHash).toBe(crypto.createHash("sha256").update("123").digest("hex"));
    expect(life.runDeletion).toHaveBeenCalledWith("r1");
  });
  it("usa escopo PERSON no Facebook", async () => {
    await dataDeletion(req(signed({}, "fb-secret")));
    expect(db.dataDeletionRequest.create.mock.calls[0][0].data.scope).toBe("PERSON");
  });
  it("repetição do mesmo signed_request devolve o mesmo código sem criar outro pedido", async () => {
    db.dataDeletionRequest.findUnique.mockResolvedValue({ code: "CODIGO_EXISTENTE" });
    const body = await (await dataDeletion(req(signed()))).json();
    expect(body.confirmation_code).toBe("CODIGO_EXISTENTE");
    expect(db.dataDeletionRequest.create).not.toHaveBeenCalled();
    expect(life.runDeletion).not.toHaveBeenCalled();
  });
  it("zero contas: cria o pedido já concluído", async () => {
    life.findAccountsForCallback.mockResolvedValue([]);
    const res = await dataDeletion(req(signed()));
    expect(res.status).toBe(200);
    expect(db.dataDeletionRequest.create.mock.calls[0][0].data).toMatchObject({ status: "COMPLETED", accountsAffected: 0 });
    expect(life.runDeletion).not.toHaveBeenCalled();
  });
});
