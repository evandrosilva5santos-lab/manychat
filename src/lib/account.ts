import { prisma } from "@/lib/prisma";

/**
 * Conta do Instagram em uso.
 * Por enquanto há uma conta só e nenhum login: pega a primeira que existir
 * ou cria uma provisória. Na Etapa 6 (login) e na Etapa 7 (Meta) isso muda.
 */
export async function getCurrentAccount() {
  const existing = await prisma.instagramAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.instagramAccount.upsert({
    where: { igUserId: "pending" },
    update: {},
    create: { igUserId: "pending", username: "minha-conta", name: "Minha conta" },
  });
}
