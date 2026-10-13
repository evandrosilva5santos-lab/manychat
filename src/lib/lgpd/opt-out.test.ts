import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  contact: { update: vi.fn() },
  flowRun: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
const contacts = vi.hoisted(() => ({
  recordIncomingMessage: vi.fn(),
  recordOutgoingMessage: vi.fn(),
}));
const graph = vi.hoisted(() => ({ sendTextMessage: vi.fn() }));
const accountClient = vi.hoisted(() => ({ graphClientForAccount: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/engine/contacts", () => contacts);
vi.mock("@/lib/meta/account-client", () => accountClient);

import {
  applyOptOutGate,
  classifyConsentMessage,
  OPT_IN_CONFIRMATION,
  OPT_OUT_CONFIRMATION,
} from "./opt-out";

const NOW = new Date("2026-10-11T12:00:00Z");
const baseContact = { id: "c_1", igsid: "igsid_1", optedOut: false, lastInboundAt: NOW };
const dm = (text: string) => ({
  kind: "message" as const,
  igUserId: "178",
  messageId: "mid_1",
  userIgsid: "igsid_1",
  text,
  timestamp: NOW.getTime(),
});
const gate = (contact: typeof baseContact, event: Parameters<typeof applyOptOutGate>[0]["event"], canRun = true) =>
  applyOptOutGate({ accountId: "acc_1", contact, event, canRun });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  contacts.recordIncomingMessage.mockResolvedValue({ id: "m_in" });
  graph.sendTextMessage.mockResolvedValue({ success: true, messageId: "out_1" });
  accountClient.graphClientForAccount.mockResolvedValue(graph);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("classifyConsentMessage", () => {
  it.each(["parar", "PARAR", "Parar!", "  sair. ", "STOP", "cancelar", "Cancelár", "pârar", "stop 🙏"])(
    "%j → opt_out",
    (text) => {
      expect(classifyConsentMessage(text)).toBe("opt_out");
    },
  );

  it.each(["voltar", "VOLTAR!"])("%j → opt_in", (text) => {
    expect(classifyConsentMessage(text)).toBe("opt_in");
  });

  it.each(["quero cancelar meu pedido", "não vou parar de comprar", "como faço pra sair do grupo?", "parara", "", "eu quero", "stopped"])(
    "%j → null (só a mensagem inteira conta)",
    (text) => {
      expect(classifyConsentMessage(text)).toBeNull();
    },
  );
});

describe("applyOptOutGate", () => {
  it("palavra de opt-out: marca o contato, encerra execuções ativas, grava e confirma dentro da janela", async () => {
    const result = await gate(baseContact, dm("Parar"));

    expect(result).toEqual({ stop: true, action: "opted_out" });
    expect(db.contact.update).toHaveBeenCalledWith({ where: { id: "c_1" }, data: { optedOut: true, optedOutAt: NOW } });
    expect(db.flowRun.updateMany).toHaveBeenCalledWith({
      where: { contactId: "c_1", status: { in: ["RUNNING", "WAITING_CLICK", "WAITING_DELAY", "WAITING_REPLY"] } },
      data: expect.objectContaining({ status: "DONE", resumeAt: null, finishedAt: NOW }),
    });
    expect(contacts.recordIncomingMessage).toHaveBeenCalledWith({
      accountId: "acc_1",
      contactId: "c_1",
      text: "Parar",
      kind: "TEXT",
      igMessageId: "mid_1",
    });
    expect(accountClient.graphClientForAccount).toHaveBeenCalledWith("acc_1");
    expect(graph.sendTextMessage).toHaveBeenCalledWith("igsid_1", OPT_OUT_CONFIRMATION);
    expect(contacts.recordOutgoingMessage).toHaveBeenCalledWith({
      accountId: "acc_1",
      contactId: "c_1",
      text: OPT_OUT_CONFIRMATION,
      kind: "TEXT",
      error: undefined,
    });
  });

  it("não envia confirmação fora da janela de 24h", async () => {
    const stale = { ...baseContact, lastInboundAt: new Date(NOW.getTime() - 25 * 3600_000) };
    expect(await gate(stale, dm("sair"))).toEqual({ stop: true, action: "opted_out" });
    expect(db.contact.update).toHaveBeenCalled();
    expect(graph.sendTextMessage).not.toHaveBeenCalled();
  });

  it("perfil que não pode rodar automações (expirado): registra o opt-out sem enviar confirmação", async () => {
    expect(await gate(baseContact, dm("parar"), false)).toEqual({ stop: true, action: "opted_out" });
    expect(db.contact.update).toHaveBeenCalled();
    expect(accountClient.graphClientForAccount).not.toHaveBeenCalled();
  });

  it("entrega duplicada da palavra: sem segunda confirmação", async () => {
    contacts.recordIncomingMessage.mockResolvedValue(null);
    await gate(baseContact, dm("stop"));
    expect(graph.sendTextMessage).not.toHaveBeenCalled();
  });

  it("palavra de novo quando já saiu: grava, sem nova confirmação", async () => {
    const out = { ...baseContact, optedOut: true };
    expect(await gate(out, dm("parar"))).toEqual({ stop: true, action: "blocked" });
    expect(db.contact.update).not.toHaveBeenCalled();
    expect(graph.sendTextMessage).not.toHaveBeenCalled();
    expect(contacts.recordIncomingMessage).toHaveBeenCalled();
  });

  it("confirmação recusada fica registrada com o erro e não desfaz o opt-out", async () => {
    graph.sendTextMessage.mockResolvedValue({ success: false, error: "Fora da janela" });
    expect((await gate(baseContact, dm("parar"))).stop).toBe(true);
    expect(contacts.recordOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({ error: "Fora da janela" }));
  });

  it("perfil sem token utilizável: a falha é logada, nunca lançada", async () => {
    accountClient.graphClientForAccount.mockRejectedValue(new Error("Token não configurado"));
    await expect(gate(baseContact, dm("parar"))).resolves.toEqual({ stop: true, action: "opted_out" });
  });

  it("contato que saiu: DM é gravada e nenhuma automação roda", async () => {
    const out = { ...baseContact, optedOut: true };
    expect(await gate(out, dm("eu quero"))).toEqual({ stop: true, action: "blocked" });
    expect(contacts.recordIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "eu quero", kind: "TEXT" }));
    expect(graph.sendTextMessage).not.toHaveBeenCalled();
  });

  it("contato que saiu: comentário é gravado (com a mídia) e bloqueado", async () => {
    const out = { ...baseContact, optedOut: true };
    const event = { kind: "comment" as const, igUserId: "178", commentId: "cm_1", mediaId: "media_1", userIgsid: "igsid_1", text: "eu quero", timestamp: 0 };
    expect(await gate(out, event)).toEqual({ stop: true, action: "blocked" });
    expect(contacts.recordIncomingMessage).toHaveBeenCalledWith({
      accountId: "acc_1",
      contactId: "c_1",
      text: "eu quero",
      kind: "COMMENT",
      igMessageId: "cm_1",
      mediaId: "media_1",
    });
  });

  it("contato que saiu: clique em botão é gravado e bloqueado", async () => {
    const out = { ...baseContact, optedOut: true };
    const event = { kind: "postback" as const, igUserId: "178", userIgsid: "igsid_1", title: "Quero", payload: "node:n1_btn_b1", postbackMid: "pb_1", timestamp: 0 };
    expect(await gate(out, event)).toEqual({ stop: true, action: "blocked" });
    expect(contacts.recordIncomingMessage).toHaveBeenCalledWith({
      accountId: "acc_1",
      contactId: "c_1",
      text: "Quero",
      kind: "POSTBACK",
      payload: { payload: "node:n1_btn_b1" },
      igMessageId: "pb_1",
    });
  });

  it("'voltar' de quem saiu reativa e confirma", async () => {
    const out = { ...baseContact, optedOut: true };
    expect(await gate(out, dm("Voltar"))).toEqual({ stop: true, action: "opted_in" });
    expect(db.contact.update).toHaveBeenCalledWith({ where: { id: "c_1" }, data: { optedOut: false, optedOutAt: null } });
    expect(graph.sendTextMessage).toHaveBeenCalledWith("igsid_1", OPT_IN_CONFIRMATION);
  });

  it("contato inscrito: mensagens comuns e 'voltar' passam sem tocar em nada", async () => {
    expect(await gate(baseContact, dm("eu quero"))).toEqual({ stop: false });
    expect(await gate(baseContact, dm("voltar"))).toEqual({ stop: false });
    expect(contacts.recordIncomingMessage).not.toHaveBeenCalled();
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("comentário dizendo 'parar' não é opt-out (comentário não abre a janela do Direct)", async () => {
    const event = { kind: "comment" as const, igUserId: "178", commentId: "cm_2", userIgsid: "igsid_1", text: "parar", timestamp: 0 };
    expect(await gate(baseContact, event)).toEqual({ stop: false });
    expect(db.contact.update).not.toHaveBeenCalled();
  });
});
