import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { calls, p, tx } = vi.hoisted(() => {
  const calls: string[] = [];
  const rec = (name: string, ret: unknown = { count: 0 }) =>
    vi.fn(async (...a: unknown[]) => { calls.push(name); void a; return ret; });
  const tx = {
    instagramAccount: { update: rec("tx.account.update"), deleteMany: rec("tx.account.deleteMany") },
    flowRun: { updateMany: rec("tx.flowRun.updateMany") },
    carouselCard: { deleteMany: rec("tx.carouselCard.deleteMany") },
    flow: { deleteMany: rec("tx.flow.deleteMany") },
    catalogItem: { deleteMany: rec("tx.catalogItem.deleteMany") },
    tag: { deleteMany: rec("tx.tag.deleteMany") },
    trackedLink: { deleteMany: rec("tx.trackedLink.deleteMany") },
    privateReply: { deleteMany: rec("tx.privateReply.deleteMany") },
  };
  const batch = (n: string) => ({ findMany: vi.fn(), deleteMany: rec(`${n}.deleteMany`) });
  const p = {
    instagramAccount: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    dataDeletionRequest: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    message: batch("message"), flowRun: batch("flowRun"), contact: batch("contact"), webhookEvent: batch("webhookEvent"),
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { calls, p, tx };
});
vi.mock("@/lib/prisma", () => ({ prisma: p }));
vi.mock("@/lib/security/token", () => ({
  decryptToken: (t: string) => { if (t === "bad") throw new Error("x"); return `plain(${t})`; },
}));

import { disconnectAccount, findAccountsForCallback, requestAccountDeletion, resumePendingDeletions, runDeletion } from "./account-lifecycle";

const fetchMock = vi.fn();
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  p.instagramAccount.update.mockResolvedValue({});
  p.dataDeletionRequest.update.mockResolvedValue({});
  for (const m of [p.message, p.flowRun, p.contact, p.webhookEvent]) m.findMany.mockResolvedValue([]);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const igAccount = { id: "a1", igUserId: "178", authProvider: "INSTAGRAM_LOGIN", fbPageId: null, accessTokenEnc: "tok" };
const fbAccount = { id: "a2", igUserId: "179", authProvider: "FACEBOOK_LOGIN", fbPageId: "page9", accessTokenEnc: "ptok" };

describe("disconnectAccount", () => {
  it("cancela a assinatura no Instagram antes de limpar o token e falha as execuções ativas", async () => {
    p.instagramAccount.findUnique.mockResolvedValue(igAccount);
    await disconnectAccount("a1", { reason: "USER", notifyMeta: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.instagram.com/v21.0/me/subscribed_apps");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer plain(tok)");
    expect(tx.instagramAccount.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { status: "DISCONNECTED", tokenStatus: "REVOKED", accessTokenEnc: null, tokenExpiresAt: null },
    });
    const runArgs = tx.flowRun.updateMany.mock.calls[0][0] as { where: { status: { in: string[] } }; data: Record<string, unknown> };
    expect(runArgs.where.status.in).toEqual(["RUNNING", "WAITING_REPLY", "WAITING_DELAY", "WAITING_CLICK"]);
    expect(runArgs.data).toMatchObject({ status: "FAILED", error: "Perfil descarregado" });
    expect(runArgs.data.finishedAt).toBeInstanceOf(Date);
  });

  it("usa a Página no Facebook Login", async () => {
    p.instagramAccount.findUnique.mockResolvedValue(fbAccount);
    await disconnectAccount("a2", { reason: "USER", notifyMeta: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/page9/subscribed_apps");
    expect(String(url)).not.toContain("?");
    expect(String(url)).not.toContain("access_token");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer plain(ptok)");
  });

  it("não chama a Meta com notifyMeta false, mas limpa a conta", async () => {
    p.instagramAccount.findUnique.mockResolvedValue(igAccount);
    await disconnectAccount("a1", { reason: "META_DEAUTHORIZE", notifyMeta: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tx.instagramAccount.update).toHaveBeenCalled();
  });

  it("sobrevive à falha da Meta e à falha de decifrar, sem vazar o token no log", async () => {
    p.instagramAccount.findUnique.mockResolvedValue(igAccount);
    fetchMock.mockRejectedValue(new Error("rede"));
    await disconnectAccount("a1", { reason: "USER", notifyMeta: true });
    expect(tx.instagramAccount.update).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("tok");

    fetchMock.mockClear();
    p.instagramAccount.findUnique.mockResolvedValue({ ...igAccount, accessTokenEnc: "bad" });
    await disconnectAccount("a1", { reason: "USER", notifyMeta: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("conta inexistente é no-op e já desconectada (sem token) segue sem chamar a Meta", async () => {
    p.instagramAccount.findUnique.mockResolvedValue(null);
    await expect(disconnectAccount("x", { reason: "USER", notifyMeta: true })).resolves.toBeUndefined();
    expect(p.$transaction).not.toHaveBeenCalled();

    p.instagramAccount.findUnique.mockResolvedValue({ ...igAccount, accessTokenEnc: null });
    await disconnectAccount("a1", { reason: "USER", notifyMeta: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tx.instagramAccount.update).toHaveBeenCalled();
  });
});

describe("runDeletion", () => {
  const request = (over = {}) => ({
    id: "r1", status: "PENDING", scope: "BUSINESS", accountIds: ["a1"], attempts: 0, ...over,
  });

  it("escopo BUSINESS apaga lotes e cards do carrossel antes do catálogo, e a conta por último", async () => {
    p.dataDeletionRequest.findUnique.mockResolvedValue(request());
    p.instagramAccount.findUnique.mockResolvedValue({ id: "a1", igUserId: "178" });
    p.message.findMany.mockResolvedValueOnce([{ id: "m1" }]).mockResolvedValue([]);

    const status = await runDeletion("r1");

    expect(status).toBe("COMPLETED");
    expect(p.message.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["m1"] } } });
    expect(p.flowRun.findMany.mock.calls[0][0].where).toEqual({ flow: { accountId: "a1" } });
    expect(p.webhookEvent.findMany.mock.calls[1][0].where).toEqual({
      accountId: null, idempotencyKey: { startsWith: "ig:178:" },
    });
    expect(calls.indexOf("tx.carouselCard.deleteMany")).toBeLessThan(calls.indexOf("tx.catalogItem.deleteMany"));
    expect(calls.slice(-7)).toEqual([
      "tx.carouselCard.deleteMany", "tx.flow.deleteMany", "tx.catalogItem.deleteMany", "tx.tag.deleteMany",
      "tx.trackedLink.deleteMany", "tx.privateReply.deleteMany", "tx.account.deleteMany",
    ]);
    expect((p.$transaction.mock.calls.at(-1) as unknown[] | undefined)?.[1]).toEqual({ timeout: 15_000 });
    expect(p.dataDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ status: "COMPLETED", accountsAffected: 1, completedAt: expect.any(Date) }),
    });
  });

  it("escopo PERSON desconecta, zera metaUserId e mantém dados do negócio", async () => {
    p.dataDeletionRequest.findUnique.mockResolvedValue(request({ scope: "PERSON" }));
    p.instagramAccount.findUnique.mockResolvedValue({ ...igAccount, igUserId: "178" });

    expect(await runDeletion("r1")).toBe("COMPLETED");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tx.instagramAccount.update).toHaveBeenCalled();
    expect(p.instagramAccount.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { metaUserId: null } });
    expect(p.message.deleteMany).not.toHaveBeenCalled();
    expect(tx.flow.deleteMany).not.toHaveBeenCalled();
  });

  it("conta já apagada conta zero afetadas", async () => {
    p.dataDeletionRequest.findUnique.mockResolvedValue(request());
    p.instagramAccount.findUnique.mockResolvedValue(null);
    expect(await runDeletion("r1")).toBe("COMPLETED");
    expect(p.dataDeletionRequest.update.mock.calls[0][0].data.accountsAffected).toBe(0);
  });

  it("orçamento esgotado mantém PENDING sem somar tentativa", async () => {
    p.dataDeletionRequest.findUnique.mockResolvedValue(request());
    p.instagramAccount.findUnique.mockResolvedValue({ id: "a1", igUserId: "178" });
    expect(await runDeletion("r1", { budgetMs: 0 })).toBe("PENDING");
    expect(p.dataDeletionRequest.update).not.toHaveBeenCalled();
    expect(tx.instagramAccount.deleteMany).not.toHaveBeenCalled();
  });

  it("META_CALLBACK pula conta reconectada depois do pedido e apaga a antiga", async () => {
    const createdAt = new Date("2026-10-12T12:00:00Z");
    p.dataDeletionRequest.findUnique.mockResolvedValue(
      request({ source: "META_CALLBACK", createdAt, accountIds: ["new", "old"] }),
    );
    p.instagramAccount.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "new"
        ? { id: "new", igUserId: "1", connectedAt: new Date("2026-10-12T12:00:01Z") }
        : { id: "old", igUserId: "2", connectedAt: new Date("2026-10-01T00:00:00Z") },
    );
    expect(await runDeletion("r1")).toBe("COMPLETED");
    expect(tx.instagramAccount.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.instagramAccount.deleteMany).toHaveBeenCalledWith({ where: { id: "old" } });
    expect(p.dataDeletionRequest.update.mock.calls[0][0].data.accountsAffected).toBe(1);
  });

  it("pedido APP não pula conta por connectedAt", async () => {
    p.dataDeletionRequest.findUnique.mockResolvedValue(
      request({ source: "APP", createdAt: new Date("2026-10-12T12:00:00Z") }),
    );
    p.instagramAccount.findUnique.mockResolvedValue({
      id: "a1", igUserId: "178", connectedAt: new Date("2026-10-13T00:00:00Z"),
    });
    expect(await runDeletion("r1")).toBe("COMPLETED");
    expect(tx.instagramAccount.deleteMany).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("erro soma tentativa e vira FAILED só na quinta", async () => {
    p.instagramAccount.findUnique.mockResolvedValue({ id: "a1", igUserId: "178" });
    p.message.findMany.mockRejectedValue(Object.assign(new Error("dados pessoais aqui"), { code: "P2024" }));

    p.dataDeletionRequest.findUnique.mockResolvedValue(request({ attempts: 1 }));
    expect(await runDeletion("r1")).toBe("PENDING");
    expect(p.dataDeletionRequest.update).toHaveBeenLastCalledWith({
      where: { id: "r1" }, data: { attempts: { increment: 1 }, lastError: "P2024", status: "PENDING" },
    });

    p.dataDeletionRequest.findUnique.mockResolvedValue(request({ attempts: 4 }));
    expect(await runDeletion("r1")).toBe("FAILED");
  });

  it("pedido já concluído não roda de novo", async () => {
    p.dataDeletionRequest.findUnique.mockResolvedValue(request({ status: "COMPLETED" }));
    expect(await runDeletion("r1")).toBe("COMPLETED");
    expect(p.instagramAccount.findUnique).not.toHaveBeenCalled();
  });
});

describe("requestAccountDeletion", () => {
  it("desconecta, cria o pedido APP/BUSINESS e roda a exclusão", async () => {
    p.instagramAccount.findUnique
      .mockResolvedValueOnce({ authProvider: "INSTAGRAM_LOGIN" })
      .mockResolvedValueOnce(igAccount)
      .mockResolvedValue(null);
    p.dataDeletionRequest.create.mockImplementation(async ({ data }) => ({ id: "r9", ...data }));
    p.dataDeletionRequest.findUnique.mockResolvedValue({ id: "r9", status: "PENDING", scope: "BUSINESS", accountIds: ["a1"], attempts: 0 });

    const out = await requestAccountDeletion("a1", { actorId: "u1" });

    expect(out.status).toBe("COMPLETED");
    expect(out.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const data = p.dataDeletionRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ source: "APP", scope: "BUSINESS", provider: "INSTAGRAM_LOGIN", accountIds: ["a1"], code: out.code });
    expect(data.requestKey).toMatch(/^app:a1:\d+$/);
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("resumePendingDeletions", () => {
  it("retoma pedidos parados do mais antigo para o mais novo", async () => {
    p.dataDeletionRequest.findMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
    p.dataDeletionRequest.findUnique.mockResolvedValue({ id: "x", status: "COMPLETED" });
    expect(await resumePendingDeletions()).toEqual({ resumed: 2 });
    const args = p.dataDeletionRequest.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.where.status).toBe("PENDING");
  });
});

describe("findAccountsForCallback", () => {
  const issuedAt = new Date("2026-10-12T12:00:00Z");

  it("filtra por provedor e ignora contas conectadas depois do pedido", async () => {
    p.instagramAccount.findMany.mockResolvedValue([
      { id: "old", connectedAt: new Date("2026-10-01T00:00:00Z") },
      { id: "legacy", connectedAt: null },
      { id: "new", connectedAt: new Date("2026-10-12T12:00:01Z") },
    ]);
    const ids = await findAccountsForCallback({ provider: "INSTAGRAM_LOGIN", userId: "55", issuedAt });
    expect(ids).toEqual(["old", "legacy"]);
    expect(p.instagramAccount.findMany.mock.calls[0][0].where).toEqual({
      authProvider: "INSTAGRAM_LOGIN", OR: [{ metaUserId: "55" }, { igUserId: "55" }],
    });
  });

  it("Facebook casa só por metaUserId e mais de 20 contas retorna null", async () => {
    p.instagramAccount.findMany.mockResolvedValue(Array.from({ length: 21 }, (_, i) => ({ id: `a${i}`, connectedAt: null })));
    expect(await findAccountsForCallback({ provider: "FACEBOOK_LOGIN", userId: "55", issuedAt })).toBeNull();
    expect(p.instagramAccount.findMany.mock.calls[0][0].where).toEqual({ authProvider: "FACEBOOK_LOGIN", metaUserId: "55" });
  });
});
