import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@/generated/prisma/client";
const { db, client, record, clicked, link } = vi.hoisted(() => ({
  db: {
    flow: { findFirst: vi.fn() }, contact: { findFirst: vi.fn(), update: vi.fn() },
    flowRun: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    instagramAccount: { findUnique: vi.fn() },
    contactTag: { findUnique: vi.fn(), upsert: vi.fn() }, privateReply: { create: vi.fn(), update: vi.fn() },
    message: { count: vi.fn(), findFirst: vi.fn() },
  },
  client: { sendTextMessage: vi.fn(), sendButtonMessage: vi.fn(), sendCarouselMessage: vi.fn(), checkUserFollows: vi.fn(), reactToMessage: vi.fn() },
  record: vi.fn(), clicked: vi.fn(), link: vi.fn(),
}));
// Plano liberado: a trava de plano tem testes próprios (billing/entitlements).
const sendingBlockReason = vi.hoisted(() => vi.fn(async (): Promise<string | null> => null));
vi.mock("@/lib/billing/entitlements", () => ({ sendingBlockReason }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn(async () => client) }));
vi.mock("./contacts", () => ({ recordOutgoingMessage: record }));
vi.mock("./tracked-links", () => ({ trackedUrl: link, hasClickedLink: clicked }));
import { executeFlow, gateText, resumeFlowOnClick, resumeFlowOnMessage } from "./runner";
import { encodePostback } from "../meta/postback";

const contact: Contact = {
  id: "contact", accountId: "account", igsid: "lead", username: "ana", name: null,
  profilePicUrl: null, followsAccount: false, lastInboundAt: new Date(),
  lastInteractionAt: null, sourceFlowId: null, optedOut: false, optedOutAt: null, createdAt: new Date(), updatedAt: new Date(),
  lastMessagePreview: null, lastMessageAt: null,
};
const options = { accountId: "account", contact, flowId: "flow", startNodeId: "first" };
function flow(type: string, data: object, next = true) {
  return { id: "flow", accountId: "account", status: "LIVE", nodes: [
    { id: "first", type, data, carouselCards: [] },
    { id: "second", type: "MESSAGE", data: { text: "Fim" }, carouselCards: [] },
  ], edges: next ? [{ sourceNodeId: "first", targetNodeId: "second", sourceHandle: null }] : [] };
}
beforeEach(() => {
  vi.resetAllMocks();
  db.flow.findFirst.mockResolvedValue(flow("MESSAGE", { text: "Olá" }));
  db.contact.findFirst.mockResolvedValue({ ...contact, lastInboundAt: new Date() });
  db.flowRun.create.mockResolvedValue({ id: "run", triggerContext: null });
  db.flowRun.update.mockResolvedValue({});
  db.flowRun.findUnique.mockImplementation(async (args: unknown) => db.flowRun.findFirst(args));
  db.instagramAccount.findUnique.mockResolvedValue({ status: "CONNECTED" });
  db.flowRun.updateMany.mockResolvedValue({ count: 1 });
  db.privateReply.create.mockResolvedValue({ id: "claim" });
  for (const send of [client.sendTextMessage, client.sendButtonMessage, client.sendCarouselMessage]) send.mockResolvedValue({ success: true, messageId: "mid", retryable: false });
  link.mockResolvedValue("https://app.example/api/l/opaque");
});

describe("FlowRunner: envios reais controlados por janela e conta", () => {
  it("envia private reply uma vez e pausa antes da próxima DM", async () => {
    db.contact.findFirst.mockResolvedValue({ ...contact, lastInboundAt: null });
    const result = await executeFlow({ ...options, triggerContext: { origin: "comment", commentId: "comment", timestamp: Date.now() } });
    expect(result.success).toBe(true);
    expect(client.sendTextMessage).toHaveBeenCalledExactlyOnceWith("lead", "Olá", { commentId: "comment" });
    expect(db.privateReply.create).toHaveBeenCalledOnce();
    expect(db.flowRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "run", status: { not: "FAILED" } }, data: expect.objectContaining({ status: "WAITING_REPLY", currentNodeId: "second" }) }));
  });
  it("não repete private reply com claim existente", async () => {
    db.privateReply.create.mockRejectedValue({ code: "P2002" });
    const result = await executeFlow({ ...options, triggerContext: { origin: "comment", commentId: "comment", timestamp: Date.now() } });
    expect(result.success).toBe(false);
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("cliente Graph indisponível não consome o claim da private reply", async () => {
    const { graphClientForAccount } = await import("@/lib/meta/account-client");
    vi.mocked(graphClientForAccount).mockRejectedValueOnce(new Error("sem token"));
    const result = await executeFlow({ ...options, triggerContext: { origin: "comment", commentId: "comment", timestamp: Date.now() } });
    expect(result.success).toBe(false);
    expect(db.privateReply.create).not.toHaveBeenCalled();
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("perfil descarregado não consome o claim da private reply", async () => {
    db.instagramAccount.findUnique.mockResolvedValue({ status: "DISCONNECTED" });
    const result = await executeFlow({ ...options, triggerContext: { origin: "comment", commentId: "comment", timestamp: Date.now() } });
    expect(result.success).toBe(false);
    expect(db.privateReply.create).not.toHaveBeenCalled();
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("bloqueia comentário com mais de 7 dias", async () => {
    const result = await executeFlow({ ...options, triggerContext: { origin: "comment", commentId: "comment", timestamp: Date.now() - 8 * 86400000 } });
    expect(result.success).toBe(false);
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("plano bloqueado (assinatura suspensa ou cota do mês) não envia e marca FAILED com o motivo", async () => {
    sendingBlockReason.mockResolvedValueOnce("Limite de 100 mensagens enviadas no mês do plano atingido.");
    const result = await executeFlow(options);
    expect(result).toMatchObject({ success: false, error: "Limite de 100 mensagens enviadas no mês do plano atingido." });
    expect(client.sendTextMessage).not.toHaveBeenCalled();
    expect(db.flowRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
  it("bloqueia DM fora da janela", async () => {
    db.contact.findFirst.mockResolvedValue({ ...contact, lastInboundAt: null });
    expect((await executeFlow(options)).success).toBe(false);
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("QUESTION só com URL rastreia e continua", async () => {
    db.flow.findFirst.mockResolvedValue(flow("QUESTION", { text: "Site", buttons: [{ id: "b", title: "ABRIR", type: "web_url", url: "https://example.com" }] }));
    expect((await executeFlow(options)).success).toBe(true);
    expect(client.sendButtonMessage).toHaveBeenCalledWith("lead", "Site", [expect.objectContaining({ url: "https://app.example/api/l/opaque" })], undefined);
    expect(client.sendTextMessage).toHaveBeenCalledWith("lead", "Fim", undefined);
  });
  it("QUESTION vazia falha sem enviar", async () => {
    db.flow.findFirst.mockResolvedValue(flow("QUESTION", { text: "Site", buttons: [] }));
    expect((await executeFlow(options)).success).toBe(false);
    expect(client.sendButtonMessage).not.toHaveBeenCalled();
  });
  it("falha de envio registra FAILED", async () => {
    client.sendTextMessage.mockResolvedValue({ success: false, error: "Janela encerrada", retryable: false });
    expect((await executeFlow(options)).success).toBe(false);
    expect(db.flowRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
  it.each([true, false])("condição link_clicked=%s escolhe ramo", async (value) => {
    const fixture = flow("CONDITION", { rule: "link_clicked", nodeId: "link_node" });
    fixture.edges[0].sourceHandle = (value ? "yes" : "no") as never;
    db.flow.findFirst.mockResolvedValue(fixture);
    clicked.mockResolvedValue(value);
    await executeFlow(options);
    expect(clicked).toHaveBeenCalledWith("account", "contact", "link_node");
    expect(client.sendTextMessage).toHaveBeenCalledOnce();
  });
  it("ADD_TAG aplica etiqueta", async () => {
    db.flow.findFirst.mockResolvedValue(flow("ADD_TAG", { tagId: "tag" }, false));
    await executeFlow(options);
    expect(db.contactTag.upsert).toHaveBeenCalledOnce();
  });
  it("DELAY pausa sem executar próximo nó", async () => {
    db.flow.findFirst.mockResolvedValue(flow("DELAY", { seconds: 60 }));
    await executeFlow(options);
    expect(db.flowRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "WAITING_DELAY" }) }));
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("NOTE continua", async () => {
    db.flow.findFirst.mockResolvedValue(flow("NOTE", { text: "Interno" }));
    await executeFlow(options);
    expect(client.sendTextMessage).toHaveBeenCalledOnce();
  });
  it("FOLLOW_GATE não segue: pausa em botão", async () => {
    db.flow.findFirst.mockResolvedValue(flow("FOLLOW_GATE", { text: "Siga", notFollowingText: "Siga", buttonTitle: "JÁ SEGUI" }));
    client.checkUserFollows.mockResolvedValue(false);
    await executeFlow(options);
    expect(client.sendButtonMessage).toHaveBeenCalledOnce();
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("CAROUSEL vazio falha", async () => {
    db.flow.findFirst.mockResolvedValue(flow("CAROUSEL", {}));
    expect((await executeFlow(options)).success).toBe(false);
  });
  it("interrompe ciclo como FAILED", async () => {
    const fixture = flow("NOTE", {});
    fixture.edges[0].targetNodeId = "first";
    db.flow.findFirst.mockResolvedValue(fixture);
    expect((await executeFlow(options)).success).toBe(false);
  });
  it("conta divergente não executa", async () => {
    expect((await executeFlow({ ...options, accountId: "other" })).success).toBe(false);
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("postback com underscores retoma apenas a saída e execução corretas", async () => {
    const fixture = flow("QUESTION", { text: "Oi", buttons: [{ id: "btn_under", title: "OK", type: "postback" }] });
    fixture.nodes[0].id = "node_under";
    fixture.edges[0] = { sourceNodeId: "node_under", sourceHandle: "btn_under" as never, targetNodeId: "second" };
    db.flowRun.findFirst.mockResolvedValue({ id: "run", flowId: "flow", currentNodeId: "node_under", status: "WAITING_CLICK", triggerContext: null, flow: fixture });
    db.flow.findFirst.mockResolvedValue(fixture);
    const payload = encodePostback({ kind: "question", nodeId: "node_under", buttonId: "btn_under", runId: "run" });
    const result = await resumeFlowOnClick({ accountId: "account", contact, nodeId: "node_under", buttonId: "btn_under", payload });
    expect(result.success).toBe(true);
    expect(client.sendTextMessage).toHaveBeenCalledWith("lead", "Fim", undefined);
  });
  it("DM retoma WAITING_REPLY sem reenviar private reply", async () => {
    db.flowRun.findFirst.mockResolvedValue({ id: "run", flowId: "flow", currentNodeId: "second", status: "WAITING_REPLY", triggerContext: { origin: "comment", commentId: "comment", timestamp: Date.now(), privateReplySent: true } });
    expect((await resumeFlowOnMessage({ accountId: "account", contact, inboundText: "oi" })).success).toBe(true);
    expect(client.sendTextMessage).toHaveBeenCalledWith("lead", "Fim", undefined);
    expect(db.privateReply.create).not.toHaveBeenCalled();
  });
});

describe("Perfil seguro: sem fallback global e com status checado a cada envio", () => {
  const lostMessage = "Perfil desconectado ou com token expirado — reconecte em Ajustes.";
  it("sem cliente da conta, não envia e o run termina FAILED com a mensagem de reconexão", async () => {
    const { graphClientForAccount } = await import("@/lib/meta/account-client");
    vi.mocked(graphClientForAccount).mockRejectedValueOnce(new Error("indisponível"));
    const result = await executeFlow(options);
    expect(result).toMatchObject({ success: false, failed: true, error: lostMessage });
    expect(client.sendTextMessage).not.toHaveBeenCalled();
    expect(db.flowRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", error: lostMessage }) }));
  });
  it("perfil desconectado no meio do fluxo interrompe antes do próximo envio", async () => {
    db.instagramAccount.findUnique.mockResolvedValueOnce({ status: "CONNECTED" }).mockResolvedValueOnce({ status: "DISCONNECTED" });
    const result = await executeFlow(options);
    expect(client.sendTextMessage).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ success: false, failed: true, error: "Perfil descarregado" });
    expect(db.flowRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", error: "Perfil descarregado" }) }));
  });
  it("perfil EXPIRED antes do envio falha com a mensagem de reconexão", async () => {
    db.instagramAccount.findUnique.mockResolvedValue({ status: "EXPIRED" });
    expect(await executeFlow(options)).toMatchObject({ failed: true, error: lostMessage });
    expect(client.sendTextMessage).not.toHaveBeenCalled();
  });
  it("não consulta o status em nós que não falam com a Meta", async () => {
    db.flow.findFirst.mockResolvedValue(flow("NOTE", {}, false));
    await executeFlow(options);
    expect(db.instagramAccount.findUnique).not.toHaveBeenCalled();
  });
});

describe("Perfil seguro: run FAILED não ressuscita", () => {
  it("escritas de estado são condicionais (status != FAILED)", async () => {
    db.flow.findFirst.mockResolvedValue(flow("DELAY", { seconds: 60 }));
    await executeFlow(options);
    expect(db.flowRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "run", status: { not: "FAILED" } } }));
    expect(db.flowRun.update).not.toHaveBeenCalled();
  });
  it("runId de um run FAILED não é reaberto pelo executeFlow", async () => {
    db.flowRun.findUnique.mockResolvedValue({ id: "run", status: "FAILED", error: "x" });
    const result = await executeFlow({ ...options, runId: "run" });
    expect(result.success).toBe(false);
    expect(client.sendTextMessage).not.toHaveBeenCalled();
    expect(db.flowRun.updateMany).not.toHaveBeenCalled();
  });
  it("retomada com runId já RUNNING (reabertura explícita do retry) segue normalmente", async () => {
    db.flowRun.findUnique.mockResolvedValue({ id: "run", status: "RUNNING", currentNodeId: "first" });
    expect((await executeFlow({ ...options, runId: "run" })).success).toBe(true);
    expect(client.sendTextMessage).toHaveBeenCalledWith("lead", "Olá", undefined);
  });
});

describe("Portão de seguidor: \"JÁ SEGUI\" confere de novo e escala a mensagem", () => {
  const gateData = { text: "Pedido", buttonTitle: "JÁ SEGUI", notFollowingText: "Ainda não", finalText: "Final" };
  function gateFlow() {
    return {
      id: "flow", accountId: "account", status: "LIVE",
      nodes: [
        { id: "gate", type: "FOLLOW_GATE", data: gateData, carouselCards: [] },
        { id: "link", type: "MESSAGE", data: { text: "Aqui está o link" }, carouselCards: [] },
      ],
      edges: [{ sourceNodeId: "gate", targetNodeId: "link", sourceHandle: "unlock" }],
    };
  }
  const gatePayload = () => encodePostback({ kind: "gate", nodeId: "gate", runId: "run" });
  function waitingAtGate() {
    const fixture = gateFlow();
    db.flow.findFirst.mockResolvedValue(fixture);
    db.flowRun.findFirst.mockResolvedValue({ id: "run", flowId: "flow", currentNodeId: "gate", status: "WAITING_CLICK", triggerContext: null, flow: fixture });
  }

  it("gateText escolhe pedido, 'ainda não' e final pela tentativa", () => {
    expect(gateText(gateData, 0)).toBe("Pedido");
    expect(gateText(gateData, 1)).toBe("Ainda não");
    expect(gateText(gateData, 2)).toBe("Final");
    expect(gateText(gateData, 7)).toBe("Final");
    expect(gateText({ text: "Só um" }, 3)).toBe("Só um");
  });

  it("tocou em JÁ SEGUI e agora segue: recebe o link (antes a execução terminava calada)", async () => {
    waitingAtGate();
    client.checkUserFollows.mockResolvedValue(true);
    const result = await resumeFlowOnClick({ accountId: "account", contact, nodeId: "gate", payload: gatePayload() });
    expect(result.success).toBe(true);
    expect(client.sendTextMessage).toHaveBeenCalledWith("lead", "Aqui está o link", undefined);
  });

  it("tocou em JÁ SEGUI e ainda não segue: manda a 2ª mensagem e continua esperando o botão", async () => {
    waitingAtGate();
    client.checkUserFollows.mockResolvedValue(false);
    db.message.count.mockResolvedValue(1);
    await resumeFlowOnClick({ accountId: "account", contact, nodeId: "gate", payload: gatePayload() });
    expect(client.sendButtonMessage).toHaveBeenCalledWith("lead", "Ainda não", [expect.objectContaining({ title: "JÁ SEGUI", type: "postback" })], undefined);
    expect(client.sendTextMessage).not.toHaveBeenCalled();
    const statuses = db.flowRun.updateMany.mock.calls.map((call) => (call[0] as { data?: { status?: string } }).data?.status);
    expect(statuses).toContain("WAITING_CLICK");
  });

  it("insistiu de novo sem seguir: manda a mensagem final", async () => {
    waitingAtGate();
    client.checkUserFollows.mockResolvedValue(false);
    db.message.count.mockResolvedValue(2);
    await resumeFlowOnClick({ accountId: "account", contact, nodeId: "gate", payload: gatePayload() });
    expect(client.sendButtonMessage).toHaveBeenCalledWith("lead", "Final", expect.any(Array), undefined);
  });
});

describe("Lembrete com ❤️", () => {
  it("nó marcado reage à última mensagem do lead antes de enviar o lembrete", async () => {
    db.flow.findFirst.mockResolvedValue(flow("QUESTION", { text: "Lembrete", reactToLastMessage: true, buttons: [{ id: "b", title: "ACESSAR", type: "web_url", url: "https://exemplo.com" }] }, false));
    db.message.findFirst.mockResolvedValue({ igMessageId: "mid.ultima" });
    client.reactToMessage.mockResolvedValue({ success: true });
    await executeFlow(options);
    expect(client.reactToMessage).toHaveBeenCalledWith("lead", "mid.ultima", "love");
    expect(client.sendButtonMessage).toHaveBeenCalled();
    expect(client.reactToMessage.mock.invocationCallOrder[0]).toBeLessThan(client.sendButtonMessage.mock.invocationCallOrder[0]);
  });

  it("reação recusada não impede o lembrete", async () => {
    db.flow.findFirst.mockResolvedValue(flow("QUESTION", { text: "Lembrete", reactToLastMessage: true, buttons: [{ id: "b", title: "ACESSAR", type: "web_url", url: "https://exemplo.com" }] }, false));
    db.message.findFirst.mockResolvedValue({ igMessageId: "mid.ultima" });
    client.reactToMessage.mockResolvedValue({ success: false, error: "recusada" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await executeFlow(options);
    expect(client.sendButtonMessage).toHaveBeenCalled();
  });

  it("nó sem a marcação não reage", async () => {
    db.flow.findFirst.mockResolvedValue(flow("QUESTION", { text: "Pergunta", buttons: [{ id: "b", title: "OK", type: "postback" }] }, false));
    await executeFlow(options);
    expect(client.reactToMessage).not.toHaveBeenCalled();
  });
});
