import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { appDatabaseUrl } from "@/lib/db-url";

// Uma única conexão reaproveitada — no modo dev o Next recarrega os
// arquivos e, sem isso, abriria uma conexão nova a cada mudança.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Pool enxuto: em serverless cada instância abre o próprio pool —
  // max pequeno evita esgotar as conexões do PgBouncer (porta 6543).
  const adapter = new PrismaPg({ connectionString: appDatabaseUrl(), max: 5 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
