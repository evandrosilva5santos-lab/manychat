import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  clearActiveAccount: vi.fn(),
  setActiveAccount: vi.fn(),
  findNextConnectedAccount: vi.fn(),
  getTenantContext: vi.fn(),
  requireSuperAdmin: vi.fn(),
  getCurrentAccount: vi.fn(),
  requireAuth: vi.fn(),
  disconnectAccount: vi.fn(),
  requestAccountDeletion: vi.fn(),
  refreshInstagramLongLivedToken: vi.fn(),
  encryptToken: vi.fn(),
  decryptToken: vi.fn(),
  revalidatePath: vi.fn(),
  db: { instagramAccount: { updateMany: vi.fn() } },
}));

vi.mock("@/lib/auth/requireAuth", () => ({ requireAuth: m.requireAuth }));
vi.mock("@/lib/account", () => ({ getCurrentAccount: m.getCurrentAccount, listAllAccounts: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/tenancy", () => ({
  clearActiveAccount: m.clearActiveAccount,
  setActiveAccount: m.setActiveAccount,
  findNextConnectedAccount: m.findNextConnectedAccount,
  getTenantContext: m.getTenantContext,
  requireSuperAdmin: m.requireSuperAdmin,
  getOrCreateWorkspaceForActor: vi.fn(),
}));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn() }));
vi.mock("@/lib/meta/connect-invite", () => ({ createConnectInvite: vi.fn() }));
vi.mock("@/lib/meta/account-lifecycle", () => ({
  disconnectAccount: m.disconnectAccount,
  requestAccountDeletion: m.requestAccountDeletion,
}));
vi.mock("@/lib/security/token", () => ({ encryptToken: m.encryptToken, decryptToken: m.decryptToken }));
vi.mock("@/lib/meta/oauth", () => {
  class MetaTokenError extends Error {
    constructor(message: string, readonly httpStatus: number, readonly code?: number) {
      super(message);
    }
    get isPermanent() {
      return this.code === 190 || this.httpStatus === 400 || this.httpStatus === 401;
    }
  }
  return {
    MetaTokenError,
    refreshInstagramLongLivedToken: m.refreshInstagramLongLivedToken,
    getAppBaseUrl: vi.fn(),
    getFacebookAppCredentials: vi.fn(),
    getInstagramAppCredentials: vi.fn(),
    getInstagramRedirectUri: vi.fn(),
    getOAuthSigningSecret: vi.fn(),
  };
});

import { MetaTokenError } from "@/lib/meta/oauth";
import {
  deleteCurrentInstagramProfile,
  disconnectCurrentInstagramProfile,
  renewMetaToken,
  revealWebhookVerifyToken,
} from "./actions";

const account = { id: "acc_1", workspaceId: "ws_1", username: "Loja.Sunset", authProvider: "INSTAGRAM_LOGIN", accessTokenEnc: "enc" };

beforeEach(() => {
  vi.resetAllMocks();
  m.getCurrentAccount.mockResolvedValue(account);
  m.getTenantContext.mockResolvedValue({ actor: { id: "u1", role: "CLIENT" }, account, impersonatedWorkspaceId: null });
  m.findNextConnectedAccount.mockResolvedValue(null);
});

describe("disconnectCurrentInstagramProfile", () => {
  it("descarrega o perfil ativo avisando a Meta e limpa a seleção quando não há outro conectado", async () => {
    await expect(disconnectCurrentInstagramProfile("acc_1")).resolves.toEqual({ ok: true, nextAccountId: null });

    expect(m.requireAuth).toHaveBeenCalledOnce();
    expect(m.disconnectAccount).toHaveBeenCalledWith("acc_1", { reason: "USER", notifyMeta: true });
    expect(m.findNextConnectedAccount).toHaveBeenCalledWith("ws_1", "acc_1");
    expect(m.clearActiveAccount).toHaveBeenCalledOnce();
    expect(m.setActiveAccount).not.toHaveBeenCalled();
    expect(m.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(m.revalidatePath).toHaveBeenCalledWith("/ajustes");
  });

  it("troca para outro perfil CONECTADO do mesmo workspace", async () => {
    m.findNextConnectedAccount.mockResolvedValue({ id: "acc_2" });

    await expect(disconnectCurrentInstagramProfile("acc_1")).resolves.toEqual({ ok: true, nextAccountId: "acc_2" });

    expect(m.setActiveAccount).toHaveBeenCalledWith("acc_2");
    expect(m.clearActiveAccount).not.toHaveBeenCalled();
  });

  it("perfil ativo mudou: recusa e não faz nada", async () => {
    await expect(disconnectCurrentInstagramProfile("acc_antigo")).resolves.toEqual({
      ok: false,
      error: "O perfil ativo mudou. Recarregue a página e tente de novo.",
    });
    expect(m.disconnectAccount).not.toHaveBeenCalled();
    expect(m.clearActiveAccount).not.toHaveBeenCalled();
    expect(m.setActiveAccount).not.toHaveBeenCalled();
  });

  it("id que não é texto também é recusado", async () => {
    const res = await disconnectCurrentInstagramProfile(undefined as unknown as string);
    expect(res.ok).toBe(false);
    expect(m.disconnectAccount).not.toHaveBeenCalled();
  });

  it("não chama o ciclo de vida sem perfil ativo", async () => {
    m.getCurrentAccount.mockResolvedValue(null);

    await expect(disconnectCurrentInstagramProfile("acc_1")).resolves.toEqual({ ok: false, error: "Nenhum perfil do Instagram está carregado." });
    expect(m.disconnectAccount).not.toHaveBeenCalled();
  });

  it("devolve erro amigável (sem vazar o interno) se o ciclo de vida falhar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.disconnectAccount.mockRejectedValue(new Error("connection refused 10.0.0.1"));

    const res = await disconnectCurrentInstagramProfile("acc_1");

    expect(res.ok).toBe(false);
    expect(res.error).toBe("Não foi possível descarregar o perfil agora. Tente novamente em instantes.");
    expect(m.clearActiveAccount).not.toHaveBeenCalled();
  });
});

describe("deleteCurrentInstagramProfile", () => {
  beforeEach(() => {
    m.requestAccountDeletion.mockResolvedValue({ code: "abc", status: "COMPLETED" });
  });

  it("rejeita nome diferente sem chamar a exclusão", async () => {
    await expect(deleteCurrentInstagramProfile("outro")).resolves.toEqual({
      ok: false,
      error: "O nome digitado não confere com o perfil.",
    });
    expect(m.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("rejeita confirmação que não é texto", async () => {
    const res = await deleteCurrentInstagramProfile(undefined as unknown as string);
    expect(res.ok).toBe(false);
    expect(m.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("aceita '@Loja.Sunset ' normalizado e informa o ator", async () => {
    const res = await deleteCurrentInstagramProfile("  @loja.SUNSET ");

    expect(res).toEqual({ ok: true, status: "COMPLETED", code: "abc" });
    expect(m.requestAccountDeletion).toHaveBeenCalledWith("acc_1", { actorId: "u1" });
    expect(m.requireSuperAdmin).not.toHaveBeenCalled();
    expect(m.clearActiveAccount).toHaveBeenCalledOnce();
    expect(m.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("exige SUPERADMIN ao 'ver como cliente' e bloqueia se não for", async () => {
    m.getTenantContext.mockResolvedValue({ actor: { id: "u1", role: "CLIENT" }, account, impersonatedWorkspaceId: "ws_1" });
    m.requireSuperAdmin.mockRejectedValue(new Error("Apenas o Super Admin pode executar esta ação."));

    const res = await deleteCurrentInstagramProfile("loja.sunset");

    expect(res.ok).toBe(false);
    expect(m.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("segue quando o SUPERADMIN está vendo como cliente", async () => {
    m.getTenantContext.mockResolvedValue({ actor: { id: "adm", role: "SUPERADMIN" }, account, impersonatedWorkspaceId: "ws_1" });
    m.requireSuperAdmin.mockResolvedValue({ id: "adm", role: "SUPERADMIN" });

    const res = await deleteCurrentInstagramProfile("loja.sunset");

    expect(res.ok).toBe(true);
    expect(m.requestAccountDeletion).toHaveBeenCalledWith("acc_1", { actorId: "adm" });
  });

  it("devolve PENDING e o código quando a exclusão continua em segundo plano", async () => {
    m.requestAccountDeletion.mockResolvedValue({ code: "xyz", status: "PENDING" });
    m.findNextConnectedAccount.mockResolvedValue({ id: "acc_2" });

    await expect(deleteCurrentInstagramProfile("loja.sunset")).resolves.toEqual({ ok: true, status: "PENDING", code: "xyz" });
    expect(m.setActiveAccount).toHaveBeenCalledWith("acc_2");
  });

  it("sinaliza falha quando o pedido termina FAILED", async () => {
    m.requestAccountDeletion.mockResolvedValue({ code: "xyz", status: "FAILED" });

    const res = await deleteCurrentInstagramProfile("loja.sunset");

    expect(res.ok).toBe(false);
    expect(res.status).toBe("FAILED");
    expect(res.error).toBeTruthy();
  });
});

describe("renewMetaToken", () => {
  it("login do Facebook não chama a Meta nem grava nada", async () => {
    m.getCurrentAccount.mockResolvedValue({ ...account, authProvider: "FACEBOOK_LOGIN" });

    await expect(renewMetaToken()).resolves.toEqual({
      ok: true,
      message: "Conta do Facebook usa token de Página, que não expira.",
    });
    expect(m.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
    expect(m.db.instagramAccount.updateMany).not.toHaveBeenCalled();
  });

  it("Instagram: renova e SALVA o token criptografado só em perfil CONNECTED", async () => {
    m.decryptToken.mockReturnValue("old-plain");
    m.refreshInstagramLongLivedToken.mockResolvedValue({ accessToken: "new-plain", expiresIn: 5_184_000 });
    m.encryptToken.mockReturnValue("new-enc");
    m.db.instagramAccount.updateMany.mockResolvedValue({ count: 1 });

    const res = await renewMetaToken();

    expect(res).toMatchObject({ ok: true, expiresInDays: 60 });
    expect(m.refreshInstagramLongLivedToken).toHaveBeenCalledWith("old-plain");
    const call = m.db.instagramAccount.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "acc_1", status: "CONNECTED" });
    expect(call.data).toMatchObject({ accessTokenEnc: "new-enc", tokenStatus: "ACTIVE" });
    expect(call.data.tokenExpiresAt).toBeInstanceOf(Date);
  });

  it("não salva se o perfil deixou de estar conectado (0 linhas)", async () => {
    m.decryptToken.mockReturnValue("old");
    m.refreshInstagramLongLivedToken.mockResolvedValue({ accessToken: "n", expiresIn: 100 });
    m.encryptToken.mockReturnValue("enc");
    m.db.instagramAccount.updateMany.mockResolvedValue({ count: 0 });

    const res = await renewMetaToken();
    expect(res.ok).toBe(false);
  });

  it("perfil sem token salvo orienta a carregar de novo", async () => {
    m.getCurrentAccount.mockResolvedValue({ ...account, accessTokenEnc: null });
    const res = await renewMetaToken();
    expect(res.ok).toBe(false);
    expect(m.refreshInstagramLongLivedToken).not.toHaveBeenCalled();
  });

  it("recusa permanente da Meta pede para carregar o perfil de novo", async () => {
    m.decryptToken.mockReturnValue("old");
    m.refreshInstagramLongLivedToken.mockRejectedValue(new MetaTokenError("revoked", 400, 190));
    const res = await renewMetaToken();
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Carregar perfil de novo");
    expect(m.db.instagramAccount.updateMany).not.toHaveBeenCalled();
  });

  it("falha passageira não expõe o erro interno", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.decryptToken.mockReturnValue("old");
    m.refreshInstagramLongLivedToken.mockRejectedValue(new MetaTokenError("timeout", 0));
    const res = await renewMetaToken();
    expect(res).toEqual({ ok: false, error: "Não foi possível falar com a Meta agora. Tente novamente em instantes." });
  });
});

describe("revealWebhookVerifyToken", () => {
  it("exige SUPERADMIN e não revela o token para quem não é", async () => {
    process.env.WEBHOOK_VERIFY_TOKEN = "segredo";
    m.requireSuperAdmin.mockRejectedValue(new Error("Apenas o Super Admin pode executar esta ação."));

    const res = await revealWebhookVerifyToken();

    expect(res.ok).toBe(false);
    expect(res.token).toBeUndefined();
  });

  it("devolve o token ao SUPERADMIN", async () => {
    process.env.WEBHOOK_VERIFY_TOKEN = "segredo";
    m.requireSuperAdmin.mockResolvedValue({ id: "adm", role: "SUPERADMIN" });

    await expect(revealWebhookVerifyToken()).resolves.toEqual({ ok: true, token: "segredo" });
  });
});
