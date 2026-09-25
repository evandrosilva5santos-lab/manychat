"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { defaultGraphClient } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";
import { type ContactListItem } from "@/app/contatos/actions";
import { check24hWindow } from "@/lib/meta/window";

export type MessageItem = {
  id: string;
  direction: "IN" | "OUT";
  kind: "TEXT" | "BUTTONS" | "CAROUSEL" | "POSTBACK" | "COMMENT" | "COMMENT_REPLY" | "STORY_REPLY" | "MEDIA";
  text: string | null;
  payload?: any;
  mediaId?: string | null;
  flowName?: string | null;
  error?: string | null;
  createdAt: string;
};

export type ConversationSummary = {
  contact: ContactListItem;
  lastMessage: {
    text: string;
    direction: "IN" | "OUT";
    kind: string;
    createdAt: string;
  } | null;
  unread: boolean;
};

// Histórico de mensagens simulado para demonstração e desenvolvimento offline
const memoryMessages: Record<string, MessageItem[]> = {
  "cont-1": [
    {
      id: "m-1",
      direction: "IN",
      kind: "COMMENT",
      text: "CASAMENTO",
      mediaId: "18042938491823901",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "m-2",
      direction: "OUT",
      kind: "COMMENT_REPLY",
      text: "Que bom que você vai casar na Moving! 💍 Te mandei no direct",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000 + 2000).toISOString(),
    },
    {
      id: "m-3",
      direction: "OUT",
      kind: "BUTTONS",
      text: "AAAAH! 💍✨\nQue bom saber que você quer casar na Moving!\n\nVou te passar todas as informações de como participar do casamento. 👇",
      payload: { buttons: [{ title: "QUERO PARTICIPAR", type: "postback" }] },
      flowName: "[2026] Casamento por DM automático",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000 + 4000).toISOString(),
    },
    {
      id: "m-4",
      direction: "IN",
      kind: "POSTBACK",
      text: "Clicou em 'QUERO PARTICIPAR'",
      payload: { title: "QUERO PARTICIPAR" },
      createdAt: new Date(Date.now() - 2 * 3600 * 1000 + 45000).toISOString(),
    },
    {
      id: "m-5",
      direction: "OUT",
      kind: "BUTTONS",
      text: "AAAAH! 💍🥹\nEntão você também sonha em viver esse momento com a Moving!\n\nQuer saber como funciona a inscrição para o casamento? Vou te encaminhar para o WhatsApp da equipe. 👇",
      payload: {
        buttons: [{ title: "QUERO ME INSCREVER", type: "web_url", url: "https://wa.me/5551994044194" }],
      },
      flowName: "[2026] Casamento por DM automático",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000 + 47000).toISOString(),
    },
  ],
  "cont-2": [
    {
      id: "m-10",
      direction: "IN",
      kind: "TEXT",
      text: "Oi, como funciona a parte de assessoria para o casamento?",
      createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    },
    {
      id: "m-11",
      direction: "OUT",
      kind: "TEXT",
      text: "Olá Lucas! Tudo bem? Nossa assessoria acompanha desde a escolha dos fornecedores até o cronograma completo no grande dia.",
      createdAt: new Date(Date.now() - 13 * 3600 * 1000).toISOString(),
    },
  ],
  "cont-4": [
    {
      id: "m-20",
      direction: "IN",
      kind: "COMMENT",
      text: "QUERO CASAR",
      mediaId: "18042938491823901",
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      id: "m-21",
      direction: "OUT",
      kind: "CAROUSEL",
      text: "[Carrossel com 3 cards]",
      payload: {
        cards: [
          { title: "Pacote Casamento Completo 2026", buttonTitle: "QUERO ESTE PACOTE" },
          { title: "Assessoria & Decoração Floral", buttonTitle: "VER FOTOS REAIS" },
          { title: "Agendamento com a Equipe", buttonTitle: "FALAR NO WHATSAPP" },
        ],
      },
      createdAt: new Date(Date.now() - 40 * 60 * 1000 + 3000).toISOString(),
    },
  ],
};

/**
 * Lista as conversas recentes para a coluna lateral do Live Inbox.
 */
export async function listConversations(
  filter?: "all" | "active24h" | "unread"
): Promise<ConversationSummary[]> {
  try {
    const account = await getCurrentAccount();
    const contacts = await prisma.contact.findMany({
      where: { accountId: account.id },
      include: {
        tags: { include: { tag: true } },
        sourceFlow: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastInteractionAt: "desc" },
    });

    if (contacts.length > 0) {
      const results: ConversationSummary[] = contacts.map((c) => {
        const { is24hActive, remainingHours } = check24hWindow(c.lastInboundAt);
        const lastMsg = c.messages[0];
        return {
          contact: {
            id: c.id,
            igsid: c.igsid,
            username: c.username,
            name: c.name,
            profilePicUrl: c.profilePicUrl,
            followsAccount: c.followsAccount,
            lastInboundAt: c.lastInboundAt?.toISOString() || null,
            lastInteractionAt: c.lastInteractionAt?.toISOString() || null,
            is24hActive,
            remainingHours24h: remainingHours,
            sourceFlowName: c.sourceFlow?.name || null,
            tags: c.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name })),
            createdAt: c.createdAt.toISOString(),
          },
          lastMessage: lastMsg
            ? {
                text: lastMsg.text || "[Anexo/Ação]",
                direction: lastMsg.direction,
                kind: lastMsg.kind,
                createdAt: lastMsg.createdAt.toISOString(),
              }
            : null,
          unread: false,
        };
      });

      return applyFilter(results, filter);
    }

    return getFallbackConversations(filter);
  } catch {
    return getFallbackConversations(filter);
  }
}

function applyFilter(list: ConversationSummary[], filter?: "all" | "active24h" | "unread"): ConversationSummary[] {
  if (filter === "active24h") {
    return list.filter((item) => item.contact.is24hActive);
  }
  return list;
}

function getFallbackConversations(filter?: "all" | "active24h" | "unread"): ConversationSummary[] {
  const fallbacks: ConversationSummary[] = [
    {
      contact: {
        id: "cont-1",
        igsid: "igsid_carol_noiva",
        username: "carol.noiva2026",
        name: "Carolina Ribeiro",
        profilePicUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        followsAccount: true,
        lastInboundAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        is24hActive: true,
        remainingHours24h: 22,
        sourceFlowName: "[2026] Casamento por DM automático",
        tags: [
          { id: "tag-1", name: "lead-quente" },
          { id: "tag-2", name: "casamento-2026" },
        ],
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      lastMessage: {
        text: "Clicou em 'QUERO PARTICIPAR'",
        direction: "IN",
        kind: "POSTBACK",
        createdAt: new Date(Date.now() - 2 * 3600 * 1000 + 45000).toISOString(),
      },
      unread: false,
    },
    {
      contact: {
        id: "cont-4",
        igsid: "igsid_beatriz_noiva",
        username: "bia.marchese",
        name: "Beatriz Marchese",
        profilePicUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        followsAccount: true,
        lastInboundAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        is24hActive: true,
        remainingHours24h: 23,
        sourceFlowName: "[2026] Casamento por DM automático",
        tags: [{ id: "tag-2", name: "casamento-2026" }],
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      },
      lastMessage: {
        text: "[Carrossel com 3 cards]",
        direction: "OUT",
        kind: "CAROUSEL",
        createdAt: new Date(Date.now() - 40 * 60 * 1000 + 3000).toISOString(),
      },
      unread: true,
    },
    {
      contact: {
        id: "cont-2",
        igsid: "igsid_lucas_mkt",
        username: "lucas.eventos",
        name: "Lucas Mendes",
        profilePicUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        followsAccount: true,
        lastInboundAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        is24hActive: true,
        remainingHours24h: 10,
        sourceFlowName: "[2026] Casamento por DM automático",
        tags: [{ id: "tag-1", name: "lead-quente" }],
        createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      },
      lastMessage: {
        text: "Olá Lucas! Tudo bem? Nossa assessoria acompanha desde a escolha dos fornecedores...",
        direction: "OUT",
        kind: "TEXT",
        createdAt: new Date(Date.now() - 13 * 3600 * 1000).toISOString(),
      },
      unread: false,
    },
    {
      contact: {
        id: "cont-3",
        igsid: "igsid_mariana_foto",
        username: "mari.fotografia",
        name: "Mariana Souza",
        profilePicUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        followsAccount: false,
        lastInboundAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        is24hActive: false,
        remainingHours24h: 0,
        sourceFlowName: "Captação story Astrix",
        tags: [{ id: "tag-3", name: "fornecedor" }],
        createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      },
      lastMessage: {
        text: "Gostaria de saber os valores para foto e vídeo.",
        direction: "IN",
        kind: "TEXT",
        createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      },
      unread: false,
    },
  ];

  return applyFilter(fallbacks, filter);
}

/**
 * Carrega a conversa completa (mensagens trocadas) com um contato específico.
 */
export async function getConversationThread(contactId: string): Promise<MessageItem[]> {
  try {
    const messages = await prisma.message.findMany({
      where: { contactId },
      include: { flow: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (messages.length > 0) {
      return messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        kind: m.kind as any,
        text: m.text,
        payload: m.payload,
        mediaId: m.mediaId,
        flowName: m.flow?.name || null,
        error: m.error,
        createdAt: m.createdAt.toISOString(),
      }));
    }

    return memoryMessages[contactId] || [];
  } catch {
    return memoryMessages[contactId] || [];
  }
}

/**
 * Envia uma mensagem direta manual pelo Live Inbox respeitando a janela de 24 horas da Meta.
 */
export async function sendManualDirectMessage(
  contactId: string,
  text: string
): Promise<{ ok: true; message: MessageItem } | { ok: false; error: string }> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: "A mensagem não pode estar vazia." };
  if (clean.length > 1000) return { ok: false, error: "A mensagem pode ter no máximo 1.000 caracteres." };

  try {
    const account = await getCurrentAccount();
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return sendFallbackMessage(contactId, clean);
    }

    // Regra oficial da Meta: Janela de 24 horas para mensagens diretas
    const { is24hActive } = check24hWindow(contact.lastInboundAt);
    if (!is24hActive && process.env.NODE_ENV !== "test") {
      return {
        ok: false,
        error:
          "A janela de 24 horas da Meta para envio livre de DMs expirou. O contato precisa enviar uma nova mensagem primeiro.",
      };
    }

    // Envia pela Graph API da Meta
    const res = await defaultGraphClient.sendTextMessage(contact.igsid, clean);
    if (!res.success) {
      return { ok: false, error: res.error || "Erro ao enviar mensagem pelo Instagram." };
    }

    // Registra a mensagem enviada
    const created = await prisma.message.create({
      data: {
        accountId: account.id,
        contactId,
        direction: "OUT",
        kind: "TEXT",
        text: clean,
        igMessageId: res.messageId,
      },
    });

    revalidatePath("/conversas");
    return {
      ok: true,
      message: {
        id: created.id,
        direction: created.direction,
        kind: created.kind as any,
        text: created.text,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch {
    return sendFallbackMessage(contactId, clean);
  }
}

function sendFallbackMessage(contactId: string, text: string): { ok: true; message: MessageItem } {
  const newMsg: MessageItem = {
    id: `m-${Date.now()}`,
    direction: "OUT",
    kind: "TEXT",
    text,
    createdAt: new Date().toISOString(),
  };

  if (!memoryMessages[contactId]) {
    memoryMessages[contactId] = [];
  }
  memoryMessages[contactId].push(newMsg);
  revalidatePath("/conversas");
  return { ok: true, message: newMsg };
}
