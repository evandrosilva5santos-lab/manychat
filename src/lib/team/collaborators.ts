// Colaboradores criados direto pelo dono/admin da conta, com senha inicial (sem depender de e-mail).
// Senha alheia só é definida para quem pertence APENAS a esta conta: ninguém mexe no acesso de outra empresa.
import { z } from "zod";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, requireWorkspaceRole } from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";
import { canAssign, canResetPassword } from "./roles";

export { canAssign, canResetPassword };

export const collaboratorSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da pessoa.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  role: z.enum(["ADMIN", "OPERATOR"], { message: "Papel inválido." }),
  password: z.string(),
});

function audit(actor: { id: string; email: string }, workspaceId: string, action: string, entityId: string, changes: object) {
  return prisma.auditLog.create({
    data: { actorId: actor.id, actorEmail: actor.email, workspaceId, action, entityType: "WorkspaceMember", entityId, changes },
  });
}

export type AddedCollaborator = { email: string; passwordSet: boolean };

/**
 * Adiciona alguém à equipe já com login. Se o e-mail já tem conta com senha, só dá o acesso
 * (a pessoa entra com a senha que já tem).
 */
export async function addCollaborator(workspaceId: string, input: unknown, assertCanAddMember?: () => Promise<void>): Promise<AddedCollaborator> {
  const { actor, role: actorRole } = await requireWorkspaceRole(workspaceId, MANAGER_ROLES);
  const parsed = collaboratorSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const data = parsed.data;
  if (!canAssign(actorRole, data.role)) throw new UserFacingError("Só o dono da conta pode criar administradores.");

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true, role: true, passwordHash: true, memberships: { select: { workspaceId: true } } },
  });
  if (existing?.memberships.some((member) => member.workspaceId === workspaceId)) throw new UserFacingError("Esta pessoa já faz parte da equipe.");
  if (existing?.role === "SUPERADMIN") throw new UserFacingError("Este e-mail não pode ser usado aqui.");
  // Conta nova: recebe a senha. Conta existente sem senha e sem outra empresa: recebe também. Fora isso, mantém a dela.
  const setPassword = !existing || (!existing.passwordHash && existing.memberships.length === 0);
  if (setPassword) {
    const problem = passwordProblem(data.password);
    if (problem) throw new UserFacingError(problem);
  }
  await assertCanAddMember?.();

  const passwordHash = setPassword ? await hashPassword(data.password) : null;
  const member = await prisma.$transaction(async (tx) => {
    const user = existing
      ? passwordHash ? await tx.user.update({ where: { id: existing.id }, data: { passwordHash } }) : { id: existing.id }
      : await tx.user.create({ data: { name: data.name, email: data.email, role: "CLIENT", passwordHash } });
    return tx.workspaceMember.create({ data: { workspaceId, userId: user.id, role: data.role } });
  });
  await audit(actor, workspaceId, "member.add", member.id, { email: data.email, papel: data.role, senhaDefinida: setPassword });
  return { email: data.email, passwordSet: setPassword };
}

/** Dono/admin define uma nova senha para alguém da equipe e repassa para a pessoa. */
export async function resetCollaboratorPassword(workspaceId: string, memberId: string, password: string): Promise<void> {
  const { actor, role: actorRole } = await requireWorkspaceRole(workspaceId, MANAGER_ROLES);
  const problem = passwordProblem(password);
  if (problem) throw new UserFacingError(problem);
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    select: { role: true, userId: true, user: { select: { role: true, email: true, _count: { select: { memberships: true } } } } },
  });
  if (!member) throw new UserFacingError("Pessoa não encontrada na equipe.");
  if (member.userId === actor.id) throw new UserFacingError("Para trocar a sua senha, use Minha conta.");
  if (!canResetPassword(actorRole, member.role)) throw new UserFacingError("Seu papel não permite trocar a senha desta pessoa.");
  if (member.user.role === "SUPERADMIN" || member.user._count.memberships > 1) {
    throw new UserFacingError("Esta pessoa também usa o login em outra conta. Peça para ela trocar a senha em Minha conta.");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: member.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.userSession.deleteMany({ where: { userId: member.userId } }),
  ]);
  await audit(actor, workspaceId, "member.password_reset", memberId, { email: member.user.email });
}

export const ownPasswordSchema = z
  .object({ current: z.string().min(1, "Informe a senha atual."), next: z.string(), confirm: z.string() })
  .refine((data) => data.next === data.confirm, { message: "A confirmação não bate com a nova senha.", path: ["confirm"] })
  .refine((data) => data.next !== data.current, { message: "A nova senha precisa ser diferente da atual.", path: ["next"] });
