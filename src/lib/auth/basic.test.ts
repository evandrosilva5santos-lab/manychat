import { describe, expect, it } from "vitest";
import {
  evaluateBasicAuth,
  isPublicPath,
  readBasicAuthConfig,
  safeEqual,
  type BasicAuthConfig,
} from "./basic";

function header(user: string, password: string): string {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

const prodConfig: BasicAuthConfig = { user: "fluxo", password: "s3nh@-forte", isProduction: true };

describe("evaluateBasicAuth", () => {
  it("authorizes correct credentials", () => {
    expect(evaluateBasicAuth(header("fluxo", "s3nh@-forte"), prodConfig)).toBe("authorized");
  });

  it("rejects a missing header", () => {
    expect(evaluateBasicAuth(null, prodConfig)).toBe("unauthorized");
  });

  it("rejects a wrong password", () => {
    expect(evaluateBasicAuth(header("fluxo", "errada"), prodConfig)).toBe("unauthorized");
  });

  it("rejects a wrong user", () => {
    expect(evaluateBasicAuth(header("admin", "s3nh@-forte"), prodConfig)).toBe("unauthorized");
  });

  it("rejects a malformed header without throwing", () => {
    expect(evaluateBasicAuth("Basic !!!não-é-base64", prodConfig)).toBe("unauthorized");
    expect(evaluateBasicAuth("Bearer abc", prodConfig)).toBe("unauthorized");
    expect(evaluateBasicAuth(`Basic ${btoa("sem-dois-pontos")}`, prodConfig)).toBe("unauthorized");
  });

  it("supports passwords containing colons and non-ASCII characters", () => {
    const config = { ...prodConfig, password: "a:b:çã" };
    expect(evaluateBasicAuth(header("fluxo", "a:b:çã"), config)).toBe("authorized");
  });

  it("is misconfigured (site closed) in production without a password", () => {
    const config = { ...prodConfig, password: undefined };
    expect(evaluateBasicAuth(header("fluxo", "qualquer"), config)).toBe("misconfigured");
  });

  it("is open outside production when no password is configured", () => {
    const config = { user: "fluxo", password: undefined, isProduction: false };
    expect(evaluateBasicAuth(null, config)).toBe("open");
  });

  it("still requires credentials outside production when a password is configured", () => {
    const config = { ...prodConfig, isProduction: false };
    expect(evaluateBasicAuth(null, config)).toBe("unauthorized");
  });
});

describe("readBasicAuthConfig", () => {
  it("defaults the user to 'fluxo' and treats an empty password as missing", () => {
    const config = readBasicAuthConfig({ NODE_ENV: "production", SITE_PASSWORD: "" });
    expect(config).toEqual({ user: "fluxo", password: undefined, isProduction: true });
  });

  it("reads SITE_USER and SITE_PASSWORD", () => {
    const config = readBasicAuthConfig({ NODE_ENV: "development", SITE_USER: "dono", SITE_PASSWORD: "x" });
    expect(config).toEqual({ user: "dono", password: "x", isProduction: false });
  });
});

describe("isPublicPath", () => {
  it.each([
    "/api/webhook/instagram",
    "/api/l/abc123",
    "/api/meta/data-deletion",
    "/privacidade",
    "/termos",
    "/exclusao-de-dados",
    "/exclusao-de-dados/status",
    "/api/auth/instagram/callback",
    "/conectar",
  ])("treats %s as public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/fluxos",
    "/conversas",
    "/ajustes",
    "/api/instagram/media",
    "/api/webhookx",
    "/privacidade-falsa",
    "/termosx",
  ])("treats %s as private", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares strings of equal and different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
