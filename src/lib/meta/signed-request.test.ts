import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import { verifySignedRequest } from "./signed-request";

const NOW = new Date("2026-10-12T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function sign(payload: object | string, secret: string, tamper = false): string {
  const body = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${sig}.${tamper ? body + "A" : body}`;
}
const base = { algorithm: "HMAC-SHA256", user_id: "123", issued_at: nowSec };

beforeEach(() => {
  process.env.IG_APP_SECRET = "ig-secret";
  process.env.META_APP_SECRET = "fb-secret";
});
afterEach(() => {
  delete process.env.IG_APP_SECRET;
  delete process.env.META_APP_SECRET;
});

describe("verifySignedRequest", () => {
  it("aceita assinatura do app do Instagram", () => {
    const r = verifySignedRequest(sign(base, "ig-secret"), NOW);
    expect(r).toEqual({ provider: "INSTAGRAM_LOGIN", userId: "123", issuedAt: new Date(nowSec * 1000) });
  });
  it("aceita assinatura do app do Facebook e user_id numérico", () => {
    const r = verifySignedRequest(sign({ ...base, user_id: 456 }, "fb-secret"), NOW);
    expect(r?.provider).toBe("FACEBOOK_LOGIN");
    expect(r?.userId).toBe("456");
  });
  it("rejeita payload adulterado", () => {
    expect(verifySignedRequest(sign(base, "ig-secret", true), NOW)).toBeNull();
  });
  it("rejeita algoritmo diferente", () => {
    expect(verifySignedRequest(sign({ ...base, algorithm: "HMAC-SHA1" }, "ig-secret"), NOW)).toBeNull();
  });
  it("rejeita segredo errado", () => {
    expect(verifySignedRequest(sign(base, "outro"), NOW)).toBeNull();
  });
  it("rejeita sem nenhum segredo configurado", () => {
    delete process.env.IG_APP_SECRET;
    delete process.env.META_APP_SECRET;
    expect(verifySignedRequest(sign(base, "ig-secret"), NOW)).toBeNull();
  });
  it("rejeita issued_at com mais de 24h", () => {
    expect(verifySignedRequest(sign({ ...base, issued_at: nowSec - 24 * 3600 - 1 }, "ig-secret"), NOW)).toBeNull();
  });
  it("rejeita issued_at no futuro (mais de 5 min)", () => {
    expect(verifySignedRequest(sign({ ...base, issued_at: nowSec + 301 }, "ig-secret"), NOW)).toBeNull();
  });
  it("rejeita dois pontos", () => {
    expect(verifySignedRequest(`${sign(base, "ig-secret")}.x`, NOW)).toBeNull();
  });
  it("rejeita sem user_id, JSON inválido e entrada vazia", () => {
    expect(verifySignedRequest(sign({ algorithm: "HMAC-SHA256", issued_at: nowSec }, "ig-secret"), NOW)).toBeNull();
    expect(verifySignedRequest(sign("não é json", "ig-secret"), NOW)).toBeNull();
    expect(verifySignedRequest("", NOW)).toBeNull();
    expect(verifySignedRequest("abc.def", NOW)).toBeNull();
  });
});
