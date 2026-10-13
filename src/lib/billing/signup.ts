// Cadastro público com teste grátis (ADR-008). Desligado por padrão: só com PUBLIC_SIGNUP=on.
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { UserFacingError } from "@/lib/user-error";

export function isPublicSignupEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PUBLIC_SIGNUP?.trim().toLowerCase() === "on";
}

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(80, "Nome longo demais."),
  company: z.string().trim().min(1, "Informe o nome da empresa ou do perfil.").max(80, "Nome da empresa longo demais."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  password: z.string(),
  plan: z.string().trim().max(40).optional(),
});

/** Plano escolhido na página de preços, se estiver à venda; senão, o primeiro público com teste grátis. */
async function resolveSignupPlan(slug: string | undefined) {
  const forSale = { isActive: true, isPublic: true };
  if (slug) {
    const chosen = await prisma.plan.findFirst({ where: { ...forSale, slug } });
    if (chosen) return chosen;
  }
  return prisma.plan.findFirst({ where: { ...forSale, trialDays: { gt: 0 } }, orderBy: { sortOrder: "asc" } });
}

/**
 * Cria pessoa, workspace (ela como dona) e, se o plano tiver teste grátis, a assinatura em teste.
 * Sem teste grátis, o workspace nasce sem assinatura: a pessoa assina em /plano antes de operar.
 */
export async function signUp(input: unknown, now = new Date()): Promise<{ userId: string; workspaceId: string; trial: boolean }> {
  if (!isPublicSignupEnabled()) throw new UserFacingError("O cadastro ainda não está aberto. Fale com a gente para começar.");
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { name, company, email, password, plan: slug } = parsed.data;
  const problem = passwordProblem(password);
  if (problem) throw new UserFacingError(problem);

  const plan = await resolveSignupPlan(slug);
  if (!plan) throw new UserFacingError("Nenhum plano está disponível agora. Fale com a gente para começar.");
  const passwordHash = await hashPassword(password);
  const trial = plan.trialDays > 0;

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, role: "CLIENT", passwordHash } });
      const workspace = await tx.workspace.create({
        data: { name: company, ownerId: user.id, kind: "CUSTOMER", members: { create: { userId: user.id, role: "OWNER" } } },
      });
      if (trial) {
        await tx.subscription.create({
          data: {
            workspaceId: workspace.id,
            planId: plan.id,
            status: "TRIALING",
            trialEndsAt: new Date(now.getTime() + plan.trialDays * 86_400_000),
          },
        });
      }
      return { userId: user.id, workspaceId: workspace.id, trial };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserFacingError("Já existe uma conta com este e-mail. Entre com ela.");
    }
    throw error;
  }
}
