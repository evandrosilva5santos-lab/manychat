import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  contact: { findFirst: vi.fn(), deleteMany: vi.fn() },
  webhookEvent: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { deleteContactData, exportContactData } from "./contact-data";

const CREATED = new Date("2026-10-01T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("exportContactData", () => {
  it("busca só dentro da conta informada e devolve null quando o contato não é dela", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    expect(await exportContactData("acc_1", "c_outro")).toBeNull();
    expect(db.contact.findFirst.mock.calls[0][0].where).toEqual({ id: "c_outro", accountId: "acc_1" });
  });

  it("monta o JSON legível com contato, etiquetas, mensagens, execuções e links", async () => {
    db.contact.findFirst.mockResolvedValue({
      igsid: "igsid_1",
      username: "ana",
      name: "Ana",
      profilePicUrl: null,
      followsAccount: true,
      optedOut: true,
      optedOutAt: CREATED,
      lastInboundAt: CREATED,
      lastInteractionAt: null,
      createdAt: CREATED,
      sourceFlow: { name: "Guia casamento" },
      tags: [{ tag: { name: "lead-quente" } }],
      messages: [{ direction: "IN", kind: "TEXT", text: "quero", payload: null, mediaId: null, error: null, createdAt: CREATED }],
      runs: [{ status: "DONE", startedAt: CREATED, finishedAt: null, flow: { name: "Guia casamento" } }],
      trackedLinks: [{ url: "https://exemplo.com", clicks: 2, firstClickedAt: CREATED, lastClickedAt: null }],
    });

    const data = await exportContactData("acc_1", "c_1");

    expect(data).toMatchObject({
      formato: "instachat-titular/v1",
      contato: { igsid: "igsid_1", username: "ana", optedOut: true, optedOutEm: CREATED.toISOString(), entrouPorFluxo: "Guia casamento" },
      etiquetas: ["lead-quente"],
      mensagens: [{ direcao: "IN", tipo: "TEXT", texto: "quero", em: CREATED.toISOString() }],
      execucoesDeFluxo: [{ fluxo: "Guia casamento", status: "DONE", fim: null }],
      linksRastreados: [{ url: "https://exemplo.com", cliques: 2, ultimoClique: null }],
    });
  });
});

describe("deleteContactData", () => {
  it("contato de outra conta: não apaga nada", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    expect(await deleteContactData("acc_1", "c_outro")).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("apaga eventos do webhook com o IGSID e o contato, sempre filtrando pela conta", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c_1", igsid: "igsid_1" });
    expect(await deleteContactData("acc_1", "c_1")).toBe(true);
    expect(db.webhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { accountId: "acc_1", payload: { path: ["userIgsid"], equals: "igsid_1" } },
    });
    expect(db.contact.deleteMany).toHaveBeenCalledWith({ where: { id: "c_1", accountId: "acc_1" } });
  });

  it("a auditoria no log nunca leva o IGSID em claro", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c_1", igsid: "igsid_secreto" });
    await deleteContactData("acc_1", "c_1");
    const logged = vi.mocked(console.info).mock.calls.flat().join(" ");
    expect(logged).toContain("acc_1");
    expect(logged).not.toContain("igsid_secreto");
  });
});
