import { prisma } from "@/lib/prisma";
import type { MessageKind } from "@/generated/prisma/enums";

export type ContactProfile = {
  accountId: string;
  igsid: string;
  username?: string | null;
  name?: string | null;
  profilePicUrl?: string | null;
};

/**
 * Busca ou cria o contato a partir do IGSID.
 * Atualiza o horário de interação e o momento da última mensagem recebida.
 */
export async function getOrCreateContact(profile: ContactProfile) {
  const existing = await prisma.contact.findUnique({
    where: {
      accountId_igsid: {
        accountId: profile.accountId,
        igsid: profile.igsid,
      },
    },
  });

  const now = new Date();

  if (existing) {
    return prisma.contact.update({
      where: { id: existing.id },
      data: {
        username: profile.username ?? existing.username,
        name: profile.name ?? existing.name,
        profilePicUrl: profile.profilePicUrl ?? existing.profilePicUrl,
        lastInboundAt: now,
        lastInteractionAt: now,
      },
    });
  }

  return prisma.contact.create({
    data: {
      accountId: profile.accountId,
      igsid: profile.igsid,
      username: profile.username,
      name: profile.name,
      profilePicUrl: profile.profilePicUrl,
      lastInboundAt: now,
      lastInteractionAt: now,
    },
  });
}

/**
 * Grava mensagem recebida do contato no histórico de conversa (direção IN).
 */
export async function recordIncomingMessage(params: {
  accountId: string;
  contactId: string;
  text?: string;
  kind: MessageKind;
  payload?: any;
  igMessageId?: string;
  mediaId?: string;
}) {
  if (params.igMessageId) {
    const existing = await prisma.message.findUnique({
      where: { igMessageId: params.igMessageId },
    });
    if (existing) return existing;
  }

  return prisma.message.create({
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
}

/**
 * Grava mensagem enviada pelo sistema no histórico de conversa (direção OUT).
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
  return prisma.message.create({
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
}
