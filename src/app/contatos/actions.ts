"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { check24hWindow } from "@/lib/meta/window";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");

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

// Fallback de contatos para desenvolvimento/apresentação offline
let memoryContacts: ContactListItem[] = [
  {
    id: "cont-1",
    igsid: "igsid_carol_noiva",
    username: "carol.noiva2026",
    name: "Carolina Ribeiro",
    profilePicUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    followsAccount: true,
    lastInboundAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2h atrás (janela aberta)
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
  {
    id: "cont-2",
    igsid: "igsid_lucas_mkt",
    username: "lucas.eventos",
    name: "Lucas Mendes",
    profilePicUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    followsAccount: true,
    lastInboundAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(), // 14h atrás (janela aberta)
    lastInteractionAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    is24hActive: true,
    remainingHours24h: 10,
    sourceFlowName: "[2026] Casamento por DM automático",
    tags: [{ id: "tag-1", name: "lead-quente" }],
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
  },
  {
    id: "cont-3",
    igsid: "igsid_mariana_foto",
    username: "mari.fotografia",
    name: "Mariana Souza",
    profilePicUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    followsAccount: false,
    lastInboundAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), // 36h atrás (janela expirada)
    lastInteractionAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    is24hActive: false,
    remainingHours24h: 0,
    sourceFlowName: "Captação story Astrix",
    tags: [{ id: "tag-3", name: "fornecedor" }],
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  },
  {
    id: "cont-4",
    igsid: "igsid_beatriz_noiva",
    username: "bia.marchese",
    name: "Beatriz Marchese",
    profilePicUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    followsAccount: true,
    lastInboundAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40m atrás
    lastInteractionAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    is24hActive: true,
    remainingHours24h: 23,
    sourceFlowName: "[2026] Casamento por DM automático",
    tags: [{ id: "tag-2", name: "casamento-2026" }],
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
];

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

    // Se o banco estiver vazio ou offline, usa storage local
    const stored = await readStoredContacts();
    return filterMemoryContacts(stored, params);
  } catch {
    const stored = await readStoredContacts();
    return filterMemoryContacts(stored, params);
  }
}

function filterMemoryContacts(
  list: ContactListItem[],
  params: {
    search?: string;
    tagId?: string;
    followFilter?: "all" | "following" | "not_following";
  }
): ContactListItem[] {
  return list.filter((c) => {
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
    const contact = memoryContacts.find((c) => c.id === contactId);
    const tag = memoryTags.find((t) => t.id === tagId);
    if (contact && tag) {
      if (!contact.tags.some((t) => t.id === tagId)) {
        contact.tags.push(tag);
      }
      return { ok: true };
    }
    return { ok: false, error: "Contato ou etiqueta não encontrada." };
  }
}

async function readStoredContacts(): Promise<ContactListItem[]> {
  try {
    const raw = await fs.readFile(CONTACTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return memoryContacts;
}

async function writeStoredContacts(list: ContactListItem[]) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
    await fs.writeFile(CONTACTS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar contatos:", err);
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

    const current = await readStoredContacts();
    current.unshift(newContact);
    memoryContacts = current;
    await writeStoredContacts(current);

    revalidatePath("/contatos");
    revalidatePath("/conversas");
    revalidatePath("/");

    return { ok: true, contact: newContact };
  } catch (err: any) {
    return { ok: false, error: err.message || "Erro ao criar contato." };
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
    const contact = memoryContacts.find((c) => c.id === contactId);
    if (contact) {
      contact.tags = contact.tags.filter((t) => t.id !== tagId);
      return { ok: true };
    }
    return { ok: false, error: "Contato não encontrado." };
  }
}
