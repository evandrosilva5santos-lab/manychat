import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, enqueue, parse, worker } = vi.hoisted(() => ({
  db: { findUnique: vi.fn() },
  enqueue: vi.fn(),
  parse: vi.fn(),
  worker: { processDueEvents: vi.fn(), resumeDueDelays: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { instagramAccount: db } }));
vi.mock("@/lib/queue/store", () => ({ enqueueEvent: enqueue }));
vi.mock("@/lib/queue/worker", () => worker);
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

import { after, NextRequest } from "next/server";
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
    expect(JSON.stringify(warn.mock.calls)).not.toContain("db fora");
  });

  it("falha ao gravar na fila continua devolvendo 500", async () => {
    parse.mockReturnValue([ev("IG_1", "c1")]);
    db.findUnique.mockResolvedValue({ id: "a" });
    enqueue.mockRejectedValue(Object.assign(new Error("INSERT INTO ... texto da consulta"), { code: "P1001" }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request())).status).toBe(500);
    expect(JSON.stringify(error.mock.calls)).not.toContain("INSERT");
    expect(JSON.stringify(error.mock.calls)).toContain("P1001");
  });
});

describe("POST /api/webhook/instagram: trabalho depois da resposta", () => {
  async function runAfter() {
    const task = vi.mocked(after).mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
    expect(task).toBeTypeOf("function");
    await task!();
  }

  it("processa a fila e retoma esperas vencidas", async () => {
    parse.mockReturnValue([ev("IG_1", "c1")]);
    db.findUnique.mockResolvedValue({ id: "a" });
    await POST(request());
    await runAfter();
    expect(worker.processDueEvents).toHaveBeenCalledWith(10);
    expect(worker.resumeDueDelays).toHaveBeenCalledWith(10);
  });

  it("falha na fila não impede a retomada das esperas", async () => {
    parse.mockReturnValue([ev("IG_1", "c1")]);
    db.findUnique.mockResolvedValue({ id: "a" });
    worker.processDueEvents.mockRejectedValue(new Error("fila"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await POST(request());
    await runAfter();
    expect(worker.resumeDueDelays).toHaveBeenCalled();
  });

  it("lote só de duplicados não agenda trabalho", async () => {
    parse.mockReturnValue([ev("IG_1", "c1")]);
    db.findUnique.mockResolvedValue({ id: "a" });
    enqueue.mockResolvedValue({ duplicate: true });
    await POST(request());
    expect(after).not.toHaveBeenCalled();
  });
});
