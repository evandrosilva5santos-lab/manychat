import { prisma } from "@/lib/prisma";
import type { InstagramAccount } from "@/generated/prisma/client";

/**
 * Conta do Instagram em uso.
 * Resolve pelo IG_USER_ID do ambiente ou pela primeira conta conectada no banco Postgres.
 * Se nenhuma conta existir ainda no banco, cria uma conta inicial com status DISCONNECTED
 * para que o sistema funcione de forma tipada e segura sem dados falsos.
 */
export async function getCurrentAccount(): Promise<InstagramAccount> {
  const envIgUserId = process.env.IG_USER_ID;
  if (envIgUserId) {
    const existing = await prisma.instagramAccount.findUnique({
      where: { igUserId: envIgUserId },
    });
    if (existing) return existing;

    try {
      return await prisma.instagramAccount.upsert({
        where: { igUserId: envIgUserId },
        update: {},
        create: {
          igUserId: envIgUserId,
          username: process.env.IG_USERNAME || "instagram_business",
          name: process.env.IG_NAME || "Instagram Business",
          status: "CONNECTED",
        },
      });
    } catch {
      const retry = await prisma.instagramAccount.findUnique({
        where: { igUserId: envIgUserId },
      });
      if (retry) return retry;
    }
  }

  const existing = await prisma.instagramAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return await prisma.instagramAccount.create({
    data: {
      igUserId: "default_account",
      username: "instagram_business",
      name: "Instagram Business",
      status: "DISCONNECTED",
    },
  });
}
