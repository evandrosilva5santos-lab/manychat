import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { db } = vi.hoisted(() => {
  const db = {
    plan: { findFirst: vi.fn() },
    user: { create: vi.fn() },
    workspace: { create: vi.fn() },
    subscription: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { isPublicSignupEnabled, signUp } from "./signup";

const NOW = new Date("2026-10-13T12:00:00Z");
const pro = { id: "plan_pro", slug: "pro", trialDays: 14 };
const input = { name: "Ana", company: "Loja da Ana", email: " Ana@Loja.com ", password: "senha-segura", plan: "pro" };

// Cria senha com scrypt (lento de propósito): folga de tempo para a máquina carregada.
describe("signUp", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PUBLIC_SIGNUP", "on");
    db.plan.findFirst.mockResolvedValue(pro);
    db.user.create.mockResolvedValue({ id: "u1" });
    db.workspace.create.mockResolvedValue({ id: "w1" });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fica fechado sem PUBLIC_SIGNUP=on", async () => {
    vi.stubEnv("PUBLIC_SIGNUP", "");
    await expect(signUp(input, NOW)).rejects.toThrow("ainda não está aberto");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(isPublicSignupEnabled({ PUBLIC_SIGNUP: "ON " })).toBe(true);
  });

  it("cria pessoa, workspace com ela como dona e teste grátis pelos dias do plano", async () => {
    await expect(signUp(input, NOW)).resolves.toEqual({ userId: "u1", workspaceId: "w1", trial: true });
    expect(db.user.create.mock.calls[0][0].data).toMatchObject({ email: "ana@loja.com", role: "CLIENT" });
    expect(db.user.create.mock.calls[0][0].data.passwordHash).toMatch(/^scrypt\$/);
    expect(db.workspace.create).toHaveBeenCalledWith({
      data: { name: "Loja da Ana", ownerId: "u1", kind: "CUSTOMER", members: { create: { userId: "u1", role: "OWNER" } } },
    });
    expect(db.subscription.create).toHaveBeenCalledWith({
      data: { workspaceId: "w1", planId: "plan_pro", status: "TRIALING", trialEndsAt: new Date("2026-10-27T12:00:00Z") },
    });
  });

  it("plano sem teste grátis nasce sem assinatura (paga em /plano antes de operar)", async () => {
    db.plan.findFirst.mockResolvedValue({ ...pro, trialDays: 0 });
    await expect(signUp(input, NOW)).resolves.toMatchObject({ trial: false });
    expect(db.subscription.create).not.toHaveBeenCalled();
  });

  it("plano escolhido fora de venda cai no primeiro público com teste", async () => {
    db.plan.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(pro);
    await signUp({ ...input, plan: "secreto" }, NOW);
    expect(db.plan.findFirst).toHaveBeenLastCalledWith({
      where: { isActive: true, isPublic: true, trialDays: { gt: 0 } },
      orderBy: { sortOrder: "asc" },
    });
  });

  it("sem plano à venda não cria nada", async () => {
    db.plan.findFirst.mockResolvedValue(null);
    await expect(signUp(input, NOW)).rejects.toThrow("Nenhum plano");
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("e-mail repetido vira mensagem clara", async () => {
    db.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
    await expect(signUp(input, NOW)).rejects.toThrow("Já existe uma conta");
  });

  it.each([
    [{ password: "curta" }, /8 caracteres/],
    [{ email: "sem-arroba" }, /E-mail inválido/],
    [{ name: "" }, /seu nome/],
  ])("valida %o", async (patch, message) => {
    await expect(signUp({ ...input, ...patch }, NOW)).rejects.toThrow(message);
    expect(db.user.create).not.toHaveBeenCalled();
  });
});
