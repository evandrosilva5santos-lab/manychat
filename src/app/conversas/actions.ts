"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { invalidIdMessage } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { defaultGraphClient } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";
import { type ContactListItem } from "@/app/contatos/actions";
import { check24hWindow } from "@/lib/meta/window";

// Conversas usa SOMENTE dados reais (Postgres + Graph API da Meta).
// Sem fallback para arquivo local ou dados de demonstração: se o banco
// falhar, o erro aparece na tela em vez de mostrar contatos fictícios.

const MAX_MESSAGE_LENGTH = 1000;
const CONVERSATIONS_LIMIT = 200;
const THREAD_LIMIT = 500;

export type MessagePayload = {
  buttons?: { title: string; type?: string; url?: string }[];
  cards?: { title: string; buttonTitle?: string }[];
  title?: string;
} | null;

export type MessageItem = {
  id: string;
  direction: "IN" | "OUT";
  kind: "TEXT" | "BUTTONS" | "CAROUSEL" | "POSTBACK" | "COMMENT" | "COMMENT_REPLY" | "STORY_REPLY" | "MEDIA";
  text: string | null;
  payload?: MessagePayload;
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

export type ThreadResult = { ok: true; messages: MessageItem[] } | { ok: false; error: string };

/**
 * Lista as conversas reais da conta conectada para a coluna lateral do Live Inbox.
 * Lança erro se o banco estiver indisponível (a página mostra o aviso).
 *
 * `cursor` (ISO da última lastInteractionAt vista) habilita paginação
 * keyset — sem OFFSET que degrada com volume.
 */
export async function listConversations(
  filter?: "all" | "active24h" | "unread",
  cursor?: string
): Promise<ConversationSummary[]> {
  await requireAuth();
  const account = await getCurrentAccount();
  const contacts = await prisma.contact.findMany({
    where: {
      accountId: account.id,
      ...(cursor ? { lastInteractionAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      tags: { include: { tag: true } },
      sourceFlow: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastInteractionAt: "desc" },
    take: CONVERSATIONS_LIMIT,
  });

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

  return filter === "active24h" ? results.filter((item) => item.contact.is24hActive) : results;
}

/**
 * Carrega as mensagens reais trocadas com um contato da conta conectada.
 */
export async function getConversationThread(contactId: string): Promise<ThreadResult> {
  await requireAuth();
  const invalidInput = invalidIdMessage(contactId);
  if (invalidInput) return { ok: false, error: invalidInput };
  try {
    const account = await getCurrentAccount();
    const messages = await prisma.message.findMany({
      where: { contactId, accountId: account.id },
      include: { flow: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: THREAD_LIMIT,
    });

    return {
      ok: true,
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        kind: m.kind as MessageItem["kind"],
        text: m.text,
        payload: m.payload as MessagePayload,
        mediaId: m.mediaId,
        flowName: m.flow?.name || null,
        error: m.error,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error("[conversas] Falha ao carregar mensagens", err);
    return { ok: false, error: "Não foi possível carregar as mensagens. Verifique a conexão com o banco de dados." };
  }
}

/**
 * Envia uma DM manual pela Graph API respeitando a janela de 24 horas da Meta.
 * Só registra a mensagem se a Meta confirmar o envio.
 */
export async function sendManualDirectMessage(
  contactId: string,
  text: string
): Promise<{ ok: true; message: MessageItem } | { ok: false; error: string }> {
  await requireAuth();
  const invalidInput = invalidIdMessage(contactId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const clean = text.trim();
  if (!clean) return { ok: false, error: "A mensagem não pode estar vazia." };
  if (clean.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "A mensagem pode ter no máximo 1.000 caracteres." };
  }

  try {
    const account = await getCurrentAccount();
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, accountId: account.id },
    });
    if (!contact) {
      return { ok: false, error: "Contato não encontrado nesta conta." };
    }

    // Regra oficial da Meta: só é permitido enviar DM livre até 24h após a última mensagem do seguidor.
    const { is24hActive } = check24hWindow(contact.lastInboundAt);
    if (!is24hActive) {
      return {
        ok: false,
        error: "Passaram mais de 24h desde a última mensagem deste seguidor. Pela regra da Meta, ele precisa mandar uma nova mensagem antes.",
      };
    }

    const res = await defaultGraphClient.sendTextMessage(contact.igsid, clean);
    if (!res.success || res.mock) {
      return {
        ok: false,
        error: res.mock
          ? "Instagram não conectado: configure o token de acesso em Ajustes para enviar mensagens reais."
          : res.error || "O Instagram recusou o envio da mensagem.",
      };
    }

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
        kind: created.kind as MessageItem["kind"],
        text: created.text,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err) {
    console.error("[conversas] Falha ao enviar DM manual", err);
    return { ok: false, error: "Erro ao enviar a mensagem. Tente novamente em instantes." };
  }
}
