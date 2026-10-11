import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const AUTH = `Basic ${btoa("fluxo:senha-teste")}`;
const request = (path: string, authorization?: string) =>
  new NextRequest(`http://localhost:3007${path}`, {
    headers: authorization ? { authorization } : {},
  });

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_USER", "fluxo");
    vi.stubEnv("SITE_PASSWORD", "senha-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for credentials on private pages", () => {
    const res = proxy(request("/fluxos"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe('Basic realm="Fluxo", charset="UTF-8"');
  });

  it("rejects wrong credentials", () => {
    const res = proxy(request("/", `Basic ${btoa("fluxo:errada")}`));
    expect(res.status).toBe(401);
  });

  it("lets authenticated requests through with a nonce-based CSP", () => {
    const res = proxy(request("/conversas", AUTH));
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  });

  it("allows a client session candidate through to server-side session validation", () => {
    const clientRequest = new NextRequest("http://localhost:3007/conversas", {
      headers: { cookie: "fluxo_session=opaque-client-session" },
    });
    expect(proxy(clientRequest).status).toBe(200);
  });

  it("closes the site in production when SITE_PASSWORD is missing", () => {
    vi.stubEnv("SITE_PASSWORD", "");
    const res = proxy(request("/", AUTH));
    expect(res.status).toBe(503);
  });

  it.each(["/api/webhook/instagram", "/api/l/codigoValido123", "/privacidade", "/api/meta/deauthorize"])(
    "leaves the public route %s open without credentials",
    (path) => {
      expect(proxy(request(path)).status).toBe(200);
    }
  );

  it("protects private API routes too", () => {
    expect(proxy(request("/api/instagram/media")).status).toBe(401);
  });
});
