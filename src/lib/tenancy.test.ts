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
    dataDeletionRequest: { findMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore), headers: vi.fn(async () => headerStore) }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  AccountAccessError,
  getTenantContext,
  getUserMenuData,
  findNextConnectedAccount,
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
  db.dataDeletionRequest.findMany.mockResolvedValue([]);
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

  describe("seleção do perfil ativo", () => {
    const session = () => {
      db.userSession.findUnique.mockResolvedValue({ user: client, expiresAt: new Date(Date.now() + 60_000) });
    };
    const accounts = [
      { id: "a", workspaceId: "w", username: "a_descarregado", status: "DISCONNECTED" },
      { id: "b", workspaceId: "w", username: "b_conectado", status: "CONNECTED" },
      { id: "c", workspaceId: "w", username: "c_conectado", status: "CONNECTED" },
    ];

    it("sem cookie válido, prefere o primeiro perfil CONECTADO", async () => {
      cookieStore.get.mockImplementation((name: string) => (name === "fluxo_session" ? { value: "s" } : undefined));
      session();
      db.instagramAccount.findMany.mockResolvedValue(accounts);
      const { account } = await getTenantContext();
      expect(account?.id).toBe("b");
    });

    it("sem nenhum conectado, cai no primeiro da lista", async () => {
      cookieStore.get.mockImplementation((name: string) => (name === "fluxo_session" ? { value: "s" } : undefined));
      session();
      db.instagramAccount.findMany.mockResolvedValue([accounts[0]]);
      const { account } = await getTenantContext();
      expect(account?.id).toBe("a");
    });

    it("sem cookie, não escolhe perfil com exclusão PENDING", async () => {
      cookieStore.get.mockImplementation((name: string) => (name === "fluxo_session" ? { value: "s" } : undefined));
      session();
      db.instagramAccount.findMany.mockResolvedValue(accounts);
      db.dataDeletionRequest.findMany.mockResolvedValue([{ accountIds: ["b"] }]);
      const { account } = await getTenantContext();
      expect(account?.id).toBe("c");
      expect(db.dataDeletionRequest.findMany).toHaveBeenCalledWith({
        where: { status: "PENDING" },
        select: { accountIds: true },
      });
    });

    it("se todos os perfis estão em exclusão, não há perfil padrão", async () => {
      cookieStore.get.mockImplementation((name: string) => (name === "fluxo_session" ? { value: "s" } : undefined));
      session();
      db.instagramAccount.findMany.mockResolvedValue([accounts[1]]);
      db.dataDeletionRequest.findMany.mockResolvedValue([{ accountIds: ["b", "zzz"] }]);
      const { account } = await getTenantContext();
      expect(account).toBeNull();
    });

    it("respeita o cookie mesmo que o perfil escolhido esteja descarregado", async () => {
      cookieStore.get.mockImplementation((name: string) =>
        name === "fluxo_session" ? { value: "s" } : name === "active_ig_account_id" ? { value: "a" } : undefined,
      );
      session();
      db.instagramAccount.findMany.mockResolvedValue(accounts);
      const { account } = await getTenantContext();
      expect(account?.id).toBe("a");
    });

    it("findNextConnectedAccount busca só no mesmo workspace, conectado e excluindo o atual", async () => {
      db.instagramAccount.findFirst.mockResolvedValue({ id: "b" });
      await expect(findNextConnectedAccount("w", "a")).resolves.toEqual({ id: "b" });
      expect(db.instagramAccount.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: "w", status: "CONNECTED", id: { not: "a" } },
        orderBy: [{ username: "asc" }, { id: "asc" }],
      });
    });
  });
});

describe("getUserMenuData", () => {
  const row = (id: string, workspaceId: string, extra: Record<string, unknown> = {}) => ({
    id, workspaceId, username: `user_${id}`, name: `Nome ${id}`, profilePicUrl: null, status: "CONNECTED",
    tokenExpiresAt: new Date("2026-12-01T00:00:00Z"), authProvider: "INSTAGRAM_LOGIN",
    accessTokenEnc: "SEGREDO", pageAccessTokenEnc: "SEGREDO2", tokenStatus: "ACTIVE", ...extra,
  });
  const login = (user: typeof client | typeof admin, cookies: Record<string, string> = {}) => {
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "fluxo_session") return { value: "s" };
      return cookies[name] ? { value: cookies[name] } : undefined;
    });
    db.userSession.findUnique.mockResolvedValue({ user, expiresAt: new Date(Date.now() + 60_000) });
  };

  it("sem sessão devolve actor nulo e lista vazia", async () => {
    await expect(getUserMenuData()).resolves.toEqual({ actor: null, accounts: [], activeAccountId: null, impersonatedWorkspaceId: null });
  });

  it("CLIENT consulta apenas o próprio workspace", async () => {
    login(client);
    db.instagramAccount.findMany.mockResolvedValue([row("a", "w1")]);
    const data = await getUserMenuData();
    expect(db.instagramAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspace: { ownerId: "client" } } }));
    expect(data.accounts.map((a) => a.id)).toEqual(["a"]);
    expect(data.actor?.role).toBe("CLIENT");
  });

  it("SUPERADMIN vê todas as contas", async () => {
    login(admin);
    db.instagramAccount.findMany.mockResolvedValue([row("a", "w1"), row("b", "w2")]);
    const data = await getUserMenuData();
    expect(db.instagramAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(data.accounts.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("SUPERADMIN em visão de cliente enxerga só o workspace visualizado", async () => {
    login(admin, { fluxo_workspace_view: "w2" });
    db.instagramAccount.findMany.mockResolvedValue([row("a", "w1"), row("b", "w2")]);
    const data = await getUserMenuData();
    expect(data.accounts.map((a) => a.id)).toEqual(["b"]);
    expect(data.impersonatedWorkspaceId).toBe("w2");
    expect(data.activeAccountId).toBe("b");
  });

  it("marca como ativa a conta do cookie", async () => {
    login(client, { active_ig_account_id: "b" });
    db.instagramAccount.findMany.mockResolvedValue([row("a", "w1"), row("b", "w1")]);
    expect((await getUserMenuData()).activeAccountId).toBe("b");
  });

  it("nunca expõe campos de token", async () => {
    login(client);
    db.instagramAccount.findMany.mockResolvedValue([row("a", "w1")]);
    const data = await getUserMenuData();
    expect(Object.keys(data.accounts[0]).sort()).toEqual(
      ["authProvider", "id", "name", "profilePicUrl", "status", "tokenExpiresAt", "username", "workspaceId"],
    );
    expect(JSON.stringify(data)).not.toContain("SEGREDO");
  });
});
