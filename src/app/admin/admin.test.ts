import { afterEach, describe, expect, it, vi } from "vitest";

const { graphClientForAccount, impersonateWorkspace, requireSuperAdmin } = vi.hoisted(() => ({
  graphClientForAccount: vi.fn(),
  impersonateWorkspace: vi.fn(),
  requireSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount }));
vi.mock("@/lib/tenancy", () => ({ impersonateWorkspace, requireSuperAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getReconnectWhatsAppLink, testAccountConnection, viewWorkspaceAsClient } from "./actions";

describe("ações do painel super admin", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("protege cada ação com a verificação de super admin", async () => {
    graphClientForAccount.mockResolvedValue({ validateConnection: vi.fn().mockResolvedValue({ valid: true, username: "loja" }) });
    await testAccountConnection("account_1");
    await viewWorkspaceAsClient("workspace_1");
    expect(requireSuperAdmin).toHaveBeenCalledTimes(2);
  });

  it("testa uma conta pelo cliente Graph associado à conta", async () => {
    const validateConnection = vi.fn().mockResolvedValue({ valid: true, username: "loja" });
    graphClientForAccount.mockResolvedValue({ validateConnection });
    await expect(testAccountConnection("account_1")).resolves.toEqual({ ok: true, message: "Conexão com @loja validada." });
    expect(graphClientForAccount).toHaveBeenCalledWith("account_1");
  });

  it("não gera link de WhatsApp sem destino HTTPS configurado", async () => {
    vi.stubEnv("ADMIN_RECONNECT_WHATSAPP_URL", "http://wa.me/5511999999999");
    await expect(getReconnectWhatsAppLink("workspace_1", "account_1", "loja")).resolves.toEqual({ ok: false, error: "A URL de reconexão por WhatsApp é inválida." });
  });

  it("ativa a impersonação somente para o workspace informado", async () => {
    await expect(viewWorkspaceAsClient("workspace_1")).resolves.toMatchObject({ ok: true });
    expect(impersonateWorkspace).toHaveBeenCalledWith("workspace_1");
  });
});
