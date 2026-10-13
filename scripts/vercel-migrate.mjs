// Decide se o build da Vercel aplica as migrations (`prisma migrate deploy`).
// Regra (item 8f): SÓ no deploy de PRODUÇÃO (VERCEL_ENV === "production").
// Preview e development nunca tocam no banco — antes, todo build de preview
// rodava migrate deploy, possivelmente no banco de produção.
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** URL usada pelas migrations (mesma ordem do prisma.config.ts: conexão direta primeiro). */
function migrationUrl(env) {
  return env.DIRECT_URL || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL || "";
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ action: "migrate" | "skip" | "fail", reason: string }}
 */
export function migrationDecision(env) {
  const vercelEnv = env.VERCEL_ENV || "";
  if (vercelEnv !== "production") {
    return {
      action: "skip",
      reason: `VERCEL_ENV=${vercelEnv || "(ausente)"}: migrations só rodam no deploy de produção.`,
    };
  }
  const url = migrationUrl(env);
  if (!url || url.includes("HOST")) {
    return {
      action: "fail",
      reason: "Deploy de produção sem banco configurado (DIRECT_URL/DATABASE_URL ou integração Supabase).",
    };
  }
  return { action: "migrate", reason: "Deploy de produção: aplicando migrations pendentes." };
}

function main() {
  const decision = migrationDecision(process.env);
  console.log(`[vercel-build] ${decision.reason}`);
  if (decision.action === "fail") process.exit(1);
  if (decision.action === "migrate") execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
