// Opt-out (LGPD e boas práticas da Meta): quem manda "parar", "sair", "stop"
// ou "cancelar" no Direct deixa de receber QUALQUER envio automático.
// Política padrão (portada do item 8a, a confirmar com o dono): só a mensagem
// INTEIRA conta ("quero cancelar meu pedido" não é opt-out) e a reativação é
// explícita, mandando "voltar". Comentário não conta: não abre a janela de 24h.
import { prisma } from "@/lib/prisma";
import { recordIncomingMessage, recordOutgoingMessage } from "@/lib/engine/contacts";
import { graphClientForAccount } from "@/lib/meta/account-client";
import { check24hWindow } from "@/lib/meta/window";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

export const OPT_OUT_KEYWORDS = ["parar", "sair", "stop", "cancelar"] as const;
export const OPT_IN_KEYWORDS = ["voltar"] as const;

export const OPT_OUT_CONFIRMATION =
  "Pronto: você não vai mais receber mensagens automáticas deste perfil. Se mudar de ideia, é só mandar VOLTAR.";
export const OPT_IN_CONFIRMATION =
  "Tudo certo: você voltou a receber as mensagens automáticas deste perfil. Para parar quando quiser, mande PARAR.";

const ACTIVE_RUN_STATUSES = ["RUNNING", "WAITING_CLICK", "WAITING_DELAY", "WAITING_REPLY"] as const;

type GateContact = {
  id: string;
  igsid: string;
  optedOut: boolean;
  lastInboundAt: Date | string | null;
};

export type OptOutGateResult =
  | { stop: false }
  | { stop: true; action: "opted_out" | "opted_in" | "blocked" };

/** Sem acento, sem pontuação/emoji, minúsculas e espaços simples. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function classifyConsentMessage(text: string): "opt_out" | "opt_in" | null {
  const normalized = normalize(text);
  if ((OPT_OUT_KEYWORDS as readonly string[]).includes(normalized)) return "opt_out";
  if ((OPT_IN_KEYWORDS as readonly string[]).includes(normalized)) return "opt_in";
  return null;
}

/** Grava o evento no histórico (Conversas continua mostrando tudo). null = duplicado. */
async function recordEvent(accountId: string, contactId: string, event: NormalizedWebhookEvent) {
  if (event.kind === "message") {
    return recordIncomingMessage({ accountId, contactId, text: event.text, kind: "TEXT", igMessageId: event.messageId });
  }
  if (event.kind === "comment") {
    return recordIncomingMessage({
      accountId,
      contactId,
      text: event.text,
      kind: "COMMENT",
      igMessageId: event.commentId,
      mediaId: event.mediaId,
    });
  }
  return recordIncomingMessage({
    accountId,
    contactId,
    text: event.title,
    kind: "POSTBACK",
    payload: { payload: event.payload },
    igMessageId: event.postbackMid,
  });
}

/** Confirmação só dentro da janela de 24h e com token do próprio perfil. Falha fica registrada, nunca lançada. */
async function sendConfirmation(accountId: string, contact: GateContact, text: string) {
  if (!check24hWindow(contact.lastInboundAt).is24hActive) return;
  try {
    const client = await graphClientForAccount(accountId);
    const result = await client.sendTextMessage(contact.igsid, text);
    await recordOutgoingMessage({
      accountId,
      contactId: contact.id,
      text,
      kind: "TEXT",
      error: result.success ? undefined : result.error || (result.code === undefined ? "Falha no envio" : String(result.code)),
    });
  } catch (error) {
    console.error("[opt-out] Falha ao enviar a confirmação:", error instanceof Error ? error.message : "erro");
  }
}

async function optOut(contact: GateContact) {
  const now = new Date();
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contact.id }, data: { optedOut: true, optedOutAt: now } }),
    // Encerra esperas e cliques pendentes: nada retoma depois do "parar".
    prisma.flowRun.updateMany({
      where: { contactId: contact.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
      data: { status: "DONE", resumeAt: null, finishedAt: now, error: "Encerrado: o contato pediu para parar (opt-out)" },
    }),
  ]);
}

/**
 * Portão chamado pelo worker logo depois de achar/criar o contato.
 * `stop: true` = o evento já foi tratado aqui (gravado no histórico) e o
 * motor NÃO deve rodar. `stop: false` = segue o processamento normal.
 * Só vale para perfis que podem rodar automações (`canRun`).
 */
export async function applyOptOutGate(params: {
  accountId: string;
  contact: GateContact;
  event: NormalizedWebhookEvent;
  canRun: boolean;
}): Promise<OptOutGateResult> {
  const { accountId, contact, event, canRun } = params;
  const consent = event.kind === "message" ? classifyConsentMessage(event.text) : null;

  if (consent === "opt_out" && !contact.optedOut) {
    await optOut(contact);
    const recorded = await recordEvent(accountId, contact.id, event);
    if (recorded && canRun) await sendConfirmation(accountId, contact, OPT_OUT_CONFIRMATION);
    return { stop: true, action: "opted_out" };
  }

  if (consent === "opt_in" && contact.optedOut) {
    await prisma.contact.update({ where: { id: contact.id }, data: { optedOut: false, optedOutAt: null } });
    const recorded = await recordEvent(accountId, contact.id, event);
    if (recorded && canRun) await sendConfirmation(accountId, contact, OPT_IN_CONFIRMATION);
    return { stop: true, action: "opted_in" };
  }

  if (contact.optedOut) {
    await recordEvent(accountId, contact.id, event);
    return { stop: true, action: "blocked" };
  }

  return { stop: false };
}
