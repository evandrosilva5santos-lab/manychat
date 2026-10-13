import { afterEach, describe, expect, it, vi } from "vitest";
import { findMatchingTrigger, matchesKeyword } from "./matcher";
import { prisma } from "../prisma";
import { check24hWindow } from "../meta/window";
import { verifyMetaHmacSignature, verifyWebhookChallenge, parseInstagramWebhookPayload } from "../meta/webhook";
import { configSchemas } from "../flow/schema";
import { lintFlow } from "../flow/lint";

vi.mock("../prisma", () => ({
  prisma: {
    flow: { findMany: vi.fn() },
    trigger: { findMany: vi.fn() },
    node: { findFirst: vi.fn() },
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Item 3: contratos independentes do tipo de login", () => {
  it.each([
    ["EUROPA", ["eu"], "CONTAINS", false],
    ["Eu quero!", ["eu"], "CONTAINS", true],
    ["🎉 AÇÃO!!!", ["acao"], "EXACT", true],
    ["a\u200bção\ufe0f", ["acao"], "EXACT", true],
    ["qualquer texto", [], "CONTAINS", false],
    ["", ["🎉"], "EXACT", false],
    ["qualquer texto", [], "ANY", true],
  ] as const)("normaliza %s com %s (%s)", (text, keywords, match, expected) => {
    expect(matchesKeyword(text, [...keywords], match)).toBe(expected);
  });

  it("palavras negativas respeitam limites de palavra", () => {
    expect(matchesKeyword("europa", [], "ANY", ["eu"])).toBe(true);
    expect(matchesKeyword("eu quero", [], "ANY", ["eu"])).toBe(false);
  });

  it("não dispara post específico se o evento não trouxer a mídia", async () => {
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      {
        id: "trigger",
        flowId: "flow",
        type: "COMMENT_KEYWORD",
        keywords: ["quero"],
        match: "EXACT",
        mediaId: "post",
        startNodeId: "start",
        negativeKeywords: [],
        publicReplies: [],
        payload: null,
        flow: { id: "flow" },
      } as never,
    ]);
    const event = { kind: "comment" as const, igUserId: "account", commentId: "comment", userIgsid: "lead", text: "quero", timestamp: Date.now() };
    expect(await findMatchingTrigger("account", event)).toBeNull();
    expect(await findMatchingTrigger("account", { ...event, mediaId: "other" })).toBeNull();
    expect(await findMatchingTrigger("account", { ...event, mediaId: "post" })).toMatchObject({ startNodeId: "start" });
  });

  it("rejeita datas futuras, inválidas e o limite exato de 24h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    for (const date of [null, "invalid", "2026-10-10T12:00:01Z", "2026-10-09T12:00:00Z"]) {
      expect(check24hWindow(date).is24hActive).toBe(false);
    }
    expect(check24hWindow("2026-10-09T12:00:01Z").is24hActive).toBe(true);
  });

  it("exige segredo e assinatura mesmo em desenvolvimento", () => {
    expect(verifyMetaHmacSignature("{}", null, "secret")).toBe(false);
    expect(verifyMetaHmacSignature("{}", "sha256=00", "")).toBe(false);
    expect(verifyWebhookChallenge(new URLSearchParams("hub.mode=subscribe&hub.verify_token=&hub.challenge=1"), "")).toBeNull();
  });

  it("ignora eventos sem remetente e ecos", () => {
    expect(parseInstagramWebhookPayload({ object: "instagram", entry: [{ id: "account", changes: [
      { field: "comments", value: { id: "comment", text: "oi" } },
    ], messaging: [
      { sender: { id: "lead" }, message: { mid: "echo", text: "oi", is_echo: true } },
      { message: { mid: "missing", text: "oi" } },
    ] }] })).toEqual([]);
  });

  it("ignora estruturas inválidas sem lançar exceção", () => {
    for (const body of [null, {}, { object: "instagram", entry: [null] }, { object: "instagram", entry: [{ id: "account", messaging: [null] }] }]) {
      expect(parseInstagramWebhookPayload(body)).toEqual([]);
    }
  });

  it("preserva entradas válidas de um lote com entrada inválida", () => {
    const result = parseInstagramWebhookPayload({ object: "instagram", entry: [null, {
      id: "account", messaging: [{ sender: { id: "lead" }, recipient: { id: "account" }, message: { mid: "message", text: "oi" } }],
    }] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "message", igUserId: "account", userIgsid: "lead", messageId: "message" });
  });

  it("limita DELAY a 23h no schema e no lint", () => {
    expect(configSchemas.DELAY.safeParse({ seconds: 23 * 3600 }).success).toBe(true);
    expect(configSchemas.DELAY.safeParse({ seconds: 23 * 3600 + 1 }).success).toBe(false);
    const problems = lintFlow([{ id: "delay", type: "DELAY", position: { x: 0, y: 0 }, data: { kind: "DELAY", name: null, config: { seconds: 86400 } } }], []);
    expect(problems.some((problem) => problem.nodeId === "delay" && problem.message.includes("23"))).toBe(true);
  });
});
