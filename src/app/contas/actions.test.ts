import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  class AccountAccessError extends Error {
    constructor(message = "Você não tem acesso a esta conta do Instagram.") {
      super(message);
      this.name = "AccountAccessError";
    }
  }
  return {
    AccountAccessError,
    requireActor: vi.fn(),
    selectActiveAccount: vi.fn(),
    setActiveAccount: vi.fn(),
    clearActiveAccount: vi.fn(),
    getTenantContext: vi.fn(),
    disconnectAccount: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/tenancy", () => ({
  AccountAccessError: m.AccountAccessError,
  requireActor: m.requireActor,
  selectActiveAccount: m.selectActiveAccount,
  setActiveAccount: m.setActiveAccount,
  clearActiveAccount: m.clearActiveAccount,
  getTenantContext: m.getTenantContext,
}));
vi.mock("@/lib/meta/account-lifecycle", () => ({ disconnectAccount: m.disconnectAccount }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));

import { activateAccount, unloadAccount } from "./actions";

const actor = { id: "u1", role: "CLIENT", name: "Ana", email: "a@x.com" };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireActor.mockResolvedValue(actor);
  m.selectActiveAccount.mockResolvedValue({ id: "acc_1", username: "loja", workspaceId: "w1" });
  m.getTenantContext.mockResolvedValue({ actor, account: { id: "other" }, impersonatedWorkspaceId: null });
});

describe("unloadAccount", () => {
  it("autoriza antes e descarrega mantendo o histórico (reason USER, avisa a Meta)", async () => {
    await expect(unloadAccount("acc_1")).resolves.toEqual({ ok: true, message: "@loja foi descarregado. As automações dele estão paradas." });
    expect(m.selectActiveAccount).toHaveBeenCalledWith(actor, "acc_1");
    expect(m.disconnectAccount).toHaveBeenCalledWith("acc_1", { reason: "USER", notifyMeta: true });
    expect(m.selectActiveAccount.mock.invocationCallOrder[0]).toBeLessThan(m.disconnectAccount.mock.invocationCallOrder[0]);
    expect(m.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("conta de outro workspace gera erro de acesso e não descarrega nada", async () => {
    m.selectActiveAccount.mockRejectedValue(new m.AccountAccessError());
    const result = await unloadAccount("acc_outro");
    expect(result).toEqual({ ok: false, message: "Você não tem acesso a esta conta do Instagram." });
    expect(m.disconnectAccount).not.toHaveBeenCalled();
  });

  it("limpa a seleção quando descarrega o perfil que estava ativo", async () => {
    m.getTenantContext.mockResolvedValue({ actor, account: { id: "acc_1" }, impersonatedWorkspaceId: null });
    await unloadAccount("acc_1");
    expect(m.clearActiveAccount).toHaveBeenCalledOnce();
  });

  it("falha inesperada vira mensagem clara sem vazar detalhes", async () => {
    m.disconnectAccount.mockRejectedValue(new Error("ECONNRESET secret-host"));
    const result = await unloadAccount("acc_1");
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("secret-host");
    expect(result.message).toMatch(/Não foi possível/);
  });

  it("id vazio é rejeitado sem tocar o banco", async () => {
    expect((await unloadAccount("")).ok).toBe(false);
    expect(m.selectActiveAccount).not.toHaveBeenCalled();
  });
});

describe("activateAccount", () => {
  it("autoriza e ativa a conta", async () => {
    await expect(activateAccount("acc_1")).resolves.toMatchObject({ ok: true });
    expect(m.selectActiveAccount).toHaveBeenCalledWith(actor, "acc_1");
    expect(m.setActiveAccount).toHaveBeenCalledWith("acc_1");
  });

  it("conta de outro workspace não é ativada", async () => {
    m.selectActiveAccount.mockRejectedValue(new m.AccountAccessError());
    const result = await activateAccount("acc_outro");
    expect(result.ok).toBe(false);
    expect(m.setActiveAccount).not.toHaveBeenCalled();
  });
});
