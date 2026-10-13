import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ message: { findFirst: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { reactToLastInbound } from "./reaction";

const client = { reactToMessage: vi.fn() };
const params = { accountId: "acc", contactId: "c1", igsid: "lead" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("reação ❤️ à última mensagem do lead", () => {
  it("reage ao mid da última mensagem recebida, só do próprio perfil e das últimas 24 h", async () => {
    db.message.findFirst.mockResolvedValue({ igMessageId: "mid.123" });
    client.reactToMessage.mockResolvedValue({ success: true });
    expect(await reactToLastInbound(client, params)).toBe("reacted");
    expect(client.reactToMessage).toHaveBeenCalledWith("lead", "mid.123", "love");
    const where = db.message.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ accountId: "acc", contactId: "c1", direction: "IN", igMessageId: { not: null } });
    expect(where.createdAt.gte.getTime()).toBeGreaterThan(Date.now() - 24 * 3600_000 - 1000);
  });

  it("sem mensagem dele para reagir: pula sem chamar a Meta", async () => {
    db.message.findFirst.mockResolvedValue(null);
    expect(await reactToLastInbound(client, params)).toBe("skipped");
    expect(client.reactToMessage).not.toHaveBeenCalled();
  });

  it("Meta recusa ou o banco falha: devolve failed e nunca lança", async () => {
    db.message.findFirst.mockResolvedValue({ igMessageId: "mid.1" });
    client.reactToMessage.mockResolvedValue({ success: false, error: "não permitido" });
    expect(await reactToLastInbound(client, params)).toBe("failed");
    db.message.findFirst.mockRejectedValue(new Error("db fora"));
    await expect(reactToLastInbound(client, params)).resolves.toBe("failed");
  });
});
