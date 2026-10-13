import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearActiveAccount, db, getCurrentAccount, requireAuth } = vi.hoisted(() => ({
  clearActiveAccount: vi.fn(),
  getCurrentAccount: vi.fn(),
  requireAuth: vi.fn(),
  db: { instagramAccount: { update: vi.fn() } },
}));

vi.mock("@/lib/auth/requireAuth", () => ({ requireAuth }));
vi.mock("@/lib/account", () => ({ getCurrentAccount, listAllAccounts: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy", () => ({ clearActiveAccount }));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn() }));
vi.mock("@/lib/meta/connect-invite", () => ({ createConnectInvite: vi.fn() }));
vi.mock("@/lib/meta/oauth", () => ({
  getAppBaseUrl: vi.fn(),
  getFacebookAppCredentials: vi.fn(),
  getInstagramAppCredentials: vi.fn(),
  getInstagramRedirectUri: vi.fn(),
  getOAuthSigningSecret: vi.fn(),
}));

import { disconnectCurrentInstagramProfile } from "./actions";

describe("disconnectCurrentInstagramProfile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("revoga o token local, pausa o perfil e limpa sua seleção ativa", async () => {
    getCurrentAccount.mockResolvedValue({ id: "account_1" });
    db.instagramAccount.update.mockResolvedValue({ id: "account_1" });

    await expect(disconnectCurrentInstagramProfile()).resolves.toEqual({ ok: true });

    expect(requireAuth).toHaveBeenCalledOnce();
    expect(db.instagramAccount.update).toHaveBeenCalledWith({
      where: { id: "account_1" },
      data: { status: "DISCONNECTED", tokenStatus: "REVOKED", accessTokenEnc: null, tokenExpiresAt: null },
    });
    expect(clearActiveAccount).toHaveBeenCalledOnce();
  });

  it("não altera nenhum perfil quando não existe conta ativa", async () => {
    getCurrentAccount.mockResolvedValue(null);

    await expect(disconnectCurrentInstagramProfile()).resolves.toEqual({ ok: false, error: "Nenhum perfil do Instagram está carregado." });

    expect(db.instagramAccount.update).not.toHaveBeenCalled();
  });
});
