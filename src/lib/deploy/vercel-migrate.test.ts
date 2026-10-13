import { describe, expect, it } from "vitest";
import { migrationDecision } from "../../../scripts/vercel-migrate.mjs";

const DB = { DIRECT_URL: "postgresql://u:p@db.supabase.co:5432/postgres" };

describe("vercel-build migration policy (item 8f)", () => {
  it("migrates only on production deploys", () => {
    expect(migrationDecision({ VERCEL_ENV: "production", ...DB }).action).toBe("migrate");
  });

  it.each(["preview", "development", "", undefined])("never touches the database when VERCEL_ENV=%s", (env) => {
    expect(migrationDecision({ VERCEL_ENV: env, ...DB }).action).toBe("skip");
  });

  it("fails a production build without a real database URL instead of silently skipping", () => {
    expect(migrationDecision({ VERCEL_ENV: "production" }).action).toBe("fail");
    expect(migrationDecision({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://USUARIO:SENHA@HOST:6543/postgres" }).action).toBe("fail");
  });

  it("accepts the variable names created by the Vercel × Supabase integration", () => {
    expect(migrationDecision({ VERCEL_ENV: "production", POSTGRES_URL_NON_POOLING: "postgresql://x" }).action).toBe("migrate");
  });
});
