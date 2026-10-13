import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { instagramAccount: db } }));

const oauth = vi.hoisted(() => {
  class MetaTokenError extends Error {
    httpStatus: number;
    code?: number;
    constructor(message: string, httpStatus: number, code?: number) {
      super(message);
      this.httpStatus = httpStatus;
      this.code = code;
    }
    get isPermanent() {
      return this.code === 190 || this.httpStatus === 400 || this.httpStatus === 401;
    }
  }
  return { refreshInstagramLongLivedToken: vi.fn(), MetaTokenError };
});
vi.mock("./oauth", () => oauth);

// Criptografia real-ish: ida e volta previsível para o teste.
vi.mock("@/lib/security/token", () => ({
  encryptToken: (plain: string) => `enc(${plain})`,
  decryptToken: (enc: string) => {
    const m = /^enc\((.*)\)$/.exec(enc);
    if (!m) throw new Error("token ilegível");
    return m[1];
  },
}));

import { renewExpiringTokens } from "./token-renewal";

const NOW = new Date("2026-10-11T12:00:00Z");
const DAY = 86_400_000;
const inDays = (d: number) => new Date(NOW.getTime() + d * DAY);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);

beforeEach(() => {
  vi.clearAllMocks();
  db.updateMany.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

function account(overrides: Record<string, unknown> = {}) {
  return { id: "a1", igUserId: "1", accessTokenEnc: "enc(tok)", tokenExpiresAt: inDays(5), updatedAt: daysAgo(2), ...overrides };
}

describe("renewExpiringTokens", () => {
  it("pula tokens sem validade (token de Página do Facebook nunca expira)", async () => {
    db.findMany.mockResolvedValue([account({ tokenExpiresAt: null })]);
    const s = await renewExpiringTokens(NOW);
    expect(s.skippedNonExpiring).toBe(1);
    expect(oauth.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("nunca renova conta conectada pelo Facebook, mesmo com validade preenchida", async () => {
    db.findMany.mockResolvedValue([account({ authProvider: "FACEBOOK_LOGIN", tokenExpiresAt: inDays(1) })]);
    const s = await renewExpiringTokens(NOW);
    expect(s.skippedNonExpiring).toBe(1);
    expect(oauth.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("não renova token ainda longe de vencer (> janela)", async () => {
    db.findMany.mockResolvedValue([account({ tokenExpiresAt: inDays(40) })]);
    const s = await renewExpiringTokens(NOW);
    expect(s.stillValid).toBe(1);
    expect(oauth.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
  });

  it("renova e persiste criptografado o token perto de vencer (<= 10 dias)", async () => {
    db.findMany.mockResolvedValue([account({ accessTokenEnc: "enc(velho)", tokenExpiresAt: inDays(5) })]);
    oauth.refreshInstagramLongLivedToken.mockResolvedValue({ accessToken: "novo", expiresIn: (60 * DAY) / 1000 });
    const s = await renewExpiringTokens(NOW);
    expect(oauth.refreshInstagramLongLivedToken).toHaveBeenCalledWith("velho");
    expect(s.renewed).toBe(1);
    const data = db.updateMany.mock.calls[0][0].data;
    expect(data.accessTokenEnc).toBe("enc(novo)");
    expect(data.tokenStatus).toBe("ACTIVE");
    expect(data.tokenExpiresAt.getTime()).toBeGreaterThan(inDays(50).getTime());
    expect(db.updateMany.mock.calls[0][0].where).toEqual({ id: "a1", status: "CONNECTED" });
  });

  it("não renova token de refresh com menos de 24h de vida (regra da Meta)", async () => {
    db.findMany.mockResolvedValue([account({ tokenExpiresAt: inDays(5), updatedAt: new Date(NOW.getTime() - 1000) })]);
    const s = await renewExpiringTokens(NOW);
    expect(oauth.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
    expect(s.tooYoung).toBe(1);
  });

  it("falha permanente (code 190) marca a conta EXPIRED e alerta", async () => {
    db.findMany.mockResolvedValue([account({ accessTokenEnc: "enc(velho)", tokenExpiresAt: inDays(2) })]);
    oauth.refreshInstagramLongLivedToken.mockRejectedValue(new oauth.MetaTokenError("code 190", 400, 190));
    const s = await renewExpiringTokens(NOW);
    expect(s.failed).toBe(1);
    expect(s.renewed).toBe(0);
    const data = db.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("EXPIRED");
    expect(data.tokenStatus).toBe("EXPIRED");
    // Só expira conta ainda CONNECTED (não sobrescreve DISCONNECTED).
    expect(db.updateMany.mock.calls[0][0].where).toEqual({ id: "a1", status: "CONNECTED" });
  });

  it("erro passageiro (rede/timeout/5xx) NÃO expira a conta — tenta no próximo ciclo", async () => {
    db.findMany.mockResolvedValue([account({ accessTokenEnc: "enc(velho)", tokenExpiresAt: inDays(2) })]);
    oauth.refreshInstagramLongLivedToken.mockRejectedValue(new oauth.MetaTokenError("timeout", 0));
    const s = await renewExpiringTokens(NOW);
    expect(s.transient).toBe(1);
    expect(s.failed).toBe(0);
    expect(db.updateMany).not.toHaveBeenCalled(); // conta segue CONNECTED
  });

  it("token ilegível (chave trocada) é pulado SEM expirar, e não derruba as demais", async () => {
    db.findMany.mockResolvedValue([
      account({ id: "a1", igUserId: "1", accessTokenEnc: "ilegivel", tokenExpiresAt: inDays(1) }),
      account({ id: "a2", igUserId: "2", accessTokenEnc: "enc(ok)", tokenExpiresAt: inDays(3) }),
    ]);
    oauth.refreshInstagramLongLivedToken.mockResolvedValue({ accessToken: "n", expiresIn: (60 * DAY) / 1000 });
    const s = await renewExpiringTokens(NOW);
    expect(s.checked).toBe(2);
    expect(s.decryptSkipped).toBe(1);
    expect(s.renewed).toBe(1);
    expect(s.failed).toBe(0);
    // Nenhuma conta foi marcada EXPIRED por causa do token ilegível.
    const expiredCalls = db.updateMany.mock.calls.filter((c) => c[0].data.status === "EXPIRED");
    expect(expiredCalls).toHaveLength(0);
  });
});
