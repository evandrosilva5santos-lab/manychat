import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireWorkspaceRole, requireActor } = vi.hoisted(() => {
  const db = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    workspaceMember: { create: vi.fn(), findFirst: vi.fn() },
    userSession: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all(arg as unknown[]),
  );
  return { db, requireWorkspaceRole: vi.fn(), requireActor: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tenancy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenancy")>()),
  requireWorkspaceRole,
  requireActor,
}));

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { addCollaborator, canAssign, canResetPassword, resetCollaboratorPassword } from "./collaborators";
import { changeMyPassword } from "./my-account";

const owner = { id: "u-owner", email: "dona@loja.com", name: "Dona", role: "CLIENT" };
const input = { name: "Bia", email: "Bia@Loja.com", role: "OPERATOR", password: "senha-forte-1" };

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspaceRole.mockResolvedValue({ actor: owner, role: "OWNER" });
  requireActor.mockResolvedValue(owner);
  db.user.findUnique.mockResolvedValue(null);
  db.user.create.mockResolvedValue({ id: "u-bia" });
  db.workspaceMember.create.mockResolvedValue({ id: "m-bia" });
});

describe("papéis", () => {
  it("só o dono cria admin; ninguém cria dono", () => {
    expect(canAssign("OWNER", "ADMIN")).toBe(true);
    expect(canAssign("ADMIN", "ADMIN")).toBe(false);
    expect(canAssign("ADMIN", "OPERATOR")).toBe(true);
    expect(canAssign("OWNER", "OWNER")).toBe(false);
    expect(canAssign("OPERATOR", "OPERATOR")).toBe(false);
  });

  it("dono troca senha de admin e atendente; admin só de atendente; dono nunca", () => {
    expect(canResetPassword("OWNER", "ADMIN")).toBe(true);
    expect(canResetPassword("ADMIN", "OPERATOR")).toBe(true);
    expect(canResetPassword("ADMIN", "ADMIN")).toBe(false);
    expect(canResetPassword("OWNER", "OWNER")).toBe(false);
  });
});

describe("addCollaborator", () => {
  it("cria a pessoa com senha (hash) e o acesso, respeitando o limite do plano", async () => {
    const assertLimit = vi.fn();
    await expect(addCollaborator("w1", input, assertLimit)).resolves.toEqual({ email: "bia@loja.com", passwordSet: true });
    expect(assertLimit).toHaveBeenCalled();
    const created = db.user.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ email: "bia@loja.com", role: "CLIENT" });
    expect(await verifyPassword("senha-forte-1", created.passwordHash)).toBe(true);
    expect(db.workspaceMember.create).toHaveBeenCalledWith({ data: { workspaceId: "w1", userId: "u-bia", role: "OPERATOR" } });
    expect(JSON.stringify(db.auditLog.create.mock.calls[0][0])).not.toContain("senha-forte-1");
  });

  it("e-mail que já tem senha em outra empresa só ganha o acesso, sem trocar a senha", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u-x", role: "CLIENT", passwordHash: "scrypt$a$b", memberships: [{ workspaceId: "w9" }] });
    await expect(addCollaborator("w1", input)).resolves.toEqual({ email: "bia@loja.com", passwordSet: false });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.workspaceMember.create.mock.calls[0][0].data.userId).toBe("u-x");
  });

  it("recusa admin criado por admin, quem já é da equipe, senha curta e limite do plano", async () => {
    requireWorkspaceRole.mockResolvedValue({ actor: owner, role: "ADMIN" });
    await expect(addCollaborator("w1", { ...input, role: "ADMIN" })).rejects.toThrow("Só o dono");
    requireWorkspaceRole.mockResolvedValue({ actor: owner, role: "OWNER" });
    db.user.findUnique.mockResolvedValue({ id: "u-x", role: "CLIENT", passwordHash: null, memberships: [{ workspaceId: "w1" }] });
    await expect(addCollaborator("w1", input)).rejects.toThrow("já faz parte");
    db.user.findUnique.mockResolvedValue(null);
    await expect(addCollaborator("w1", { ...input, password: "curta" })).rejects.toThrow("8");
    await expect(addCollaborator("w1", input, async () => { throw new Error("Seu plano permite até 1 pessoas na equipe."); })).rejects.toThrow("plano");
    expect(db.workspaceMember.create).not.toHaveBeenCalled();
  });
});

describe("resetCollaboratorPassword", () => {
  const member = (role: string, memberships = 1, userRole = "CLIENT") => ({
    role, userId: "u-bia", user: { role: userRole, email: "bia@loja.com", _count: { memberships } },
  });

  it("dono redefine a senha do atendente e derruba as sessões dele", async () => {
    db.workspaceMember.findFirst.mockResolvedValue(member("OPERATOR"));
    await resetCollaboratorPassword("w1", "m-bia", "nova-senha-1");
    expect(await verifyPassword("nova-senha-1", db.user.update.mock.calls[0][0].data.passwordHash)).toBe(true);
    expect(db.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "u-bia" } });
  });

  it("não troca senha de quem também está em outra empresa, do dono nem a própria", async () => {
    db.workspaceMember.findFirst.mockResolvedValue(member("OPERATOR", 2));
    await expect(resetCollaboratorPassword("w1", "m-bia", "nova-senha-1")).rejects.toThrow("outra conta");
    db.workspaceMember.findFirst.mockResolvedValue(member("OWNER"));
    await expect(resetCollaboratorPassword("w1", "m-bia", "nova-senha-1")).rejects.toThrow("papel");
    db.workspaceMember.findFirst.mockResolvedValue({ ...member("ADMIN"), userId: "u-owner" });
    await expect(resetCollaboratorPassword("w1", "m-bia", "nova-senha-1")).rejects.toThrow("Minha conta");
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe("changeMyPassword", () => {
  it("exige a senha atual certa, confirmação igual e mantém a sessão deste navegador", async () => {
    db.user.findUnique.mockResolvedValue({ passwordHash: await hashPassword("antiga-123") });
    await expect(changeMyPassword({ current: "errada-123", next: "nova-senha-9", confirm: "nova-senha-9" }, "tok")).rejects.toThrow("incorreta");
    await expect(changeMyPassword({ current: "antiga-123", next: "nova-senha-9", confirm: "outra" }, "tok")).rejects.toThrow("confirmação");
    await changeMyPassword({ current: "antiga-123", next: "nova-senha-9", confirm: "nova-senha-9" }, "tok");
    expect(await verifyPassword("nova-senha-9", db.user.update.mock.calls[0][0].data.passwordHash)).toBe(true);
    expect(db.userSession.deleteMany.mock.calls[0][0].where).toMatchObject({ userId: "u-owner", tokenHash: { not: expect.any(String) } });
  });
});
