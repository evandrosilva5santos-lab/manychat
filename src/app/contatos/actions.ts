"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { invalidIdMessage } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { check24hWindow } from "@/lib/meta/window";

const CONTACTS_LIMIT = 200;

export type ContactListItem = {
  id: string;
  igsid: string;
  username: string | null;
  name: string | null;
  profilePicUrl: string | null;
  followsAccount: boolean | null;
  lastInboundAt: string | null;
  lastInteractionAt: string | null;
  is24hActive: boolean;
  remainingHours24h: number;
  sourceFlowName: string | null;
  tags: { id: string; name: string }[];
  createdAt: string;
};

/**
 * Lista contatos com filtros por texto, etiqueta e status de seguidor.
 */
export async function listContacts(params: {
  search?: string;
  tagId?: string;
  followFilter?: "all" | "following" | "not_following";
  /** ISO da última lastInteractionAt vista — paginação keyset. */
  cursor?: string;
}): Promise<ContactListItem[]> {
  await requireAuth();
  try {
    const account = await getCurrentAccount();
    if (!account) return [];

    const where: any = { accountId: account.id };

    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: "insensitive" } },
        { name: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.tagId) {
      where.tags = { some: { tagId: params.tagId } };
    }

    if (params.followFilter === "following") {
      where.followsAccount = true;
    } else if (params.followFilter === "not_following") {
      where.followsAccount = false;
    }

    const contacts = await prisma.contact.findMany({
      where: {
        ...where,
        ...(params.cursor ? { lastInteractionAt: { lt: new Date(params.cursor) } } : {}),
      },
      include: {
        tags: { include: { tag: true } },
        sourceFlow: { select: { name: true } },
      },
      orderBy: { lastInteractionAt: "desc" },
      take: CONTACTS_LIMIT,
    });

    return contacts.map((c) => {
      const { is24hActive, remainingHours } = check24hWindow(c.lastInboundAt);
      return {
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
      };
    });
  } catch (error) {
    console.error("[contatos] Erro ao listar contatos no Postgres:", error);
    return [];
  }
}

/**
 * Lista todas as etiquetas existentes para os filtros.
 */
export async function listAllTags(): Promise<{ id: string; name: string }[]> {
  await requireAuth();
  try {
    const account = await getCurrentAccount();
    if (!account) return [];

    return await prisma.tag.findMany({
      where: { accountId: account.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("[contatos] Erro ao listar tags no Postgres:", error);
    return [];
  }
}

/**
 * Cria um novo contato/lead manualmente para CRM
 */
export async function createContact(data: {
  name: string;
  username: string;
  followsAccount?: boolean;
  tagId?: string;
}): Promise<{ ok: true; contact: ContactListItem } | { ok: false; error: string }> {
  await requireAuth();
  try {
    const cleanName = data.name.trim();
    const cleanUsername = data.username.trim().replace(/^@/, "");

    if (!cleanName || !cleanUsername) {
      return { ok: false, error: "Nome e @username são obrigatórios." };
    }

    const account = await getCurrentAccount();
    if (!account) {
      return { ok: false, error: "Nenhuma conta conectada. Conecte sua conta em Ajustes." };
    }

    const igsid = `igsid_${cleanUsername}_${Date.now()}`;
    const now = new Date();

    const created = await prisma.contact.create({
      data: {
        accountId: account.id,
        igsid,
        username: cleanUsername,
        name: cleanName,
        profilePicUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
        followsAccount: data.followsAccount ?? true,
        lastInboundAt: now,
        lastInteractionAt: now,
      },
    });

    if (data.tagId) {
      const tag = await prisma.tag.findFirst({
        where: { id: data.tagId, accountId: account.id },
        select: { id: true },
      });
      if (tag) {
        await prisma.contactTag.create({
          data: { contactId: created.id, tagId: tag.id },
        });
      }
    }

    const fullContact = await prisma.contact.findUnique({
      where: { id: created.id },
      include: {
        tags: { include: { tag: true } },
        sourceFlow: { select: { name: true } },
      },
    });

    if (!fullContact) {
      return { ok: false, error: "Erro ao carregar contato recém-criado." };
    }

    const { is24hActive, remainingHours } = check24hWindow(fullContact.lastInboundAt);
    const item: ContactListItem = {
      id: fullContact.id,
      igsid: fullContact.igsid,
      username: fullContact.username,
      name: fullContact.name,
      profilePicUrl: fullContact.profilePicUrl,
      followsAccount: fullContact.followsAccount,
      lastInboundAt: fullContact.lastInboundAt?.toISOString() || null,
      lastInteractionAt: fullContact.lastInteractionAt?.toISOString() || null,
      is24hActive,
      remainingHours24h: remainingHours,
      sourceFlowName: fullContact.sourceFlow?.name || null,
      tags: fullContact.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name })),
      createdAt: fullContact.createdAt.toISOString(),
    };

    revalidatePath("/contatos");
    revalidatePath("/conversas");
    revalidatePath("/");

    return { ok: true, contact: item };
  } catch (err: any) {
    console.error("[contatos] Erro ao criar contato:", err);
    return { ok: false, error: err?.message || "Erro ao criar contato no banco de dados." };
  }
}

/**
 * Adiciona uma etiqueta a um contato.
 */
export async function addTagToContact(
  contactId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth();
  const invalidInput = invalidIdMessage(contactId, tagId);
  if (invalidInput) return { ok: false, error: invalidInput };

  try {
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhuma conta ativa." };
    const [contact, tag] = await Promise.all([
      prisma.contact.findFirst({ where: { id: contactId, accountId: account.id }, select: { id: true } }),
      prisma.tag.findFirst({ where: { id: tagId, accountId: account.id }, select: { id: true } }),
    ]);
    if (!contact || !tag) return { ok: false, error: "Contato ou etiqueta não pertence à conta ativa." };
    await prisma.contactTag.upsert({
      where: {
        contactId_tagId: { contactId, tagId },
      },
      update: {},
      create: { contactId, tagId },
    });
    revalidatePath("/contatos");
    revalidatePath("/conversas");
    return { ok: true };
  } catch (err: any) {
    console.error("[contatos] Erro ao adicionar tag:", err);
    return { ok: false, error: err?.message || "Erro ao adicionar etiqueta." };
  }
}

/**
 * Remove uma etiqueta de um contato.
 */
export async function removeTagFromContact(
  contactId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth();
  const invalidInput = invalidIdMessage(contactId, tagId);
  if (invalidInput) return { ok: false, error: invalidInput };

  try {
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhuma conta ativa." };
    const removed = await prisma.contactTag.deleteMany({
      where: { contactId, tagId, contact: { accountId: account.id }, tag: { accountId: account.id } },
    });
    if (removed.count === 0) return { ok: false, error: "Etiqueta não encontrada nesta conta." };
    revalidatePath("/contatos");
    revalidatePath("/conversas");
    return { ok: true };
  } catch (err: any) {
    console.error("[contatos] Erro ao remover tag:", err);
    return { ok: false, error: err?.message || "Erro ao remover etiqueta." };
  }
}
