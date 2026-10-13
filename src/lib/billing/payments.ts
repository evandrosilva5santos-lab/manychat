// Pagamentos recebidos e acesso dos clientes, operados pelo Super Admin (ADR-009).
// Toda alteração grava o AuditLog na mesma transação.
import { z } from "zod";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/tenancy";
import { UserFacingError } from "@/lib/user-error";
import { BILLING_CYCLES, coveredPeriod, PAYMENT_METHODS } from "./billing-cycle";

export const manualPaymentSchema = z.object({
  amountCents: z.number().int().min(1, "Informe o valor recebido.").max(1_000_000_000),
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.coerce.date(),
  cycle: z.enum(BILLING_CYCLES),
  reference: z.string().trim().max(120).nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
});
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

/**
 * Registra um pagamento recebido fora do Stripe (Pix, boleto, transferência…).
 * A assinatura fica ativa até o fim do período pago; pagar adiantado soma ao período atual.
 */
export async function recordManualPayment(workspaceId: string, input: unknown, now = new Date()) {
  const actor = await requireSuperAdmin();
  const data = parse(manualPaymentSchema, input);
  if (data.paidAt.getTime() > now.getTime() + 86_400_000) throw new UserFacingError("A data do pagamento não pode estar no futuro.");
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!subscription) throw new UserFacingError("Defina o plano do cliente antes de registrar um pagamento.");

  const period = coveredPeriod(data.cycle, data.paidAt, subscription.currentPeriodEnd);
  // Quem paga por fora do Stripe passa a ser cobrança manual (a não ser que já tenha assinatura no Stripe).
  const billingMode = subscription.billingMode === "STRIPE" && !subscription.stripeSubscriptionId ? "MANUAL" : subscription.billingMode;
  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id, workspaceId, amountCents: data.amountCents, method: data.method, paidAt: data.paidAt,
        periodStart: period.start, periodEnd: period.end, reference: data.reference, notes: data.notes,
        source: "manual", recordedById: actor.id,
      },
    });
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE", currentPeriodEnd: period.end, graceEndsAt: null, billingCycle: data.cycle, billingMode },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, workspaceId, action: "payment.record", entityType: "SubscriptionPayment",
        entityId: payment.id,
        changes: { valor: data.amountCents, metodo: data.method, pagoEm: data.paidAt, ate: period.end, referencia: data.reference },
      },
    });
    return payment;
  });
}

/** Pagamentos de um cliente, mais recentes primeiro. */
export async function listWorkspacePayments(workspaceId: string, take = 24) {
  return prisma.subscriptionPayment.findMany({ where: { workspaceId }, orderBy: { paidAt: "desc" }, take });
}

/** Super Admin define uma nova senha para um membro do cliente (sem e-mail, ele repassa a senha). */
export async function resetMemberPassword(workspaceId: string, userId: string, password: string) {
  const actor = await requireSuperAdmin();
  const problem = passwordProblem(password);
  if (problem) throw new UserFacingError(problem);
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { user: { select: { email: true, role: true } } },
  });
  if (!member) throw new UserFacingError("Esta pessoa não faz parte deste cliente.");
  if (member.user.role === "SUPERADMIN") throw new UserFacingError("A senha do Super Admin não é trocada por aqui.");
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Sessões abertas com a senha antiga deixam de valer.
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, workspaceId, action: "user.password_reset", entityType: "User",
        entityId: userId, changes: { email: member.user.email },
      },
    }),
  ]);
}
