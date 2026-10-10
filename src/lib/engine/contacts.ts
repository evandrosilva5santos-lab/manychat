import { prisma } from "@/lib/prisma";
import type { MessageKind } from "@/generated/prisma/enums";
import {
  addStoredMessage,
  getStoredContacts,
  readStore,
  writeStore,
} from "@/lib/storage/store";

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
  const now = new Date();

  try {
    const existing = await prisma.contact.findUnique({
      where: {
        accountId_igsid: {
          accountId: profile.accountId,
          igsid: profile.igsid,
        },
      },
    });

    if (existing) {
      return await prisma.contact.update({
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

    return await prisma.contact.create({
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
  } catch {
    // Fallback no store persistente local
    const store = await readStore();
    const existingIdx = store.contacts.findIndex(
      (c) => c.igsid === profile.igsid
    );

    if (existingIdx >= 0) {
      const existing = store.contacts[existingIdx];
      existing.username = profile.username ?? existing.username;
      existing.name = profile.name ?? existing.name;
      existing.profilePicUrl = profile.profilePicUrl ?? existing.profilePicUrl;
      existing.lastInboundAt = now.toISOString();
      existing.lastInteractionAt = now.toISOString();
      existing.is24hActive = true;
      existing.remainingHours24h = 24;
      await writeStore(store);
      return existing as any;
    }

    const newContact = {
      id: `cont_${Date.now()}`,
      igsid: profile.igsid,
      username: profile.username || "novo.lead",
      name: profile.name || profile.username || "Novo Lead Instagram",
      profilePicUrl:
        profile.profilePicUrl ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      followsAccount: true,
      lastInboundAt: now.toISOString(),
      lastInteractionAt: now.toISOString(),
      is24hActive: true,
      remainingHours24h: 24,
      sourceFlowId: null,
      sourceFlowName: "Automação rápida",
      tags: [{ id: "tag-1", name: "lead-quente" }],
      createdAt: now.toISOString(),
    };

    store.contacts.unshift(newContact);
    if (!store.messages[newContact.id]) {
      store.messages[newContact.id] = [];
    }
    await writeStore(store);
    return newContact as any;
  }
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
  try {
    if (params.igMessageId) {
      const existing = await prisma.message.findUnique({
        where: { igMessageId: params.igMessageId },
      });
      if (existing) return existing;
    }

    return await prisma.message.create({
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
  } catch {
    // Fallback no store persistente local
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return await addStoredMessage(params.contactId, {
      id: msgId,
      direction: "IN",
      kind: params.kind as any,
      text: params.text || null,
      payload: params.payload,
      mediaId: params.mediaId,
      createdAt: new Date().toISOString(),
    });
  }
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
  try {
    return await prisma.message.create({
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
  } catch {
    // Fallback no store persistente local
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return await addStoredMessage(params.contactId, {
      id: msgId,
      direction: "OUT",
      kind: params.kind as any,
      text: params.text || null,
      payload: params.payload,
      flowName: null,
      error: params.error,
      createdAt: new Date().toISOString(),
    });
  }
}
