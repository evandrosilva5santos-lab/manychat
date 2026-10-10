import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  allowUnsignedWebhooks,
  readWebhookSecrets,
  verifyMetaHmacSignature,
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "./webhook";

function sign(body: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

const body = JSON.stringify({ object: "instagram", entry: [] });

describe("verifyMetaHmacSignature (fail closed)", () => {
  it("rejects when the signature header is missing", () => {
    expect(verifyMetaHmacSignature(body, null, "segredo")).toBe(false);
  });

  it("rejects when the app secret is missing", () => {
    expect(verifyMetaHmacSignature(body, sign(body, "segredo"), "")).toBe(false);
  });

  it("rejects a non sha256 prefix and a wrong-length signature without throwing", () => {
    expect(verifyMetaHmacSignature(body, "sha1=abc", "segredo")).toBe(false);
    expect(verifyMetaHmacSignature(body, "sha256=abcd", "segredo")).toBe(false);
    expect(verifyMetaHmacSignature(body, "sha256=zz", "segredo")).toBe(false);
  });

  it("accepts a valid signature", () => {
    expect(verifyMetaHmacSignature(body, sign(body, "segredo"), "segredo")).toBe(true);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a signature made with any configured secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "ig-secret"), ["meta-secret", "ig-secret"])).toBe(true);
  });

  it("rejects when no secret matches or none is configured", () => {
    expect(verifyWebhookSignature(body, sign(body, "outro"), ["meta-secret", "ig-secret"])).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, "ig-secret"), [])).toBe(false);
  });
});

describe("readWebhookSecrets", () => {
  it("prefers the Instagram app secret and drops empty or duplicated values", () => {
    expect(readWebhookSecrets({ IG_APP_SECRET: "ig", META_APP_SECRET: "meta" })).toEqual(["ig", "meta"]);
    expect(readWebhookSecrets({ IG_APP_SECRET: "same", META_APP_SECRET: "same" })).toEqual(["same"]);
    expect(readWebhookSecrets({ IG_APP_SECRET: "", META_APP_SECRET: undefined })).toEqual([]);
  });
});

describe("allowUnsignedWebhooks", () => {
  it("only allows unsigned webhooks with the explicit flag outside production", () => {
    expect(allowUnsignedWebhooks({ ALLOW_UNSIGNED_WEBHOOKS: "1", NODE_ENV: "development" })).toBe(true);
    expect(allowUnsignedWebhooks({ ALLOW_UNSIGNED_WEBHOOKS: "1", NODE_ENV: "production" })).toBe(false);
    expect(allowUnsignedWebhooks({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("verifyWebhookChallenge", () => {
  const params = (token: string) =>
    new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "42" });

  it("returns the challenge for the right token", () => {
    expect(verifyWebhookChallenge(params("token-certo"), "token-certo")).toBe("42");
  });

  it("returns null for a wrong token or when no token is configured", () => {
    expect(verifyWebhookChallenge(params("errado"), "token-certo")).toBeNull();
    expect(verifyWebhookChallenge(params(""), "")).toBeNull();
  });
});
