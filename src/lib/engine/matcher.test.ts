import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { trigger: { findMany: db.findMany }, flowRun: { findFirst: db.findFirst } } }));
import { findMatchingTrigger, matchesKeyword } from "./matcher";
const event = { kind: "comment" as const, igUserId: "ig-account", commentId: "comment", mediaId: "post", userIgsid: "person", text: "quero", timestamp: 1 };
const trigger = (patch = {}) => ({ id: "trigger", type: "COMMENT_KEYWORD", keywords: ["quero"], negativeKeywords: [], match: "CONTAINS", mediaId: null, startNodeId: "node", cooldownSeconds: 0, priority: 0, publicReplies: [], flow: { id: "flow", nodes: [{ id: "node" }] }, ...patch });
beforeEach(() => { vi.clearAllMocks(); db.findMany.mockResolvedValue([]); db.findFirst.mockResolvedValue(null); });
describe("keywords", () => {
  it.each([
    ["ÉU! 🎉", ["eu"], "EXACT", true],
    ["europa", ["eu"], "CONTAINS", false],
    ["quero, EU!", ["eu"], "CONTAINS", true],
    ["ca\u200bsamento", ["casamento"], "EXACT", true],
    ["oi", [], "CONTAINS", false],
    ["oi", ["🎉"], "CONTAINS", false],
    ["", [], "ANY", true],
  ] as const)("normalizes %s", (text, words, match, expected) => {
    expect(matchesKeyword(text, [...words], match)).toBe(expected);
  });
  it("uses word boundaries for negatives even with ANY", () => {
    expect(matchesKeyword("europa", [], "ANY", ["eu"])).toBe(true);
    expect(matchesKeyword("ÉU!", [], "ANY", ["eu"])).toBe(false);
  });
});
describe("database matcher", () => {
  it("scopes to account and LIVE, orders priority and ties deterministically", async () => {
    db.findMany.mockResolvedValue([trigger({ id: "first" }), trigger({ id: "second" })]);
    expect((await findMatchingTrigger("account", event))?.trigger.id).toBe("first");
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { flow: { accountId: "account", status: "LIVE" } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }] }));
  });
  it("rejects missing or wrong media for specific post", async () => {
    db.findMany.mockResolvedValue([trigger({ mediaId: "post" })]);
    expect(await findMatchingTrigger("account", { ...event, mediaId: undefined })).toBeNull();
    expect(await findMatchingTrigger("account", { ...event, mediaId: "other" })).toBeNull();
    expect(await findMatchingTrigger("account", event)).not.toBeNull();
  });
  it("checks contact and flow cooldown with account isolation", async () => {
    db.findMany.mockResolvedValue([trigger({ cooldownSeconds: 60 })]);
    db.findFirst.mockResolvedValue({ id: "recent" });
    expect(await findMatchingTrigger("account", event)).toBeNull();
    expect(db.findFirst).toHaveBeenCalledWith({ where: { flowId: "flow", flow: { accountId: "account" }, contact: { accountId: "account", igsid: "person" }, startedAt: { gt: expect.any(Date) } }, select: { id: true } });
    db.findFirst.mockResolvedValue(null);
    expect(await findMatchingTrigger("account", event)).not.toBeNull();
  });
  it("propagates database failure without local store fallback", async () => {
    db.findMany.mockRejectedValue(new Error("database unavailable"));
    await expect(findMatchingTrigger("account", event)).rejects.toThrow("database unavailable");
  });
  it("only matches STORY_REPLY for story replies", async () => {
    db.findMany.mockResolvedValue([trigger({ type: "STORY_REPLY" })]);
    const message = { kind: "message" as const, igUserId: "ig-account", messageId: "m", userIgsid: "person", text: "quero", timestamp: 1 };
    expect(await findMatchingTrigger("account", message)).toBeNull();
    expect(await findMatchingTrigger("account", { ...message, isStoryReply: true })).not.toBeNull();
  });
});
