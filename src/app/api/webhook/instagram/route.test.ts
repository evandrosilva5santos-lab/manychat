import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, enqueue, parse } = vi.hoisted(() => ({
  db: { findUnique: vi.fn() },
  enqueue: vi.fn(),
  parse: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { instagramAccount: db } }));
vi.mock("@/lib/queue/store", () => ({ enqueueEvent: enqueue }));
vi.mock("@/lib/queue/worker", () => ({ processDueEvents: vi.fn() }));
vi.mock("@/lib/meta/webhook", () => ({
  allowUnsignedWebhooks: () => true,
  parseInstagramWebhookPayload: parse,
  readWebhookSecrets: () => [],
  verifyWebhookChallenge: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const ev = (igUserId: string, commentId: string) => ({ kind: "comment", igUserId, commentId });
const request = () => new NextRequest("http://localhost/api/webhook/instagram", { method: "POST", body: "{}" });

beforeEach(() => {
  vi.resetAllMocks();
  enqueue.mockResolvedValue({ event: {} });
});

describe("POST /api/webhook/instagram: accountId no enqueue", () => {
  it("resolve o accountId e consulta uma vez por igUserId distinto do lote", async () => {
    parse.mockReturnValue([ev("IG_1", "c1"), ev("IG_1", "c2"), ev("IG_2", "c3")]);
    db.findUnique.mockImplementation(async ({ where }) => ({ id: `acc_${where.igUserId}` }));
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(db.findUnique).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls.map((c) => c[0].accountId)).toEqual(["acc_IG_1", "acc_IG_1", "acc_IG_2"]);
  });

  it("perfil desconhecido enfileira com accountId null", async () => {
    parse.mockReturnValue([ev("IG_X", "c1")]);
    db.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(200);
    expect(enqueue.mock.calls[0][0].accountId).toBeNull();
  });

  it("falha na consulta NÃO derruba o webhook: 200, accountId null e aviso", async () => {
    parse.mockReturnValue([ev("IG_1", "c1")]);
    db.findUnique.mockRejectedValue(new Error("db fora"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(enqueue.mock.calls[0][0].accountId).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("falha ao gravar na fila continua devolvendo 500", async () => {
    parse.mockReturnValue([ev("IG_1", "c1")]);
    db.findUnique.mockResolvedValue({ id: "a" });
    enqueue.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request())).status).toBe(500);
  });
});
