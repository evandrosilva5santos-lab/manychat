import { prisma } from "@/lib/prisma";

const DEMO_ACCOUNT = {
  id: "demo-account",
  igUserId: "pending",
  username: "movingfestival",
  name: "Moving Festival",
  profilePicUrl: null,
  status: "CONNECTED" as const,
  accessTokenEnc: null,
  tokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Conta do Instagram em uso.
 * Pega a primeira que existir ou cria uma provisória.
 * Se o banco ainda não estiver acessível, retorna a conta demo de fallback.
 */
export async function getCurrentAccount() {
  try {
    const existing = await prisma.instagramAccount.findFirst({ orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    return await prisma.instagramAccount.upsert({
      where: { igUserId: "pending" },
      update: {},
      create: { igUserId: "pending", username: "movingfestival", name: "Moving Festival" },
    });
  } catch (error) {
    return DEMO_ACCOUNT;
  }
}
