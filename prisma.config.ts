import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrações usam a conexão direta (sem pooler). Aceita também os nomes
    // criados pela integração Supabase da Vercel (POSTGRES_*).
    url:
      process.env["DIRECT_URL"] ??
      process.env["POSTGRES_URL_NON_POOLING"] ??
      process.env["DATABASE_URL"] ??
      process.env["POSTGRES_URL"],
  },
});
