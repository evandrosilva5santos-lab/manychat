import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, headerStore, db } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  headerStore: { get: vi.fn() },
  db: {
    userSession: { findUnique: vi.fn() },
    user: { upsert: vi.fn() },
    instagramAccount: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    workspace: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    message: { count: vi.fn() },
    flowRun: { count: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore), headers: vi.fn(async () => headerStore) }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  AccountAccessError,
  getTenantContext,
  getAdminOverview,
  hashSessionToken,
  selectActiveAccount,
} from "./tenancy";

const client = { id: "client", email: "client@example.com", name: "Cliente", role: "CLIENT" as const };
const admin = { id: "admin", email: "admin@example.com", name: "Evandro", role: "SUPERADMIN" as const };

beforeEach(() => {
  vi.resetAllMocks();
  cookieStore.get.mockReturnValue(undefined);
  db.userSession.findUnique.mockResolvedValue(null);
  db.instagramAccount.findFirst.mockResolvedValue(null);
  db.instagramAccount.findMany.mockResolvedValue([]);
  db.workspace.findMany.mockResolvedValue([]);
  db.instagramAccount.count.mockResolvedValue(0);
  db.message.count.mockResolvedValue(0);
  db.flowRun.count.mockResolvedValue(0);
});

describe("multi-tenancy", () => {
  it("hasheia o token opaco sem persistir o segredo da sessão", () => {
    expect(hashSessionToken("session-secret")).toBe(createHash("sha256").update("session-secret").digest("hex"));
  });

  it("cliente A não obtém a conta do workspace do cliente B", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "fluxo_session" ? { value: "session-a" } : { value: "account-b" });
    db.userSession.findUnique.mockResolvedValue({ user: { ...client, workspacesOwned: [{ id: "workspace-a" }] } });
    db.instagramAccount.findFirst.mockResolvedValue(null);

    await expect(selectActiveAccount(client, "account-b")).rejects.toBeInstanceOf(AccountAccessError);
  });

  it("cliente acessa somente sua conta selecionada", async () => {
    const account = { id: "account-a", workspaceId: "workspace-a", username: "loja" };
    db.instagramAccount.findFirst.mockResolvedValue(account);

    await expect(selectActiveAccount(client, "account-a")).resolves.toEqual(account);
    expect(db.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "account-a", workspace: { ownerId: "client" } },
    });
  });

  it("super admin pode selecionar qualquer conta sem forjar ownership", async () => {
    const account = { id: "account-b", workspaceId: "workspace-b", username: "outra" };
    db.instagramAccount.findFirst.mockResolvedValue(account);
    await expect(selectActiveAccount(admin, "account-b")).resolves.toEqual(account);
    expect(db.instagramAccount.findFirst).toHaveBeenCalledWith({ where: { id: "account-b" } });
  });

  it("super admin enxerga os clientes e todas as contas da plataforma", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "fluxo_session" ? { value: "admin-session" } : undefined);
    db.userSession.findUnique.mockResolvedValue({ user: admin, expiresAt: new Date(Date.now() + 60_000) });
    db.workspace.findMany.mockResolvedValue([
      {
        id: "workspace-a", name: "Loja A", owner: { ...client, createdAt: new Date("2026-01-01") },
        accounts: [{ id: "account-a", username: "loja_a", igUserId: "1", profilePicUrl: null, status: "CONNECTED", tokenExpiresAt: null, messages: [] }],
      },
      {
        id: "workspace-b", name: "Loja B", owner: { id: "client-b", name: "Cliente B", email: "b@example.com", role: "CLIENT", createdAt: new Date("2026-02-01") },
        accounts: [{ id: "account-b", username: "loja_b", igUserId: "2", profilePicUrl: null, status: "CONNECTED", tokenExpiresAt: null, messages: [] }],
      },
    ]);
    db.instagramAccount.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    db.message.count.mockResolvedValue(14);
    db.flowRun.count.mockResolvedValue(3);

    const overview = await getAdminOverview();
    expect(overview.metrics).toMatchObject({ clientCount: 2, instagramAccountCount: 2, activeConnections: 2, messagesThisMonth: 14, flowsThisMonth: 3 });
    expect(overview.clients.flatMap((workspace) => workspace.accounts.map((account) => account.id))).toEqual(["account-a", "account-b"]);
  });

  it("contexto exige sessão válida fora do bootstrap de desenvolvimento", async () => {
    await expect(getTenantContext()).resolves.toEqual({ actor: null, account: null, impersonatedWorkspaceId: null });
  });
});
