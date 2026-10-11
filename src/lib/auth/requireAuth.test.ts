import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headerStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerStore.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined }),
}));

import { isRequestAuthorized, requireAuth, UnauthorizedError } from "./requireAuth";

function basic(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

describe("requireAuth", () => {
  beforeEach(() => {
    headerStore.clear();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_USER", "fluxo");
    vi.stubEnv("SITE_PASSWORD", "segredo-de-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves when the request carries valid credentials", async () => {
    headerStore.set("authorization", basic("fluxo", "segredo-de-teste"));
    await expect(requireAuth()).resolves.toBeUndefined();
  });

  it("throws UnauthorizedError without credentials", async () => {
    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError with wrong credentials", async () => {
    headerStore.set("authorization", basic("fluxo", "errada"));
    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws in production when SITE_PASSWORD is missing (site closed)", async () => {
    vi.stubEnv("SITE_PASSWORD", "");
    headerStore.set("authorization", basic("fluxo", "qualquer"));
    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("isRequestAuthorized", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_PASSWORD", "segredo-de-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("checks the Authorization header of a route handler request", () => {
    const ok = new Request("http://localhost/api/x", { headers: { authorization: basic("fluxo", "segredo-de-teste") } });
    const denied = new Request("http://localhost/api/x");
    expect(isRequestAuthorized(ok)).toBe(true);
    expect(isRequestAuthorized(denied)).toBe(false);
  });
});
