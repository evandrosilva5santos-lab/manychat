import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthorizedBasicUser, readBasicAuthConfig } from "@/lib/auth/basic";

export const ACTIVE_ACCOUNT_COOKIE = "active_ig_account_id";
export const SESSION_COOKIE = "fluxo_session";
export const IMPERSONATION_COOKIE = "fluxo_workspace_view";

export type TenantActor = {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "CLIENT";
};

export class AccountAccessError extends Error {
  constructor(message = "Você não tem acesso a esta conta do Instagram.") {
    super(message);
    this.name = "AccountAccessError";
  }
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function actorFrom(user: { id: string; name: string; email: string; role: "SUPERADMIN" | "CLIENT" }): TenantActor {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function resolveBootstrapAdmin(): Promise<TenantActor | null> {
  const requestHeaders = await headers();
  const principal = getAuthorizedBasicUser(requestHeaders.get("authorization"), readBasicAuthConfig());
  if (!principal) return null;

  // Enquanto o acesso legado por Basic Auth existir, seu único principal é o
  // operador da plataforma. A variável explícita substitui o identificador
  // local assim que o ambiente produtivo estiver configurado.
  const configuredEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || `${principal}@fluxo.local`;

  const name = process.env.SUPERADMIN_NAME?.trim() || "Administrador";
  const user = await prisma.user.upsert({
    where: { email: configuredEmail },
    create: { email: configuredEmail, name, role: "SUPERADMIN" },
    update: { name, role: "SUPERADMIN" },
  });
  return actorFrom(user);
}

export async function getCurrentActor(): Promise<TenantActor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await prisma.userSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (session && session.expiresAt > new Date()) return actorFrom(session.user);
  }
  return resolveBootstrapAdmin();
}

export async function requireActor() {
  const actor = await getCurrentActor();
  if (!actor) throw new AccountAccessError("Sessão inválida ou expirada.");
  return actor;
}

export async function requireSuperAdmin() {
  const actor = await requireActor();
  if (actor.role !== "SUPERADMIN") throw new AccountAccessError("Apenas o Super Admin pode executar esta ação.");
  return actor;
}

export async function selectActiveAccount(actor: TenantActor, accountId: string) {
  const account = await prisma.instagramAccount.findFirst({
    where: actor.role === "SUPERADMIN" ? { id: accountId } : { id: accountId, workspace: { ownerId: actor.id } },
  });
  if (!account) throw new AccountAccessError();
  return account;
}

export async function listAccessibleAccounts(actor: TenantActor) {
  return prisma.instagramAccount.findMany({
    where: actor.role === "SUPERADMIN" ? {} : { workspace: { ownerId: actor.id } },
    orderBy: [{ username: "asc" }, { id: "asc" }],
  });
}

/** Confere se o workspace ainda existe (convites e cookies podem apontar para um apagado). */
export async function workspaceExists(workspaceId: string): Promise<boolean> {
  return Boolean(await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } }));
}

/** Retorna o workspace operacional do usuário, criando-o apenas no primeiro acesso. */
export async function getOrCreateWorkspaceForActor(actor: TenantActor) {
  const existing = await prisma.workspace.findFirst({
    where: { ownerId: actor.id },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.workspace.create({
    data: {
      ownerId: actor.id,
      name: actor.role === "SUPERADMIN" ? "Operação instachat" : `Workspace de ${actor.name}`,
    },
  });
}

async function withoutPendingDeletion<T extends { id: string }>(accounts: T[]): Promise<T[]> {
  if (accounts.length === 0) return accounts;
  const pending = await prisma.dataDeletionRequest.findMany({
    where: { status: "PENDING" },
    select: { accountIds: true },
  });
  const deleting = new Set(pending.flatMap((request) => request.accountIds));
  return accounts.filter((account) => !deleting.has(account.id));
}

async function resolveActiveAccount<T extends { id: string; workspaceId: string; status: string }>(
  accounts: T[],
  requestedId: string | undefined,
  impersonatedWorkspaceId: string | null,
) {
  const narrowed = impersonatedWorkspaceId ? accounts.filter((account) => account.workspaceId === impersonatedWorkspaceId) : accounts;
  const requested = requestedId ? narrowed.find((account) => account.id === requestedId) : undefined;
  // Sem seleção válida, prefere um perfil conectado: abrir o painel num perfil
  // descarregado esconderia perfis que funcionam.
  // Perfil com exclusão em andamento nunca vira o padrão (a tabela de pendentes é minúscula).
  const candidates = requested ? narrowed : await withoutPendingDeletion(narrowed);
  const selected = requested ?? candidates.find((account) => account.status === "CONNECTED") ?? candidates[0];
  return { narrowed, selected: selected ?? null };
}

export async function getTenantContext() {
  const [actor, store] = await Promise.all([getCurrentActor(), cookies()]);
  if (!actor) return { actor: null, account: null, impersonatedWorkspaceId: null };
  const impersonatedWorkspaceId = actor.role === "SUPERADMIN" ? store.get(IMPERSONATION_COOKIE)?.value ?? null : null;
  const accounts = await listAccessibleAccounts(actor);
  const { selected } = await resolveActiveAccount(accounts, store.get(ACTIVE_ACCOUNT_COOKIE)?.value, impersonatedWorkspaceId);
  return { actor, account: selected, impersonatedWorkspaceId };
}

export type MenuAccount = {
  id: string;
  username: string;
  name: string | null;
  profilePicUrl: string | null;
  status: string;
  tokenExpiresAt: Date | null;
  authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  workspaceId: string;
};

/** Dados dos menus de perfil/conta. Só campos seguros: nenhum token sai daqui. */
export async function getUserMenuData(): Promise<{
  actor: TenantActor | null;
  accounts: MenuAccount[];
  activeAccountId: string | null;
  impersonatedWorkspaceId: string | null;
}> {
  const [actor, store] = await Promise.all([getCurrentActor(), cookies()]);
  if (!actor) return { actor: null, accounts: [], activeAccountId: null, impersonatedWorkspaceId: null };
  const impersonatedWorkspaceId = actor.role === "SUPERADMIN" ? store.get(IMPERSONATION_COOKIE)?.value ?? null : null;
  const all = await listAccessibleAccounts(actor);
  const { narrowed, selected } = await resolveActiveAccount(all, store.get(ACTIVE_ACCOUNT_COOKIE)?.value, impersonatedWorkspaceId);
  const accounts = narrowed.map((account): MenuAccount => ({
    id: account.id,
    username: account.username,
    name: account.name ?? null,
    profilePicUrl: account.profilePicUrl ?? null,
    status: account.status,
    tokenExpiresAt: account.tokenExpiresAt ?? null,
    authProvider: account.authProvider,
    workspaceId: account.workspaceId,
  }));
  return { actor, accounts, activeAccountId: selected?.id ?? null, impersonatedWorkspaceId };
}

export async function setActiveAccount(accountId: string) {
  const actor = await requireActor();
  const account = await selectActiveAccount(actor, accountId);
  const store = await cookies();
  store.set(ACTIVE_ACCOUNT_COOKIE, account.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Próximo perfil CONECTADO do mesmo workspace (exclui o informado). Nunca sai
 * do workspace: um operador não pode cair no perfil de outro cliente.
 */
export async function findNextConnectedAccount(workspaceId: string, excludeAccountId: string) {
  return prisma.instagramAccount.findFirst({
    where: { workspaceId, status: "CONNECTED", id: { not: excludeAccountId } },
    orderBy: [{ username: "asc" }, { id: "asc" }],
  });
}

/** Remove a seleção de perfil da sessão após uma desconexão explícita. */
export async function clearActiveAccount() {
  const store = await cookies();
  store.delete(ACTIVE_ACCOUNT_COOKIE);
}

export async function impersonateWorkspace(workspaceId: string) {
  await requireSuperAdmin();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new AccountAccessError("Workspace não encontrado.");
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, workspace.id, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 30,
  });
}

export async function createUserSession(userId: string, ttlDays = 30) {
  const token = randomBytes(32).toString("base64url");
  await prisma.userSession.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + ttlDays * 86400000) },
  });
  return token;
}

export async function getAdminOverview() {
  await requireSuperAdmin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const expiring = new Date(Date.now() + 7 * 86400000);
  const [clients, instagramAccountCount, activeConnections, messagesThisMonth, flowsThisMonth] = await Promise.all([
    prisma.workspace.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        accounts: {
          select: {
            id: true, username: true, igUserId: true, profilePicUrl: true, status: true, tokenExpiresAt: true,
            messages: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { username: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.instagramAccount.count(),
    prisma.instagramAccount.count({ where: { status: "CONNECTED", OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: expiring } }] } }),
    prisma.message.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.flowRun.count({ where: { startedAt: { gte: monthStart } } }),
  ]);
  const customerWorkspaces = clients.filter((workspace) => workspace.owner.role !== "SUPERADMIN");
  return {
    metrics: {
      clientCount: customerWorkspaces.length,
      instagramAccountCount,
      activeConnections,
      unhealthyConnections: instagramAccountCount - activeConnections,
      messagesThisMonth,
      flowsThisMonth,
    },
    clients: clients.map((workspace) => ({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      owner: workspace.owner,
      accounts: workspace.accounts.map((account) => ({
        ...account,
        lastActivityAt: account.messages[0]?.createdAt ?? null,
      })),
    })),
  };
}
