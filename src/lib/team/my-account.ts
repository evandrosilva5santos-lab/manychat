// "Minha conta": a própria pessoa troca nome e senha.
import { z } from "zod";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { hashSessionToken, requireActor } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/user-error";
import { ownPasswordSchema } from "./collaborators";

export async function getMyAccount() {
  const actor = await requireActor();
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      id: true, name: true, email: true, role: true, passwordHash: true,
      memberships: { select: { role: true, workspace: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!user) throw new UserFacingError("Conta não encontrada.");
  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

const nameSchema = z.string().trim().min(2, "O nome precisa ter pelo menos 2 letras.").max(80);

export async function updateMyName(name: string): Promise<void> {
  const actor = await requireActor();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Nome inválido.");
  await prisma.user.update({ where: { id: actor.id }, data: { name: parsed.data } });
}

/**
 * Troca a própria senha. Exige a senha atual (quando existe) e encerra as outras sessões,
 * mantendo a deste navegador.
 */
export async function changeMyPassword(input: unknown, currentSessionToken: string | undefined): Promise<void> {
  const actor = await requireActor();
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  const parsed = ownPasswordSchema.safeParse(user?.passwordHash ? input : { ...(input as object), current: "-" });
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const problem = passwordProblem(parsed.data.next);
  if (problem) throw new UserFacingError(problem);
  if (user?.passwordHash && !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    throw new UserFacingError("A senha atual está incorreta.");
  }
  const keep = currentSessionToken ? hashSessionToken(currentSessionToken) : null;
  await prisma.$transaction([
    prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(parsed.data.next) } }),
    prisma.userSession.deleteMany({ where: { userId: actor.id, ...(keep ? { tokenHash: { not: keep } } : {}) } }),
  ]);
}

