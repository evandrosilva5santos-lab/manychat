import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  trackedLink: { findMany: vi.fn() },
  flowRun: { findMany: vi.fn() },
  node: { findMany: vi.fn() },
  contact: { findMany: vi.fn(), findFirst: vi.fn() },
  flow: { findMany: vi.fn() },
  tag: { upsert: vi.fn() },
  contactTag: { upsert: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { LIKED_TAG_NAME, listNotOpened, markLiked } from "./not-opened";

const NOW = new Date("2026-10-13T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const contactRow = (id: string) => ({
  id,
  username: `user_${id}`,
  name: null,
  profilePicUrl: null,
  messages: [{ text: "black", mediaId: "m1", createdAt: ago(90) }],
});

beforeEach(() => {
  vi.resetAllMocks();
  db.trackedLink.findMany.mockResolvedValue([]);
  db.flowRun.findMany.mockResolvedValue([]);
  db.node.findMany.mockResolvedValue([]);
  db.flow.findMany.mockResolvedValue([{ id: "f1", name: "Black Friday" }]);
});

describe("listNotOpened", () => {
  it("entra quem recebeu o link e nenhum link daquela automação foi clicado", async () => {
    db.trackedLink.findMany.mockResolvedValue([
      { contactId: "a", flowId: "f1", clicks: 0, createdAt: ago(60) },
      { contactId: "a", flowId: "f1", clicks: 0, createdAt: ago(50) }, // lembrete, também sem clique
      { contactId: "b", flowId: "f1", clicks: 0, createdAt: ago(60) },
      { contactId: "b", flowId: "f1", clicks: 2, createdAt: ago(40) }, // abriu pelo lembrete → sai
    ]);
    db.contact.findMany.mockResolvedValue([contactRow("a")]);

    const leads = await listNotOpened("acc", NOW);

    expect(db.contact.findMany.mock.calls[0][0].where.id.in).toEqual(["a"]);
    expect(leads).toEqual([
      expect.objectContaining({ contactId: "a", stage: "link", flowName: "Black Friday", comment: expect.objectContaining({ text: "black", mediaId: "m1" }) }),
    ]);
  });

  it("entra quem parou no portão de seguidor (execução esperando JÁ SEGUI)", async () => {
    db.flowRun.findMany.mockResolvedValue([
      { contactId: "g", flowId: "f1", currentNodeId: "gate", startedAt: ago(30) },
      { contactId: "q", flowId: "f1", currentNodeId: "pergunta", startedAt: ago(30) },
    ]);
    db.node.findMany.mockResolvedValue([{ id: "gate" }]);
    db.contact.findMany.mockResolvedValue([contactRow("g")]);

    const leads = await listNotOpened("acc", NOW);

    expect(db.contact.findMany.mock.calls[0][0].where.id.in).toEqual(["g"]);
    expect(leads[0]).toMatchObject({ contactId: "g", stage: "gate" });
  });

  it("filtra pelo perfil, últimos 7 dias, sem opt-out e sem a etiqueta de curtida feita", async () => {
    db.trackedLink.findMany.mockResolvedValue([{ contactId: "a", flowId: "f1", clicks: 0, createdAt: ago(10) }]);
    db.contact.findMany.mockResolvedValue([]);
    await listNotOpened("acc", NOW);

    const linkWhere = db.trackedLink.findMany.mock.calls[0][0].where;
    expect(linkWhere.accountId).toBe("acc");
    expect(linkWhere.createdAt.gte.getTime()).toBe(NOW.getTime() - 7 * 86_400_000);
    expect(db.flowRun.findMany.mock.calls[0][0].where.flow).toEqual({ accountId: "acc" });
    expect(db.contact.findMany.mock.calls[0][0].where).toMatchObject({
      accountId: "acc",
      optedOut: false,
      tags: { none: { tag: { name: LIKED_TAG_NAME } } },
    });
  });

  it("sem candidatos não consulta contatos", async () => {
    expect(await listNotOpened("acc", NOW)).toEqual([]);
    expect(db.contact.findMany).not.toHaveBeenCalled();
  });
});

describe("markLiked", () => {
  it("aplica a etiqueta Curtida feita (criando se preciso) só em contato do perfil", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "a" });
    db.tag.upsert.mockResolvedValue({ id: "t1" });
    expect(await markLiked("acc", "a")).toBe(true);
    expect(db.contact.findFirst.mock.calls[0][0].where).toEqual({ id: "a", accountId: "acc" });
    expect(db.tag.upsert.mock.calls[0][0].create).toEqual({ accountId: "acc", name: LIKED_TAG_NAME });
    expect(db.contactTag.upsert.mock.calls[0][0].create).toEqual({ contactId: "a", tagId: "t1" });
  });

  it("contato de outro perfil: não marca nada", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    expect(await markLiked("acc", "x")).toBe(false);
    expect(db.tag.upsert).not.toHaveBeenCalled();
  });
});
