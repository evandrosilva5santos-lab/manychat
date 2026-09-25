"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export type CardButtonType = "URL" | "POSTBACK";

export type CatalogItemInput = {
  title: string;
  description?: string;
  imageUrl: string;
  buttonTitle: string;
  buttonType: CardButtonType;
  buttonUrl?: string;
};

export type CatalogItemWithUsages = {
  id: string;
  accountId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  buttonTitle: string;
  buttonType: CardButtonType;
  buttonUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  usages: { id: string; flowName: string }[];
};

// Fallback em memória para teste offline quando o banco de dados remoto não estiver conectado
let memoryCatalog: CatalogItemWithUsages[] = [
  {
    id: "card-1",
    accountId: "demo-account",
    title: "Pacote Casamento Completo 2026",
    description: "Cerimônia exclusiva, buffet completo e assessoria premium.",
    imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
    buttonTitle: "QUERO ESTE PACOTE",
    buttonType: "POSTBACK",
    buttonUrl: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
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
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
    usageCount: 1,
    usages: [{ id: "u-3", flowName: "[2026] Casamento por DM automático" }],
  },
  {
    id: "card-3",
    accountId: "demo-account",
    title: "Agendamento com a Equipe Moving",
    description: "Converse por WhatsApp com nossos especialistas em casamentos.",
    imageUrl: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80",
    buttonTitle: "FALAR NO WHATSAPP",
    buttonType: "URL",
    buttonUrl: "https://wa.me/5551994044194?text=Oi%21%20Quero%20agendar%20uma%20reuniao%20sobre%20o%20casamento",
    createdAt: new Date("2026-01-03"),
    updatedAt: new Date("2026-01-03"),
    usageCount: 0,
    usages: [],
  },
];

function validateInput(input: CatalogItemInput): string | null {
  if (!input.title || input.title.trim().length === 0) {
    return "O título do card é obrigatório.";
  }
  if (input.title.length > 80) {
    return "O título pode ter no máximo 80 caracteres (regra da Meta).";
  }
  if (input.description && input.description.length > 80) {
    return "A descrição pode ter no máximo 80 caracteres (regra da Meta).";
  }
  if (!input.imageUrl || !input.imageUrl.trim()) {
    return "A URL da imagem é obrigatória.";
  }
  if (!input.buttonTitle || input.buttonTitle.trim().length === 0) {
    return "O texto do botão é obrigatório.";
  }
  if (input.buttonTitle.length > 20) {
    return "O texto do botão pode ter no máximo 20 caracteres.";
  }
  if (input.buttonType === "URL") {
    if (!input.buttonUrl || !input.buttonUrl.trim().startsWith("http")) {
      return "Informe um link válido começando com http:// ou https://";
    }
  }
  return null;
}

/**
 * Lista todos os itens do catálogo da conta atual com a contagem de usos em fluxos.
 */
export async function listCatalogItems(): Promise<CatalogItemWithUsages[]> {
  try {
    const account = await getCurrentAccount();
    const items = await prisma.catalogItem.findMany({
      where: { accountId: account.id },
      include: {
        usages: {
          include: {
            node: {
              include: {
                flow: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (items.length > 0) {
      return items.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        buttonTitle: item.buttonTitle,
        buttonType: item.buttonType as CardButtonType,
        buttonUrl: item.buttonUrl,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        usageCount: item.usages.length,
        usages: item.usages.map((u) => ({
          id: u.id,
          flowName: u.node?.flow?.name || "Fluxo sem nome",
        })),
      }));
    }
    return memoryCatalog;
  } catch (err) {
    console.warn("Usando catálogo em memória devido a erro de conexão no banco:", err);
    return memoryCatalog;
  }
}

/**
 * Cria um novo card reutilizável no catálogo.
 */
export async function createCatalogItem(
  input: CatalogItemInput
): Promise<{ ok: true; item: CatalogItemWithUsages } | { ok: false; error: string }> {
  const error = validateInput(input);
  if (error) return { ok: false, error };

  const sanitized = {
    title: input.title.trim().slice(0, 80),
    description: input.description?.trim().slice(0, 80) || null,
    imageUrl: input.imageUrl.trim(),
    buttonTitle: input.buttonTitle.trim().slice(0, 20).toUpperCase(),
    buttonType: input.buttonType,
    buttonUrl: input.buttonType === "URL" ? input.buttonUrl?.trim() || null : null,
  };

  try {
    const account = await getCurrentAccount();
    const created = await prisma.catalogItem.create({
      data: {
        accountId: account.id,
        ...sanitized,
      },
    });

    const result: CatalogItemWithUsages = {
      ...created,
      buttonType: created.buttonType as CardButtonType,
      usageCount: 0,
      usages: [],
    };
    revalidatePath("/catalogo");
    return { ok: true, item: result };
  } catch {
    const mockItem: CatalogItemWithUsages = {
      id: `card-${Date.now()}`,
      accountId: "demo-account",
      ...sanitized,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      usages: [],
    };
    memoryCatalog.unshift(mockItem);
    revalidatePath("/catalogo");
    return { ok: true, item: mockItem };
  }
}

/**
 * Atualiza um card existente no catálogo. Todos os carrosséis que o utilizam refletirão as mudanças.
 */
export async function updateCatalogItem(
  id: string,
  input: CatalogItemInput
): Promise<{ ok: true; item: CatalogItemWithUsages } | { ok: false; error: string }> {
  const error = validateInput(input);
  if (error) return { ok: false, error };

  const sanitized = {
    title: input.title.trim().slice(0, 80),
    description: input.description?.trim().slice(0, 80) || null,
    imageUrl: input.imageUrl.trim(),
    buttonTitle: input.buttonTitle.trim().slice(0, 20).toUpperCase(),
    buttonType: input.buttonType,
    buttonUrl: input.buttonType === "URL" ? input.buttonUrl?.trim() || null : null,
  };

  try {
    const updated = await prisma.catalogItem.update({
      where: { id },
      data: sanitized,
      include: {
        usages: {
          include: {
            node: {
              include: {
                flow: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const result: CatalogItemWithUsages = {
      ...updated,
      buttonType: updated.buttonType as CardButtonType,
      usageCount: updated.usages.length,
      usages: updated.usages.map((u) => ({
        id: u.id,
        flowName: u.node?.flow?.name || "Fluxo sem nome",
      })),
    };
    revalidatePath("/catalogo");
    return { ok: true, item: result };
  } catch {
    const idx = memoryCatalog.findIndex((c) => c.id === id);
    if (idx !== -1) {
      memoryCatalog[idx] = {
        ...memoryCatalog[idx],
        ...sanitized,
        updatedAt: new Date(),
      };
      revalidatePath("/catalogo");
      return { ok: true, item: memoryCatalog[idx] };
    }
    return { ok: false, error: "Card não encontrado no catálogo." };
  }
}

/**
 * Exclui um card do catálogo.
 * Se o card estiver sendo usado em algum carrossel, a exclusão é bloqueada para não quebrar fluxos ativos.
 */
export async function deleteCatalogItem(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const item = await prisma.catalogItem.findUnique({
      where: { id },
      include: {
        usages: {
          include: {
            node: {
              include: {
                flow: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (item && item.usages.length > 0) {
      const flowNames = item.usages.map((u) => u.node?.flow?.name).filter(Boolean);
      return {
        ok: false,
        error: `Este card não pode ser excluído porque está em uso em ${item.usages.length} carrossel(is): ${flowNames.slice(0, 3).join(", ")}. Remova-o dos fluxos antes de excluir.`,
      };
    }

    await prisma.catalogItem.delete({ where: { id } });
    revalidatePath("/catalogo");
    return { ok: true };
  } catch {
    const idx = memoryCatalog.findIndex((c) => c.id === id);
    if (idx !== -1) {
      if (memoryCatalog[idx].usageCount > 0) {
        return {
          ok: false,
          error: `Este card está em uso em ${memoryCatalog[idx].usageCount} fluxo(s) e não pode ser excluído para evitar quebrar carrosséis ativos.`,
        };
      }
      memoryCatalog.splice(idx, 1);
      revalidatePath("/catalogo");
      return { ok: true };
    }
    return { ok: false, error: "Card não encontrado." };
  }
}
