import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireWorkspaceRole, tx } = vi.hoisted(() => {
  const tx = {
    workspaceInvitation: { updateMany: vi.fn() },
    workspaceMember: { upsert: vi.fn() },
  };
  return {
    tx,
    requireWorkspaceRole: vi.fn(),
    db: {
      workspaceMember: { findFirst: vi.fn(), findMany: vi.fn(), delete: vi.fn(), update: vi.fn() },
      workspaceInvitation: { findUnique: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
      user: { findUnique: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as unknown[]))),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tenancy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenancy")>()),
  requireWorkspaceRole,
}));

import { AccountAccessError } from "@/lib/tenancy";
import { verifyPassword } from "@/lib/auth/password";
import { acceptInvitation, changeMemberRole, createInvitation, hashInviteToken, removeMember } from "./team";

const admin = { id: "u-admin", name: "Admin", email: "admin@loja.com", role: "CLIENT" as const };
const openInvite = {
  id: "inv1", workspaceId: "w1", email: "nova@loja.com", role: "OPERATOR",
  acceptedAt: null, expiresAt: new Date(Date.now() + 86_400_000), workspace: { name: "Loja" },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspaceRole.mockResolvedValue({ actor: admin, role: "ADMIN" });
  db.workspaceMember.findFirst.mockResolvedValue(null);
  db.workspaceInvitation.findUnique.mockResolvedValue(openInvite);
  db.user.findUnique.mockResolvedValue(null);
  db.user.create.mockImplementation(async ({ data }) => ({ id: "u-novo", ...data }));
  tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 1 });
});

describe("createInvitation", () => {
  it("guarda só o hash do token, troca o convite pendente anterior e confere a vaga", async () => {
    const canAdd = vi.fn();
    const { path, email } = await createInvitation("w1", " Nova@Loja.com ", "OPERATOR", canAdd);
    const token = path.replace("/convite/", "");
    expect(email).toBe("nova@loja.com");
    expect(canAdd).toHaveBeenCalled();
    expect(db.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "w1", email: "nova@loja.com", acceptedAt: null } });
    const data = db.workspaceInvitation.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(requireWorkspaceRole).toHaveBeenCalledWith("w1", ["OWNER", "ADMIN"]);
  });

  it("não convida como dono nem com papel inventado", async () => {
    await expect(createInvitation("w1", "x@y.com", "OWNER")).rejects.toThrow("Papel inválido.");
    await expect(createInvitation("w1", "x@y.com", "ROOT")).rejects.toThrow("Papel inválido.");
  });

  it("recusa e-mail inválido e quem já é membro", async () => {
    await expect(createInvitation("w1", "não-é-email", "OPERATOR")).rejects.toThrow("E-mail inválido.");
    db.workspaceMember.findFirst.mockResolvedValue({ id: "m" });
    await expect(createInvitation("w1", "x@y.com", "OPERATOR")).rejects.toThrow("já faz parte");
  });

  it("administrador não convida outro administrador (só o dono)", async () => {
    await expect(createInvitation("w1", "x@y.com", "ADMIN")).rejects.toThrow("Só o dono");
    requireWorkspaceRole.mockResolvedValue({ actor: admin, role: "OWNER" });
    await expect(createInvitation("w1", "x@y.com", "ADMIN")).resolves.toMatchObject({ email: "x@y.com" });
  });

  it("atendente não convida", async () => {
    requireWorkspaceRole.mockRejectedValue(new AccountAccessError("Seu papel nesta equipe não permite esta ação."));
    await expect(createInvitation("w1", "x@y.com", "ADMIN")).rejects.toBeInstanceOf(AccountAccessError);
    expect(db.workspaceInvitation.create).not.toHaveBeenCalled();
  });
});

// Cria senha com scrypt (lento de propósito): folga de tempo para a máquina carregada.
describe("acceptInvitation", { timeout: 30_000 }, () => {
  it("sem sessão cria a pessoa com senha e vira membro com o papel do convite", async () => {
    const result = await acceptInvitation("tok", { actor: null, name: "Nova", password: "senha-segura" });
    expect(result).toEqual({ userId: "u-novo", workspaceId: "w1" });
    const created = db.user.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ email: "nova@loja.com", name: "Nova", role: "CLIENT" });
    await expect(verifyPassword("senha-segura", created.passwordHash)).resolves.toBe(true);
    expect(tx.workspaceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { workspaceId: "w1", userId: "u-novo", role: "OPERATOR" } }),
    );
  });

  it("convite vencido, usado ou inexistente não vale", async () => {
    db.workspaceInvitation.findUnique.mockResolvedValue({ ...openInvite, expiresAt: new Date(Date.now() - 1000) });
    await expect(acceptInvitation("tok", { actor: null, name: "N", password: "senha-segura" })).rejects.toThrow("não vale mais");
    db.workspaceInvitation.findUnique.mockResolvedValue({ ...openInvite, acceptedAt: new Date() });
    await expect(acceptInvitation("tok", { actor: null, name: "N", password: "senha-segura" })).rejects.toThrow("não vale mais");
    db.workspaceInvitation.findUnique.mockResolvedValue(null);
    await expect(acceptInvitation("tok", { actor: null })).rejects.toThrow("não vale mais");
  });

  it("dois cliques ao mesmo tempo: o segundo não entra", async () => {
    tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(acceptInvitation("tok", { actor: null, name: "N", password: "senha-segura" })).rejects.toThrow("não vale mais");
    expect(tx.workspaceMember.upsert).not.toHaveBeenCalled();
  });

  it("e-mail que já tem conta precisa entrar antes", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u-existente" });
    await expect(acceptInvitation("tok", { actor: null, name: "N", password: "senha-segura" })).rejects.toThrow("Entre com ela");
  });

  it("logado com outro e-mail não aceita convite alheio", async () => {
    await expect(acceptInvitation("tok", { actor: admin })).rejects.toBeInstanceOf(AccountAccessError);
  });

  it("logado com o e-mail certo entra sem criar usuário", async () => {
    const result = await acceptInvitation("tok", { actor: { ...admin, id: "u-nova", email: "Nova@loja.com" } });
    expect(result.userId).toBe("u-nova");
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("confere a vaga do plano antes de aceitar", async () => {
    const canAdd = vi.fn().mockRejectedValue(new Error("limite"));
    await expect(acceptInvitation("tok", { actor: null, name: "N", password: "senha-segura" }, canAdd)).rejects.toThrow("limite");
    expect(canAdd).toHaveBeenCalledWith("w1");
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("senha curta é recusada", async () => {
    await expect(acceptInvitation("tok", { actor: null, name: "N", password: "123" })).rejects.toThrow("8 caracteres");
  });
});

describe("membros", () => {
  it("dono não é removido nem rebaixado por aqui", async () => {
    db.workspaceMember.findFirst.mockResolvedValue({ id: "m-dono", role: "OWNER", userId: "u-dono" });
    await expect(removeMember("w1", "m-dono")).rejects.toThrow("dono do workspace");
    await expect(changeMemberRole("w1", "m-dono", "OPERATOR")).rejects.toThrow("dono do workspace");
  });

  it("ninguém remove a si mesmo", async () => {
    db.workspaceMember.findFirst.mockResolvedValue({ id: "m-admin", role: "ADMIN", userId: "u-admin" });
    await expect(removeMember("w1", "m-admin")).rejects.toThrow("a si mesmo");
  });

  it("membro de outro workspace não é encontrado", async () => {
    await removeMember("w1", "m-x").catch(() => undefined);
    expect(db.workspaceMember.findFirst).toHaveBeenCalledWith({ where: { id: "m-x", workspaceId: "w1" } });
    expect(db.workspaceMember.delete).not.toHaveBeenCalled();
  });
});
