import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccount, deleteData, requireAuth } = vi.hoisted(() => ({
  getAccount: vi.fn(),
  deleteData: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/auth/requireAuth", () => ({ requireAuth }));
vi.mock("@/lib/account", () => ({ getCurrentAccount: getAccount }));
vi.mock("@/lib/lgpd/contact-data", () => ({ deleteContactData: deleteData }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteContact } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  getAccount.mockResolvedValue({ id: "acc_1" });
  deleteData.mockResolvedValue(true);
});

describe("deleteContact (LGPD: eliminação)", () => {
  it("exige login antes de qualquer coisa", async () => {
    requireAuth.mockRejectedValue(new Error("Acesso não autorizado."));
    await expect(deleteContact("c_1", "EXCLUIR")).rejects.toThrow("Acesso não autorizado.");
    expect(deleteData).not.toHaveBeenCalled();
  });

  it("recusa sem a palavra EXCLUIR, conferida de novo no servidor", async () => {
    expect(await deleteContact("c_1", "apagar")).toEqual({ ok: false, error: "Digite EXCLUIR para confirmar." });
    expect(deleteData).not.toHaveBeenCalled();
  });

  it("aceita a palavra sem diferença de maiúsculas e apaga só no perfil ativo", async () => {
    expect(await deleteContact("c_1", " excluir ")).toEqual({ ok: true });
    expect(deleteData).toHaveBeenCalledWith("acc_1", "c_1");
  });

  it("contato de outro perfil: responde 'não encontrado'", async () => {
    deleteData.mockResolvedValue(false);
    expect(await deleteContact("c_outro", "EXCLUIR")).toEqual({ ok: false, error: "Contato não encontrado nesta conta." });
  });

  it("sem perfil ativo não apaga nada", async () => {
    getAccount.mockResolvedValue(null);
    expect(await deleteContact("c_1", "EXCLUIR")).toEqual({ ok: false, error: "Nenhuma conta ativa." });
    expect(deleteData).not.toHaveBeenCalled();
  });

  it("falha no banco vira mensagem amigável, sem detalhes internos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteData.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    expect(await deleteContact("c_1", "EXCLUIR")).toEqual({ ok: false, error: "Não foi possível excluir agora. Tente de novo." });
  });
});
