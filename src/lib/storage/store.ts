import fs from "fs/promises";
import path from "path";
import type { FlowMode, FlowStatus } from "@/generated/prisma/enums";
import type { Recipe } from "@/lib/flow/recipe";
import { defaultRecipe } from "@/lib/flow/recipe";
import { prisma } from "@/lib/prisma";

export type StoredFlow = {
  id: string;
  accountId: string;
  name: string;
  folder: string | null;
  status: FlowStatus;
  mode: FlowMode;
  recipe?: Recipe | null;
  viewport?: any;
  nodes?: any[];
  edges?: any[];
  triggers?: any[];
  createdAt: string;
  updatedAt: string;
};

export type StoredContact = {
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
  sourceFlowId?: string | null;
  sourceFlowName: string | null;
  tags: { id: string; name: string }[];
  createdAt: string;
};

export type StoredMessage = {
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

export type StoredCatalogItem = {
  id: string;
  accountId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  buttonTitle: string;
  buttonType: "URL" | "POSTBACK";
  buttonUrl: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  usages: { id: string; flowName: string }[];
};

export type StoreData = {
  version: number;
  flows: StoredFlow[];
  contacts: StoredContact[];
  messages: Record<string, StoredMessage[]>;
  catalog: StoredCatalogItem[];
  tags: { id: string; name: string }[];
};

const INITIAL_DEMO_RECIPE: Recipe = {
  trigger: {
    scope: "any",
    matchType: "keywords",
    mediaId: "18042938491823901",
    mediaUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
    mediaCaption:
      "💍 O grande dia está chegando! As inscrições para a cerimônia do Casamento dos Sonhos 2026 na Moving estão abertas. Comente CASAMENTO para receber as informações e o link de inscrição no direct!",
    keywords: ["casamento", "quero casar"],
    publicReplies: {
      enabled: true,
      variations: [
        "Que bom que você vai casar na Moving! 💍 Te mandei no direct",
        "Aaaah, que alegria! 💍 Vai ser lindo! Olha o direct",
        "Que demais! 💍✨ Vem saber como participar, te chamei no direct",
      ],
    },
  },
  welcome: {
    enabled: true,
    text: "AAAAH! 💍✨\nQue bom saber que você quer casar na Moving!\n\nVou te passar todas as informações de como participar do casamento. 👇",
    buttonTitle: "QUERO PARTICIPAR",
  },
  followGate: {
    enabled: true,
    text: "Você ainda não está seguindo a Moving! 👀\n\nSiga o nosso perfil para receber as informações sobre o casamento de 2026. 💍✨",
    buttonTitle: "JÁ SEGUI",
  },
  link: {
    text: "AAAAH! 💍🥹\nEntão você também sonha em viver esse momento com a Moving!\n\nQuer saber como funciona a inscrição para o casamento? Vou te encaminhar para o WhatsApp da equipe. 👇",
    buttonTitle: "QUERO ME INSCREVER",
    url: "https://wa.me/5551994044194?text=Oi%21%20Vim%20pelo%20post%20do%20casamento%20da%20Moving%20e%20quero%20saber%20como%20me%20inscrever%20no%20casamento%20de%202026.",
  },
  reminder: {
    enabled: true,
    delaySeconds: 3600,
    text: "Seu acesso está esperando por você. 👀 Clique no link abaixo e entre no grupo.",
    buttonTitle: "QUERO ME INSCREVER",
  },
};

function getInitialStore(): StoreData {
  const now = new Date().toISOString();
  return {
    version: 1,
    flows: [
      {
        id: "demo-casamento",
        accountId: "demo-account",
        name: "[2026] Casamento por DM automático",
        folder: "Moving 2026",
        status: "LIVE",
        mode: "SIMPLE",
        recipe: INITIAL_DEMO_RECIPE,
        triggers: [
          {
            id: "trig-demo-1",
            type: "COMMENT_KEYWORD",
            keywords: ["casamento", "quero casar"],
            match: "CONTAINS",
            mediaId: "18042938491823901",
          },
        ],
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        updatedAt: now,
      },
    ],
    contacts: [
      {
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
        sourceFlowId: "demo-casamento",
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
        lastInboundAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        is24hActive: true,
        remainingHours24h: 10,
        sourceFlowId: "demo-casamento",
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
        lastInboundAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        is24hActive: false,
        remainingHours24h: 0,
        sourceFlowId: null,
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
        lastInboundAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        lastInteractionAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        is24hActive: true,
        remainingHours24h: 23,
        sourceFlowId: "demo-casamento",
        sourceFlowName: "[2026] Casamento por DM automático",
        tags: [{ id: "tag-2", name: "casamento-2026" }],
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      },
    ],
    messages: {
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
      ],
    },
    catalog: [
      {
        id: "card-1",
        accountId: "demo-account",
        title: "Pacote Casamento Completo 2026",
        description: "Cerimônia exclusiva, buffet completo e assessoria premium.",
        imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
        buttonTitle: "QUERO ESTE PACOTE",
        buttonType: "POSTBACK",
        buttonUrl: null,
        createdAt: new Date("2026-01-01").toISOString(),
        updatedAt: new Date("2026-01-01").toISOString(),
        usageCount: 2,
        usages: [
          { id: "u-1", flowName: "[2026] Casamento por DM automático" },
          { id: "u-2", flowName: "Captação story Astrix" },
        ],
      },
      {
        id: "card-2",
        accountId: "demo-account",
        title: "Assessoria & Decoração Floral",
        description: "Design floral assinado e coordenação completa do seu grande dia.",
        imageUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80",
        buttonTitle: "VER FOTOS REAIS",
        buttonType: "URL",
        buttonUrl: "https://movingfestival.com.br/fotos-decoracao",
        createdAt: new Date("2026-01-02").toISOString(),
        updatedAt: new Date("2026-01-02").toISOString(),
        usageCount: 1,
        usages: [{ id: "u-3", flowName: "[2026] Casamento por DM automático" }],
      },
    ],
    tags: [
      { id: "tag-1", name: "lead-quente" },
      { id: "tag-2", name: "casamento-2026" },
      { id: "tag-3", name: "fornecedor" },
      { id: "tag-4", name: "vip" },
    ],
  };
}

const PRIMARY_DATA_PATH = path.join(process.cwd(), ".data", "fluxo_db.json");
const FALLBACK_DATA_PATH = path.join("/tmp", "fluxo_db.json");

let memoryCache: StoreData | null = null;
let writeQueue = Promise.resolve();

async function getFilePath(): Promise<string> {
  try {
    const dir = path.dirname(PRIMARY_DATA_PATH);
    await fs.mkdir(dir, { recursive: true });
    return PRIMARY_DATA_PATH;
  } catch {
    return FALLBACK_DATA_PATH;
  }
}

/**
 * Lê os dados da persistência local com cache e integridade.
 */
export async function getStore(): Promise<StoreData> {
  if (memoryCache) return memoryCache;
  const filePath = await getFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as StoreData;
    if (data && data.flows && Array.isArray(data.flows)) {
      memoryCache = data;
      return memoryCache;
    }
  } catch {
    // Arquivo não existe ou corrompido, inicializa com os dados iniciais
  }

  const initial = getInitialStore();
  memoryCache = initial;
  await saveStore(initial);
  return memoryCache;
}

/**
 * Grava de forma atômica no arquivo local.
 */
export async function saveStore(data: StoreData): Promise<void> {
  memoryCache = data;
  writeQueue = writeQueue.then(async () => {
    try {
      const filePath = await getFilePath();
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tempPath, filePath);
    } catch (err) {
      console.error("[Storage] Falha ao persistir em disco:", err);
    }
  });
  await writeQueue;
}

export const readStore = getStore;
export const writeStore = saveStore;

/* ─────────────────────────────────────────────────────────────
 * Operações de Fluxos (Flows & Recipes)
 * ───────────────────────────────────────────────────────────── */

export async function getStoredFlow(id: string): Promise<StoredFlow | null> {
  const store = await getStore();
  return store.flows.find((f) => f.id === id) ?? null;
}

export async function listStoredFlows(): Promise<StoredFlow[]> {
  const store = await getStore();
  return [...store.flows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function saveStoredFlow(flow: StoredFlow): Promise<StoredFlow> {
  const store = await getStore();
  const index = store.flows.findIndex((f) => f.id === flow.id);
  const updatedFlow = { ...flow, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    store.flows[index] = updatedFlow;
  } else {
    store.flows.unshift(updatedFlow);
  }
  await saveStore(store);
  return updatedFlow;
}

export async function createStoredFlow(data: {
  name: string;
  mode: FlowMode;
  folder?: string | null;
  recipe?: Recipe;
}): Promise<StoredFlow> {
  const store = await getStore();
  const id = `flow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const recipe = data.mode === "SIMPLE" ? data.recipe || defaultRecipe() : undefined;
  const newFlow: StoredFlow = {
    id,
    accountId: "demo-account",
    name: data.name || (data.mode === "SIMPLE" ? "Nova automação rápida" : "Novo fluxo"),
    folder: data.folder ?? null,
    status: "DRAFT",
    mode: data.mode,
    recipe: recipe ?? null,
    triggers: recipe
      ? [
          {
            id: `trig_${id}`,
            type: "COMMENT_KEYWORD",
            keywords: recipe.trigger.keywords,
            match: "CONTAINS",
            mediaId: recipe.trigger.mediaId || null,
          },
        ]
      : [],
    createdAt: now,
    updatedAt: now,
  };

  store.flows.unshift(newFlow);
  await saveStore(store);
  return newFlow;
}

export async function updateStoredFlowStatus(id: string, status: FlowStatus): Promise<boolean> {
  const store = await getStore();
  const flow = store.flows.find((f) => f.id === id);
  if (!flow) return false;
  flow.status = status;
  flow.updatedAt = new Date().toISOString();
  await saveStore(store);
  return true;
}

export async function renameStoredFlow(id: string, name: string): Promise<boolean> {
  const store = await getStore();
  const flow = store.flows.find((f) => f.id === id);
  if (!flow) return false;
  flow.name = name;
  flow.updatedAt = new Date().toISOString();
  await saveStore(store);
  return true;
}

export async function duplicateStoredFlow(id: string): Promise<StoredFlow | null> {
  const store = await getStore();
  const original = store.flows.find((f) => f.id === id);
  if (!original) return null;

  const cloneId = `flow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const cloned: StoredFlow = {
    ...JSON.parse(JSON.stringify(original)),
    id: cloneId,
    name: `${original.name} (Cópia)`,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };

  store.flows.unshift(cloned);
  await saveStore(store);
  return cloned;
}

export async function deleteStoredFlow(id: string): Promise<boolean> {
  const store = await getStore();
  const initialLength = store.flows.length;
  store.flows = store.flows.filter((f) => f.id !== id);
  if (store.flows.length !== initialLength) {
    await saveStore(store);
    return true;
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────
 * Operações de Contatos e Mensagens (CRM & Live Inbox)
 * ───────────────────────────────────────────────────────────── */

export async function getStoredContacts(): Promise<StoredContact[]> {
  const store = await getStore();
  return store.contacts;
}

export async function updateStoredContactTags(
  contactId: string,
  tags: { id: string; name: string }[]
): Promise<boolean> {
  const store = await getStore();
  const contact = store.contacts.find((c) => c.id === contactId);
  if (!contact) return false;
  contact.tags = tags;
  await saveStore(store);
  return true;
}

export async function addStoredContact(contact: StoredContact): Promise<void> {
  const store = await getStore();
  const existingIndex = store.contacts.findIndex((c) => c.id === contact.id || c.igsid === contact.igsid);
  if (existingIndex >= 0) {
    store.contacts[existingIndex] = contact;
  } else {
    store.contacts.unshift(contact);
  }
  await saveStore(store);
}

export async function getStoredMessages(contactId: string): Promise<StoredMessage[]> {
  const store = await getStore();
  return store.messages[contactId] || [];
}

export async function addStoredMessage(contactId: string, message: StoredMessage): Promise<void> {
  const store = await getStore();
  if (!store.messages[contactId]) {
    store.messages[contactId] = [];
  }
  store.messages[contactId].push(message);

  // Atualiza última mensagem e interação do contato
  const contact = store.contacts.find((c) => c.id === contactId);
  if (contact) {
    contact.lastInteractionAt = message.createdAt;
  }
  await saveStore(store);
}

/* ─────────────────────────────────────────────────────────────
 * Operações de Catálogo
 * ───────────────────────────────────────────────────────────── */

export async function getStoredCatalog(): Promise<StoredCatalogItem[]> {
  const store = await getStore();
  return store.catalog;
}

export async function saveStoredCatalogItem(item: StoredCatalogItem): Promise<StoredCatalogItem> {
  const store = await getStore();
  const index = store.catalog.findIndex((c) => c.id === item.id);
  if (index >= 0) {
    store.catalog[index] = { ...item, updatedAt: new Date().toISOString() };
  } else {
    store.catalog.unshift({ ...item, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await saveStore(store);
  return item;
}

export async function deleteStoredCatalogItem(id: string): Promise<boolean> {
  const store = await getStore();
  const initialLength = store.catalog.length;
  store.catalog = store.catalog.filter((c) => c.id !== id);
  if (store.catalog.length !== initialLength) {
    await saveStore(store);
    return true;
  }
  return false;
}
