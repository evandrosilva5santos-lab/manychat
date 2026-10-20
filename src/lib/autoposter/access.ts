// Isolamento entre clientes: todo acesso da agência passa por aqui. Mesmo critério
// de tenancy.ts — Super Admin vê tudo; os demais só o que é do próprio workspace.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/requireAuth";
import { canUseFeature } from "@/lib/access/context";
import { requireActor, getOrCreateWorkspaceForActor, type TenantActor } from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";

export class AutoposterNotFoundError extends UserFacingError {
  constructor(message = "Projeto não encontrado ou sem acesso.") {
    super(message);
    this.name = "AutoposterNotFoundError";
  }
}

export async function requireAutoposterActor(): Promise<TenantActor> {
  await requireAuth();
  const actor = await requireActor();
  // Plano (ADR-010): o recurso é conferido no servidor, não só no layout.
  const { allowed } = await canUseFeature("autoposter");
  if (!allowed) throw new UserFacingError("O Autoposter não está liberado no seu plano ou a assinatura está pausada. Veja Plano e cobrança.");
  return actor;
}

export function projectScope(actor: TenantActor): Prisma.AutoposterProjectWhereInput {
  return actor.role === "SUPERADMIN" ? {} : { workspace: { ownerId: actor.id } };
}

export function accountScope(actor: TenantActor): Prisma.InstagramAccountWhereInput {
  return actor.role === "SUPERADMIN" ? {} : { workspace: { ownerId: actor.id } };
}

export const projectAccountsInclude = {
  accounts: {
    orderBy: { createdAt: "asc" },
    include: {
      account: {
        select: { id: true, username: true, name: true, profilePicUrl: true, status: true, authProvider: true, fbPageId: true },
      },
    },
  },
} satisfies Prisma.AutoposterProjectInclude;

export async function requireProject(projectId: string, actor?: TenantActor) {
  const who = actor ?? (await requireAutoposterActor());
  const project = await prisma.autoposterProject.findFirst({
    where: { id: projectId, ...projectScope(who) },
    include: projectAccountsInclude,
  });
  if (!project) throw new AutoposterNotFoundError();
  return { actor: who, project };
}

export async function requirePost(postId: string, actor?: TenantActor) {
  const who = actor ?? (await requireAutoposterActor());
  const post = await prisma.autoposterPost.findFirst({
    where: { id: postId, project: projectScope(who) },
    include: { project: true, targets: true },
  });
  if (!post) throw new AutoposterNotFoundError("Post não encontrado ou sem acesso.");
  return { actor: who, post };
}

/** Contas que o ator pode ligar a um projeto (todas devem ser dele). */
export async function requireAccessibleAccounts(actor: TenantActor, accountIds: string[]) {
  if (accountIds.length === 0) return [];
  const accounts = await prisma.instagramAccount.findMany({
    where: { id: { in: accountIds }, ...accountScope(actor) },
    select: { id: true, workspaceId: true },
  });
  if (accounts.length !== new Set(accountIds).size) throw new UserFacingError("Uma das contas escolhidas não está disponível.");
  return accounts;
}

/** Workspace do projeto novo: o das contas escolhidas ou o do próprio usuário. */
export async function workspaceForProject(actor: TenantActor, accountWorkspaceIds: string[]): Promise<string> {
  const unique = [...new Set(accountWorkspaceIds)];
  if (unique.length > 1) throw new UserFacingError("Escolha contas de um mesmo workspace.");
  if (unique.length === 1) return unique[0];
  return (await getOrCreateWorkspaceForActor(actor)).id;
}
