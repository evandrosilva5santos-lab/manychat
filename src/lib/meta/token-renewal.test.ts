import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { instagramAccount: db } }));

const oauth = vi.hoisted(() => ({ refreshInstagramLongLivedToken: vi.fn() }));
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
  db.update.mockResolvedValue({});
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
    expect(db.update).not.toHaveBeenCalled();
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
    const data = db.update.mock.calls[0][0].data;
    expect(data.accessTokenEnc).toBe("enc(novo)");
    expect(data.tokenStatus).toBe("ACTIVE");
    expect(data.tokenExpiresAt.getTime()).toBeGreaterThan(inDays(50).getTime());
  });

  it("não renova token de refresh com menos de 24h de vida (regra da Meta)", async () => {
    db.findMany.mockResolvedValue([account({ tokenExpiresAt: inDays(5), updatedAt: new Date(NOW.getTime() - 1000) })]);
    const s = await renewExpiringTokens(NOW);
    expect(oauth.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
    expect(s.tooYoung).toBe(1);
  });

  it("falha de renovação (190/expirado) marca a conta EXPIRED e alerta", async () => {
    db.findMany.mockResolvedValue([account({ accessTokenEnc: "enc(velho)", tokenExpiresAt: inDays(2) })]);
    oauth.refreshInstagramLongLivedToken.mockRejectedValue(new Error("code 190"));
    const s = await renewExpiringTokens(NOW);
    expect(s.failed).toBe(1);
    expect(s.renewed).toBe(0);
    const data = db.update.mock.calls[0][0].data;
    expect(data.status).toBe("EXPIRED");
    expect(data.tokenStatus).toBe("EXPIRED");
  });

  it("token ilegível (chave trocada) marca EXPIRED sem derrubar as demais contas", async () => {
    db.findMany.mockResolvedValue([
      account({ id: "a1", igUserId: "1", accessTokenEnc: "ilegivel", tokenExpiresAt: inDays(1) }),
      account({ id: "a2", igUserId: "2", accessTokenEnc: "enc(ok)", tokenExpiresAt: inDays(3) }),
    ]);
    oauth.refreshInstagramLongLivedToken.mockResolvedValue({ accessToken: "n", expiresIn: (60 * DAY) / 1000 });
    const s = await renewExpiringTokens(NOW);
    expect(s.checked).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.renewed).toBe(1);
  });
});
