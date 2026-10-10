"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { check24hWindow } from "@/lib/meta/window";
import { getStoredContacts, updateStoredContactTags, addStoredContact } from "@/lib/storage/store";

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

let memoryTags = [
  { id: "tag-1", name: "lead-quente" },
  { id: "tag-2", name: "casamento-2026" },
  { id: "tag-3", name: "fornecedor" },
  { id: "tag-4", name: "vip" },
];

/**
 * Lista contatos com filtros por texto, etiqueta e status de seguidor.
 */
export async function listContacts(params: {
  search?: string;
  tagId?: string;
  followFilter?: "all" | "following" | "not_following";
}): Promise<ContactListItem[]> {
  try {
    const account = await getCurrentAccount();
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
      where,
      include: {
        tags: { include: { tag: true } },
        sourceFlow: { select: { name: true } },
      },
      orderBy: { lastInteractionAt: "desc" },
    });

    if (contacts.length > 0) {
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
    }

    return await filterMemoryContacts(params);
  } catch {
    return await filterMemoryContacts(params);
  }
}

async function filterMemoryContacts(params: {
  search?: string;
  tagId?: string;
  followFilter?: "all" | "following" | "not_following";
}): Promise<ContactListItem[]> {
  const contacts = await getStoredContacts();
  return contacts.filter((c) => {
    if (params.search) {
      const q = params.search.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchUser = c.username?.toLowerCase().includes(q);
      if (!matchName && !matchUser) return false;
    }
    if (params.tagId) {
      if (!c.tags.some((t) => t.id === params.tagId)) return false;
    }
    if (params.followFilter === "following" && !c.followsAccount) return false;
    if (params.followFilter === "not_following" && c.followsAccount) return false;
    return true;
  });
}

/**
 * Lista todas as etiquetas existentes para os filtros.
 */
export async function listAllTags(): Promise<{ id: string; name: string }[]> {
  try {
    const account = await getCurrentAccount();
    const tags = await prisma.tag.findMany({
      where: { accountId: account.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (tags.length > 0) return tags;
    return memoryTags;
  } catch {
    return memoryTags;
  }
}

/**
 * Cria um novo contato/lead manualmente para teste ou CRM
 */
export async function createContact(data: {
  name: string;
  username: string;
  followsAccount?: boolean;
  tagId?: string;
}): Promise<{ ok: true; contact: ContactListItem } | { ok: false; error: string }> {
  try {
    const cleanName = data.name.trim();
    const cleanUsername = data.username.trim().replace(/^@/, "");

    if (!cleanName || !cleanUsername) {
      return { ok: false, error: "Nome e @username são obrigatórios." };
    }

    const account = await getCurrentAccount();
    const newId = `cont_${Date.now()}`;
    const igsid = `igsid_${cleanUsername}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const selectedTag = data.tagId ? memoryTags.find((t) => t.id === data.tagId) : null;
    const tags = selectedTag ? [selectedTag] : [{ id: "tag-1", name: "lead-quente" }];

    const newContact: ContactListItem = {
      id: newId,
      igsid,
      username: cleanUsername,
      name: cleanName,
      profilePicUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
      followsAccount: data.followsAccount ?? true,
      lastInboundAt: nowIso,
      lastInteractionAt: nowIso,
      is24hActive: true,
      remainingHours24h: 24,
      sourceFlowName: "Cadastro Manual (Teste)",
      tags,
      createdAt: nowIso,
    };

    try {
      await prisma.contact.create({
        data: {
          id: newId,
          accountId: account.id,
          igsid,
          username: cleanUsername,
          name: cleanName,
          followsAccount: newContact.followsAccount,
          lastInboundAt: new Date(),
          lastInteractionAt: new Date(),
        },
      });
    } catch {
      // Fallback local
    }

    await addStoredContact(newContact);

    revalidatePath("/contatos");
    revalidatePath("/conversas");
    revalidatePath("/");

    return { ok: true, contact: newContact };
  } catch (err: any) {
    return { ok: false, error: err.message || "Erro ao criar contato." };
  }
}

/**
 * Adiciona uma etiqueta a um contato.
 */
export async function addTagToContact(
  contactId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
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
  } catch {
    const contacts = await getStoredContacts();
    const contact = contacts.find((c) => c.id === contactId);
    const tag = memoryTags.find((t) => t.id === tagId);
    if (contact && tag) {
      if (!contact.tags.some((t) => t.id === tagId)) {
        contact.tags.push(tag);
        await updateStoredContactTags(contactId, contact.tags);
      }
      revalidatePath("/contatos");
      revalidatePath("/conversas");
      return { ok: true };
    }
    return { ok: false, error: "Contato ou etiqueta não encontrada." };
  }
}

/**
 * Remove uma etiqueta de um contato.
 */
export async function removeTagFromContact(
  contactId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.contactTag.delete({
      where: {
        contactId_tagId: { contactId, tagId },
      },
    });
    revalidatePath("/contatos");
    revalidatePath("/conversas");
    return { ok: true };
  } catch {
    const contacts = await getStoredContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      contact.tags = contact.tags.filter((t) => t.id !== tagId);
      await updateStoredContactTags(contactId, contact.tags);
      revalidatePath("/contatos");
      revalidatePath("/conversas");
      return { ok: true };
    }
    return { ok: false, error: "Contato não encontrado." };
  }
}
