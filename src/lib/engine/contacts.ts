import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/queue/store";
import type { Message, MessageKind } from "@/generated/prisma/client";

export type ContactProfile = {
  accountId: string;
  igsid: string;
  username?: string | null;
  name?: string | null;
  profilePicUrl?: string | null;
};

/**
 * Busca ou cria o contato a partir do IGSID no Postgres.
 *
 * `upsert` atômico (sem buscar-para-depois-criar): dois eventos em
 * paralelo do mesmo lead não criam contato duplicado.
 *
 * `inboundKind`: a janela de 24h da Meta só é aberta por mensagens no
 * Direct — comentário NÃO atualiza `lastInboundAt` (apenas a interação).
 */
export async function getOrCreateContact(
  profile: ContactProfile,
  inboundKind: "comment" | "dm" = "dm"
) {
  const now = new Date();
  const isDm = inboundKind === "dm";

  return prisma.contact.upsert({
    where: {
      accountId_igsid: {
        accountId: profile.accountId,
        igsid: profile.igsid,
      },
    },
    update: {
      username: profile.username ?? undefined,
      name: profile.name ?? undefined,
      profilePicUrl: profile.profilePicUrl ?? undefined,
      lastInboundAt: isDm ? now : undefined,
      lastInteractionAt: now,
    },
    create: {
      accountId: profile.accountId,
      igsid: profile.igsid,
      username: profile.username,
      name: profile.name,
      profilePicUrl: profile.profilePicUrl,
      lastInboundAt: isDm ? now : undefined,
      lastInteractionAt: now,
    },
  });
}

/** Prévia curta da última mensagem (lista de conversas sem N+1). */
function previewFor(text?: string | null, kind?: MessageKind): string {
  const raw = text?.trim();
  if (raw) return raw.slice(0, 140);
  const label: Record<string, string> = {
    POSTBACK: "Toque num botão",
    CAROUSEL: "Carrossel",
    COMMENT: "Comentário",
    COMMENT_REPLY: "Resposta ao comentário",
    MEDIA: "Mídia",
  };
  return kind ? label[kind] ?? "Mensagem" : "Mensagem";
}

async function touchContactPreview(contactId: string, text: string | null | undefined, kind: MessageKind, at: Date) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      lastMessagePreview: previewFor(text, kind),
      lastMessageAt: at,
    },
  });
}

/**
 * Grava mensagem recebida do contato no histórico (direção IN).
 * P2002 em `igMessageId` = evento já gravado antes → devolve a linha
 * existente marcada como duplicada (o chamador NÃO reexecuta o fluxo).
 */
export async function recordIncomingMessage(params: {
  accountId: string;
  contactId: string;
  text?: string;
  kind: MessageKind;
  payload?: any;
  igMessageId?: string;
  mediaId?: string;
}): Promise<{ message: Message; duplicate: boolean }> {
  try {
    const message = await prisma.message.create({
      data: {
        accountId: params.accountId,
        contactId: params.contactId,
        direction: "IN",
        kind: params.kind,
        text: params.text,
        payload: params.payload ?? undefined,
        igMessageId: params.igMessageId,
        mediaId: params.mediaId,
      },
    });
    await touchContactPreview(params.contactId, params.text, params.kind, message.createdAt);
    return { message, duplicate: false };
  } catch (error) {
    if (params.igMessageId && isUniqueViolation(error)) {
      const existing = await prisma.message.findUnique({
        where: { igMessageId: params.igMessageId },
      });
      if (existing) return { message: existing, duplicate: true };
    }
    throw error;
  }
}

/**
 * Grava mensagem enviada pelo sistema no histórico (direção OUT).
 * `error` preenchido = envio recusado pela Meta (visível no painel
 * de envios com falha).
 */
export async function recordOutgoingMessage(params: {
  accountId: string;
  contactId: string;
  text?: string;
  kind: MessageKind;
  payload?: any;
  flowId?: string;
  nodeId?: string;
  runId?: string;
  error?: string;
}) {
  const message = await prisma.message.create({
    data: {
      accountId: params.accountId,
      contactId: params.contactId,
      direction: "OUT",
      kind: params.kind,
      text: params.text,
      payload: params.payload ?? undefined,
      flowId: params.flowId,
      nodeId: params.nodeId,
      runId: params.runId,
      error: params.error,
    },
  });
  if (!params.error) {
    await touchContactPreview(params.contactId, params.text, params.kind, message.createdAt);
  }
  return message;
}
