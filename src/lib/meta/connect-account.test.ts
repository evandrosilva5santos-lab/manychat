import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, oauth } = vi.hoisted(() => ({
  db: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  oauth: {
    exchangeCodeForShortLivedToken: vi.fn(),
    exchangeForLongLivedToken: vi.fn(),
    fetchInstagramProfile: vi.fn(),
    subscribeAccountWebhooks: vi.fn(),
    exchangeFacebookCodeForToken: vi.fn(),
    exchangeForLongLivedFacebookUserToken: vi.fn(),
    fetchFacebookPagesAndInstagram: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { instagramAccount: db, $transaction: (ops: Promise<unknown>[]) => Promise.all(ops) } }));
vi.mock("@/lib/security/token", () => ({ encryptToken: (t: string) => `enc(${t})` }));
vi.mock("./oauth", () => oauth);

import { ConnectUserError, connectViaFacebook, connectViaInstagram } from "./connect-account";

const NOW = new Date("2026-10-12T12:00:00Z");
const REDIRECT = "https://app.test/api/auth/instagram/callback";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.findUnique.mockResolvedValue(null);
  db.create.mockImplementation(async ({ data }) => data);
  db.update.mockImplementation(async ({ data }) => data);
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("connectViaInstagram", () => {
  beforeEach(() => {
    oauth.exchangeCodeForShortLivedToken.mockResolvedValue({ accessToken: "short", igUserId: "178" });
    oauth.exchangeForLongLivedToken.mockResolvedValue({ accessToken: "long", expiresIn: 5_184_000 });
    oauth.fetchInstagramProfile.mockResolvedValue({ igUserId: "178", username: "loja", name: "Loja" });
    oauth.subscribeAccountWebhooks.mockResolvedValue(true);
  });

  it("troca o código, assina webhooks e salva a conta como INSTAGRAM_LOGIN com validade de 60 dias", async () => {
    const usernames = await connectViaInstagram("code", REDIRECT, "ws_1");

    expect(usernames).toEqual(["loja"]);
    expect(oauth.exchangeCodeForShortLivedToken).toHaveBeenCalledWith("code", REDIRECT);
    expect(oauth.subscribeAccountWebhooks).toHaveBeenCalledWith("long");
    expect(db.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws_1", igUserId: "178", username: "loja", accessTokenEnc: "enc(long)",
        authProvider: "INSTAGRAM_LOGIN", fbPageId: null, status: "CONNECTED", tokenStatus: "ACTIVE",
        tokenExpiresAt: new Date(NOW.getTime() + 5_184_000 * 1000),
      }),
    });
    expect(oauth.exchangeFacebookCodeForToken).not.toHaveBeenCalled();
  });

  it("atualiza a conta existente do mesmo workspace", async () => {
    db.findUnique.mockResolvedValue({ id: "acc_1", workspaceId: "ws_1" });
    await connectViaInstagram("code", REDIRECT, "ws_1");
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "acc_1" } }));
    expect(db.create).not.toHaveBeenCalled();
  });

  it("recusa conta já vinculada a outro cliente sem gravar nada", async () => {
    db.findUnique.mockResolvedValue({ id: "acc_1", workspaceId: "ws_outro" });
    await expect(connectViaInstagram("code", REDIRECT, "ws_1")).rejects.toThrow(ConnectUserError);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });

  it("não falha a conexão se a inscrição de webhooks falhar (só registra)", async () => {
    oauth.subscribeAccountWebhooks.mockResolvedValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(connectViaInstagram("code", REDIRECT, "ws_1")).resolves.toEqual(["loja"]);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("long");
  });

  it("propaga o erro da Meta sem tentar o Facebook", async () => {
    oauth.exchangeCodeForShortLivedToken.mockRejectedValue(new Error("Meta OAuth Error: Invalid platform app"));
    await expect(connectViaInstagram("code", REDIRECT, "ws_1")).rejects.toThrow("Invalid platform app");
    expect(oauth.exchangeFacebookCodeForToken).not.toHaveBeenCalled();
  });
});

describe("connectViaFacebook", () => {
  const page = (n: number) => ({ pageId: `p${n}`, pageName: `Página ${n}`, pageAccessToken: `pt${n}`, igUserId: `ig${n}`, username: `conta${n}` });
  beforeEach(() => {
    oauth.exchangeFacebookCodeForToken.mockResolvedValue({ accessToken: "user_short" });
    oauth.exchangeForLongLivedFacebookUserToken.mockResolvedValue({ accessToken: "user_long" });
    oauth.fetchFacebookPagesAndInstagram.mockResolvedValue([page(1), page(2)]);
  });

  it("conecta todas as contas das Páginas autorizadas como FACEBOOK_LOGIN, sem validade", async () => {
    const usernames = await connectViaFacebook("code", REDIRECT, "ws_1");

    expect(usernames).toEqual(["conta1", "conta2"]);
    expect(oauth.exchangeFacebookCodeForToken).toHaveBeenCalledWith("code", REDIRECT);
    expect(oauth.fetchFacebookPagesAndInstagram).toHaveBeenCalledWith("user_long");
    expect(db.create).toHaveBeenCalledTimes(2);
    expect(db.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws_1", igUserId: "ig1", accessTokenEnc: "enc(pt1)", authProvider: "FACEBOOK_LOGIN",
        fbPageId: "p1", tokenExpiresAt: null, status: "CONNECTED", tokenStatus: "ACTIVE", name: "Página 1",
      }),
    });
    expect(oauth.exchangeCodeForShortLivedToken).not.toHaveBeenCalled();
  });

  it("explica o que fazer quando nenhuma Página com Instagram foi autorizada", async () => {
    oauth.fetchFacebookPagesAndInstagram.mockResolvedValue([]);
    await expect(connectViaFacebook("code", REDIRECT, "ws_1")).rejects.toThrow("Nenhuma conta profissional do Instagram");
    expect(db.create).not.toHaveBeenCalled();
  });

  it("não grava nenhuma conta se uma delas pertence a outro cliente", async () => {
    db.findUnique.mockImplementation(async ({ where }) => (where.igUserId === "ig2" ? { id: "x", workspaceId: "ws_outro" } : null));
    await expect(connectViaFacebook("code", REDIRECT, "ws_1")).rejects.toThrow("já está vinculada a outro cliente");
    expect(db.create).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
