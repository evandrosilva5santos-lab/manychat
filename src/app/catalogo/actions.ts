"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { invalidIdMessage } from "@/lib/validation";
import { isSafeHttpsUrl } from "@/lib/links/tracked";
import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { actionErrorMessage } from "@/lib/user-error";

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
  if (!input.imageUrl || !isSafeHttpsUrl(input.imageUrl.trim())) {
    return "Informe a URL da imagem começando com https://";
  }
  if (!input.buttonTitle || input.buttonTitle.trim().length === 0) {
    return "O texto do botão é obrigatório.";
  }
  if (input.buttonTitle.length > 20) {
    return "O texto do botão pode ter no máximo 20 caracteres.";
  }
  if (input.buttonType === "URL") {
    if (!input.buttonUrl || !isSafeHttpsUrl(input.buttonUrl.trim())) {
      return "Informe um link válido começando com https://";
    }
  }
  return null;
}

/**
 * Lista todos os itens do catálogo da conta atual com a contagem de usos em fluxos.
 */
export async function listCatalogItems(): Promise<CatalogItemWithUsages[]> {
  await requireAuth();
  try {
    const account = await getCurrentAccount();
    if (!account) return [];

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
  } catch (err) {
    console.error("[catalogo] Erro ao listar itens:", err);
    return [];
  }
}

/**
 * Cria um novo card reutilizável no catálogo.
 */
export async function createCatalogItem(
  input: CatalogItemInput
): Promise<{ ok: true; item: CatalogItemWithUsages } | { ok: false; error: string }> {
  await requireAuth();
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
    if (!account) {
      return { ok: false, error: "Nenhuma conta conectada. Conecte sua conta em Ajustes." };
    }

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
  } catch (err) {
    console.error("[catalogo] Erro ao criar item:", err);
    return { ok: false, error: actionErrorMessage(err, "Falha ao salvar item no banco de dados.") };
  }
}

/**
 * Atualiza um card existente no catálogo. Todos os carrosséis que o utilizam refletirão as mudanças.
 */
export async function updateCatalogItem(
  id: string,
  input: CatalogItemInput
): Promise<{ ok: true; item: CatalogItemWithUsages } | { ok: false; error: string }> {
  await requireAuth();
  const invalidInput = invalidIdMessage(id);
  if (invalidInput) return { ok: false, error: invalidInput };

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
    if (!account) return { ok: false, error: "Nenhuma conta ativa." };
    const owned = await prisma.catalogItem.findFirst({ where: { id, accountId: account.id }, select: { id: true } });
    if (!owned) return { ok: false, error: "Card não encontrado nesta conta." };
    const updated = await prisma.catalogItem.update({
      where: { id: owned.id },
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
  } catch (err) {
    console.error("[catalogo] Erro ao atualizar item:", err);
    return { ok: false, error: actionErrorMessage(err, "Falha ao atualizar card no banco de dados.") };
  }
}

/**
 * Exclui um card do catálogo.
 * Se o card estiver sendo usado em algum carrossel, a exclusão é bloqueada para não quebrar fluxos ativos.
 */
export async function deleteCatalogItem(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth();
  const invalidInput = invalidIdMessage(id);
  if (invalidInput) return { ok: false, error: invalidInput };

  try {
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhuma conta ativa." };
    const item = await prisma.catalogItem.findFirst({
      where: { id, accountId: account.id },
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

    if (!item) return { ok: false, error: "Card não encontrado nesta conta." };
    await prisma.catalogItem.delete({ where: { id: item.id } });
    revalidatePath("/catalogo");
    return { ok: true };
  } catch (err) {
    console.error("[catalogo] Erro ao excluir item:", err);
    return { ok: false, error: actionErrorMessage(err, "Falha ao excluir card do banco de dados.") };
  }
}
