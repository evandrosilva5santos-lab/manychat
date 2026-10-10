// Setup técnico inicial do banco de dados.
// Nunca deve rodar em produção e não cria fluxos fictícios.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { appDatabaseUrl } from "../src/lib/db-url";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: appDatabaseUrl() }),
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Seed ignorado em ambiente de produção.");
    return;
  }

  const igUserId = process.env.IG_USER_ID;
  if (igUserId) {
    await prisma.instagramAccount.upsert({
      where: { igUserId },
      update: {},
      create: {
        igUserId,
        username: process.env.IG_USERNAME || "instagram_business",
        name: process.env.IG_NAME || "Instagram Business",
        status: "CONNECTED",
      },
    });
    console.log(`Conta técnica provisionada para IG_USER_ID: ${igUserId}`);
  } else {
    console.log("Nenhum IG_USER_ID configurado para provisionamento inicial.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
