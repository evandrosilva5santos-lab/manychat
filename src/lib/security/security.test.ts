import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateNonce } from "./csp";
import { generateLinkCode, isSafeHttpsUrl, isValidLinkCode } from "@/lib/links/tracked";
import { httpsUrlSchema, idSchema } from "@/lib/validation";

describe("buildContentSecurityPolicy", () => {
  it("locks scripts to the per-request nonce in production", () => {
    const csp = buildContentSecurityPolicy("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval and websockets only in development (React/Turbopack HMR)", () => {
    const csp = buildContentSecurityPolicy("abc123", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("libera só a origem https do Storage para o upload do Autoposter", () => {
    expect(buildContentSecurityPolicy("n", false, "https://abc.supabase.co")).toContain("connect-src 'self' https://abc.supabase.co");
    expect(buildContentSecurityPolicy("n", false, "javascript:alert(1)")).toContain("connect-src 'self';");
    expect(buildContentSecurityPolicy("n", false)).toContain("media-src 'self' blob: https:");
  });

  it("generates a different nonce per call", () => {
    expect(generateNonce()).not.toBe(generateNonce());
    expect(generateNonce()).toMatch(/^[A-Za-z0-9+/=]{16,}$/);
  });
});

describe("tracked link helpers", () => {
  it("generates url-safe codes that pass validation", () => {
    const code = generateLinkCode();
    expect(isValidLinkCode(code)).toBe(true);
    expect(generateLinkCode()).not.toBe(code);
  });

  it.each(["", "abc", "../etc/passwd", "a b c d e f g h", "x".repeat(65)])("rejects the invalid code %j", (code) => {
    expect(isValidLinkCode(code)).toBe(false);
  });

  it.each(["https://wa.me/5551999999999", "https://www.instagram.com/p/abc/"])("accepts the https url %s", (url) => {
    expect(isSafeHttpsUrl(url)).toBe(true);
  });

  it.each([
    "http://exemplo.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://usuario:senha@exemplo.com",
    "//exemplo.com",
    "não é url",
    "",
  ])("rejects the unsafe url %j", (url) => {
    expect(isSafeHttpsUrl(url)).toBe(false);
  });
});

describe("validation schemas", () => {
  it("httpsUrlSchema accepts https and rejects other schemes with a pt-BR message", () => {
    expect(httpsUrlSchema.safeParse("https://wa.me/55").success).toBe(true);
    const result = httpsUrlSchema.safeParse("javascript:alert(1)");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/https:\/\//);
  });

  it("idSchema rejects empty and oversized ids", () => {
    expect(idSchema.safeParse("cuid123").success).toBe(true);
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("x".repeat(200)).success).toBe(false);
  });
});
