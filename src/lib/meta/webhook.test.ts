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

import { parseInstagramWebhookPayload } from "./webhook";

describe("Instagram event normalization", () => {
  const comment = { field: "comments", value: { id: "comment", from: { id: "lead" }, text: "guia", media: { id: "media" }, created_time: 1700000000 } };
  const dm = { sender: { id: "lead" }, recipient: { id: "account" }, timestamp: 1700000000123, message: { mid: "message", text: "guia" } };
  const wrap = (entry: object) => ({ object: "instagram", entry: [{ id: "account", time: 1700000000, ...entry }] });
  it("preserves comment account, actor, media and normalizes seconds to milliseconds", () => {
    expect(parseInstagramWebhookPayload(wrap({ changes: [comment] }))).toEqual([expect.objectContaining({ kind: "comment", igUserId: "account", commentId: "comment", userIgsid: "lead", mediaId: "media", timestamp: 1700000000000 })]);
  });
  it("preserves DM millisecond timestamps and identifies story replies", () => {
    const events = parseInstagramWebhookPayload(wrap({ messaging: [dm, { ...dm, message: { ...dm.message, reply_to: { story: { id: "story" } } } }] }));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "message", timestamp: 1700000000123 });
    expect(events[1]).toMatchObject({ kind: "message", isStoryReply: true });
  });
  it("normalizes postbacks including their Meta delivery id", () => {
    expect(parseInstagramWebhookPayload(wrap({ messaging: [{ ...dm, message: undefined, postback: { mid: "postback-id", title: "abrir", payload: "fluxo:abc" } }] }))[0]).toMatchObject({ kind: "postback", messageId: "postback-id", payload: "fluxo:abc" });
  });
  it("ignores malformed actors, own comments and threaded comments", () => {
    expect(parseInstagramWebhookPayload(wrap({ changes: [
      { ...comment, value: { ...comment.value, from: {} } },
      { ...comment, value: { ...comment.value, from: { id: "account" } } },
      { ...comment, value: { ...comment.value, parent_id: "parent" } },
    ] }))).toEqual([]);
  });
  it("ignores message echoes, self messages and foreign recipients", () => {
    expect(parseInstagramWebhookPayload(wrap({ messaging: [
      { ...dm, message: { ...dm.message, is_echo: true } },
      { ...dm, sender: { id: "account" } },
      { ...dm, recipient: { id: "foreign" } },
    ] }))).toEqual([]);
  });
  it("never substitutes the delivery time for a missing event timestamp", () => {
    const payload = { object: "instagram", entry: [{ id: "account", messaging: [{ ...dm, timestamp: undefined }] }] };
    expect(parseInstagramWebhookPayload(payload)[0].timestamp).toBe(0);
  });
  it("ignores malformed envelopes and unsupported events", () => {
    expect(parseInstagramWebhookPayload(null)).toEqual([]);
    expect(parseInstagramWebhookPayload(wrap({ messaging: [{ sender: { id: "lead" }, read: { mid: "read" } }], changes: [{ field: "likes" }] }))).toEqual([]);
  });
});
