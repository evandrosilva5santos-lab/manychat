// Equipe do workspace (ADR-008): convites por link e papéis OWNER/ADMIN/OPERATOR.
// Toda função confere o papel de quem chama; nada aqui confia no navegador.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import {
  AccountAccessError,
  MANAGER_ROLES,
  requireWorkspaceRole,
  type TenantActor,
  type WorkspaceRole,
} from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";

export const INVITE_TTL_DAYS = 7;
/** Papéis que podem ser dados por convite ou troca. Dono não se transfere por aqui. */
export const ASSIGNABLE_ROLES: readonly WorkspaceRole[] = ["ADMIN", "OPERATOR"];

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(`invite:${token}`).digest("hex");
}

function assertAssignable(role: string): asserts role is WorkspaceRole {
  if (!ASSIGNABLE_ROLES.includes(role as WorkspaceRole)) throw new UserFacingError("Papel inválido.");
}

export async function listTeam(workspaceId: string) {
  await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN", "OPERATOR"]);
  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
    invitations,
  };
}

/** Cria o convite e devolve o caminho com o token (o token em texto só existe aqui). */
export async function createInvitation(workspaceId: string, rawEmail: string, role: string, assertCanAddMember?: () => Promise<void>) {
  const { actor } = await requireWorkspaceRole(workspaceId, MANAGER_ROLES);
  assertAssignable(role);
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new UserFacingError("E-mail inválido.");
  const email = parsed.data;

  const alreadyMember = await prisma.workspaceMember.findFirst({ where: { workspaceId, user: { email } }, select: { id: true } });
  if (alreadyMember) throw new UserFacingError("Esta pessoa já faz parte da equipe.");
  await assertCanAddMember?.();

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Um convite pendente por e-mail: o novo substitui o anterior.
    prisma.workspaceInvitation.deleteMany({ where: { workspaceId, email, acceptedAt: null } }),
    prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        tokenHash: hashInviteToken(token),
        invitedById: actor.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
    }),
  ]);
  return { path: `/convite/${token}`, email };
}

export async function revokeInvitation(workspaceId: string, invitationId: string) {
  await requireWorkspaceRole(workspaceId, MANAGER_ROLES);
  await prisma.workspaceInvitation.deleteMany({ where: { id: invitationId, workspaceId, acceptedAt: null } });
}

/** Convite válido (não usado, não vencido) ou `null`. */
export async function findOpenInvitation(token: string) {
  if (!token || token.length > 200) return null;
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { workspace: { select: { name: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) return null;
  return invitation;
}

const INVALID_INVITE = "Este convite não vale mais. Peça um link novo para quem convidou você.";

/**
 * Aceita o convite. Com sessão, o e-mail da sessão precisa ser o do convite.
 * Sem sessão, cria a pessoa com a senha escolhida (se o e-mail já tiver conta, pede para entrar antes).
 * Devolve o id do usuário para a sessão ser aberta por quem chamou.
 */
export async function acceptInvitation(
  token: string,
  input: { actor: TenantActor | null; name?: string; password?: string },
  assertCanAddMember?: (workspaceId: string) => Promise<void>,
): Promise<{ userId: string; workspaceId: string }> {
  const invitation = await findOpenInvitation(token);
  if (!invitation) throw new UserFacingError(INVALID_INVITE);
  await assertCanAddMember?.(invitation.workspaceId);

  const userId = input.actor
    ? existingActorFor(invitation.email, input.actor)
    : await createInvitedUser(invitation.email, input.name, input.password);

  await prisma.$transaction(async (tx) => {
    // Marca como usado só se ninguém usou antes (dois cliques ao mesmo tempo).
    const claimed = await tx.workspaceInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UserFacingError(INVALID_INVITE);
    await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      create: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
      update: {},
    });
  });
  return { userId, workspaceId: invitation.workspaceId };
}

function existingActorFor(email: string, actor: TenantActor): string {
  if (actor.email.toLowerCase() !== email) {
    throw new AccountAccessError(`Este convite é para ${email}. Saia e entre com esse e-mail para aceitar.`);
  }
  return actor.id;
}

async function createInvitedUser(email: string, rawName?: string, password?: string): Promise<string> {
  const name = rawName?.trim() ?? "";
  if (!name || name.length > 80) throw new UserFacingError("Informe seu nome (até 80 caracteres).");
  const problem = passwordProblem(password ?? "");
  if (problem) throw new UserFacingError(problem);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new UserFacingError("Já existe uma conta com este e-mail. Entre com ela e abra o convite de novo.");
  const user = await prisma.user.create({
    data: { email, name, role: "CLIENT", passwordHash: await hashPassword(password as string) },
  });
  return user.id;
}

async function findManagedMember(workspaceId: string, memberId: string) {
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
  if (!member) throw new UserFacingError("Membro não encontrado.");
  if (member.role === "OWNER") throw new UserFacingError("O dono do workspace não pode ser alterado por aqui.");
  return member;
}

export async function removeMember(workspaceId: string, memberId: string) {
  const { actor } = await requireWorkspaceRole(workspaceId, MANAGER_ROLES);
  const member = await findManagedMember(workspaceId, memberId);
  if (member.userId === actor.id) throw new UserFacingError("Você não pode remover a si mesmo.");
  await prisma.workspaceMember.delete({ where: { id: member.id } });
}

export async function changeMemberRole(workspaceId: string, memberId: string, role: string) {
  await requireWorkspaceRole(workspaceId, MANAGER_ROLES);
  assertAssignable(role);
  const member = await findManagedMember(workspaceId, memberId);
  await prisma.workspaceMember.update({ where: { id: member.id }, data: { role } });
}
