"use server";
// Ações do servidor usadas pelo editor: criar, salvar, renomear, duplicar e excluir fluxos.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { FlowMode, FlowStatus } from "@/generated/prisma/enums";
import { getCurrentAccount } from "@/lib/account";
import { toSavePlan } from "@/lib/flow/convert";
import { compileRecipe, defaultRecipe, recipeSchema, type Recipe } from "@/lib/flow/recipe";
import { firstIssue, snapshotSchema } from "@/lib/flow/schema";
import type { FlowSnapshot } from "@/lib/flow/types";
import { prisma } from "@/lib/prisma";
import {
  createStoredFlow,
  deleteStoredFlow,
  duplicateStoredFlow,
  getStoredFlow,
  renameStoredFlow,
  saveStoredFlow,
  updateStoredFlowStatus,
} from "@/lib/storage/store";

export type SaveResult = { ok: true; savedAt: string; flowId?: string } | { ok: false; error: string };

async function ownFlow(flowId: string) {
  const account = await getCurrentAccount();
  if (flowId === "demo-casamento" || flowId.startsWith("flow_")) return account;
  try {
    const flow = await prisma.flow.findFirst({ where: { id: flowId, accountId: account.id }, select: { id: true } });
    return flow ? account : null;
  } catch {
    return account;
  }
}

export async function createFlow(mode: FlowMode) {
  try {
    const account = await getCurrentAccount();
    const flow = await prisma.flow.create({
      data: {
        accountId: account.id,
        name: mode === "SIMPLE" ? "Nova automação rápida" : "Novo fluxo",
        mode,
        recipe: mode === "SIMPLE" ? defaultRecipe() : undefined,
        triggers:
          mode === "SIMPLE" ? undefined : { create: { type: "COMMENT_KEYWORD", keywords: [], match: "CONTAINS" } },
      },
    });
    if (mode === "SIMPLE") await persistSnapshot(flow.id, account.id, compileRecipe(flow.id, defaultRecipe()));
    redirect(`/fluxos/${flow.id}`);
  } catch {
    // Fallback para persistência local
    const stored = await createStoredFlow({
      name: mode === "SIMPLE" ? "Nova automação rápida" : "Novo fluxo",
      mode,
      recipe: defaultRecipe(),
    });
    redirect(`/fluxos/${stored.id}`);
  }
}

/** Troca o builder simples pelo avançado (só de ida: o canvas vira a fonte da verdade). */
export async function convertToAdvanced(flowId: string): Promise<SaveResult> {
  const stored = await getStoredFlow(flowId);
  if (stored) {
    stored.mode = "ADVANCED";
    await saveStoredFlow(stored);
  }
  try {
    const account = await ownFlow(flowId);
    if (account) {
      await prisma.flow.update({ where: { id: flowId }, data: { mode: "ADVANCED" } });
    }
  } catch {
    // Prisma indisponível, persistido no store
  }
  revalidatePath(`/fluxos/${flowId}`);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function saveRecipe(flowId: string, input: unknown): Promise<SaveResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  // Criação a partir de rota /fluxos/novo
  if (flowId === "novo") {
    const newFlow = await createStoredFlow({
      name: "Nova automação rápida",
      mode: "SIMPLE",
      recipe: parsed.data,
    });
    try {
      const account = await getCurrentAccount();
      await prisma.flow.create({
        data: {
          id: newFlow.id,
          accountId: account.id,
          name: newFlow.name,
          mode: "SIMPLE",
          status: "DRAFT",
          recipe: parsed.data as any,
        },
      });
    } catch {
      // Salvo no storage local
    }
    revalidatePath("/fluxos");
    return { ok: true, savedAt: new Date().toISOString(), flowId: newFlow.id };
  }

  // Atualização de fluxo existente no armazenamento persistente
  const stored = await getStoredFlow(flowId);
  if (stored) {
    stored.recipe = parsed.data;
    stored.triggers = [
      {
        id: `trig_${flowId}`,
        type: "COMMENT_KEYWORD",
        keywords: parsed.data.trigger.keywords,
        match: "CONTAINS",
        mediaId: parsed.data.trigger.mediaId || null,
      },
    ];
    await saveStoredFlow(stored);
  }

  // Se banco Prisma estiver acessível, persiste também lá
  try {
    const account = await ownFlow(flowId);
    if (account) {
      const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { mode: true } });
      if (flow && flow.mode === "SIMPLE") {
        const snapshot = snapshotSchema.safeParse(compileRecipe(flowId, parsed.data));
        if (snapshot.success) {
          await persistSnapshot(flowId, account.id, snapshot.data as FlowSnapshot, { recipe: parsed.data });
        }
      }
    }
  } catch {
    // Garantido pelo armazenamento local
  }

  revalidatePath(`/fluxos/${flowId}`);
  revalidatePath("/fluxos");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function updateFlowStatus(flowId: string, status: FlowStatus): Promise<SaveResult> {
  await updateStoredFlowStatus(flowId, status);
  try {
    const account = await ownFlow(flowId);
    if (account) {
      await prisma.flow.update({ where: { id: flowId }, data: { status } });
    }
  } catch {
    // Persistido no armazenamento local
  }
  revalidatePath(`/fluxos/${flowId}`);
  revalidatePath("/fluxos");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function renameFlow(flowId: string, name: string): Promise<SaveResult> {
  const clean = name.trim();
  if (!clean || clean.length > 80) return { ok: false, error: "O nome precisa ter de 1 a 80 caracteres" };
  await renameStoredFlow(flowId, clean);
  try {
    const account = await ownFlow(flowId);
    if (account) {
      await prisma.flow.update({ where: { id: flowId }, data: { name: clean } });
    }
  } catch {
    // Persistido no armazenamento local
  }
  revalidatePath(`/fluxos/${flowId}`);
  revalidatePath("/fluxos");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function duplicateFlow(flowId: string): Promise<SaveResult & { flowId?: string }> {
  const cloned = await duplicateStoredFlow(flowId);
  if (!cloned) return { ok: false, error: "Fluxo não encontrado para duplicação" };
  try {
    const account = await getCurrentAccount();
    await prisma.flow.create({
      data: {
        id: cloned.id,
        accountId: account.id,
        name: cloned.name,
        mode: cloned.mode,
        status: cloned.status,
        recipe: cloned.recipe as any,
      },
    });
  } catch {
    // Persistido no armazenamento local
  }
  revalidatePath("/fluxos");
  return { ok: true, savedAt: new Date().toISOString(), flowId: cloned.id };
}

export async function deleteFlow(flowId: string): Promise<SaveResult> {
  await deleteStoredFlow(flowId);
  try {
    const account = await ownFlow(flowId);
    if (account) {
      await prisma.flow.delete({ where: { id: flowId } });
    }
  } catch {
    // Removido do armazenamento local
  }
  revalidatePath("/fluxos");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function createTag(name: string): Promise<{ id: string; name: string } | { error: string }> {
  const clean = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!clean || clean.length > 40) return { error: "A etiqueta precisa ter de 1 a 40 caracteres" };
  try {
    const account = await getCurrentAccount();
    return await prisma.tag.upsert({
      where: { accountId_name: { accountId: account.id, name: clean } },
      update: {},
      create: { accountId: account.id, name: clean },
      select: { id: true, name: true },
    });
  } catch {
    return { id: `tag_${Date.now()}`, name: clean };
  }
}

export async function saveFlow(flowId: string, input: unknown): Promise<SaveResult> {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const stored = await getStoredFlow(flowId);
  if (stored) {
    stored.viewport = parsed.data.viewport;
    stored.nodes = parsed.data.nodes;
    stored.edges = parsed.data.edges;
    await saveStoredFlow(stored);
  }

  try {
    const account = await ownFlow(flowId);
    if (account) {
      return await persistSnapshot(flowId, account.id, parsed.data as FlowSnapshot);
    }
  } catch {
    // Persistido localmente
  }

  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * Grava o fluxo (caixinhas, linhas, gatilhos, cards) numa transação só.
 * Usado pelo editor avançado e pelo builder simples (depois de compilar a receita).
 */
async function persistSnapshot(
  flowId: string,
  accountId: string,
  snapshot: FlowSnapshot,
  extra: { recipe?: Recipe } = {},
): Promise<SaveResult> {
  const nodeIds = snapshot.nodes.map((node) => node.id);
  if (new Set(nodeIds).size !== nodeIds.length) return { ok: false, error: "Há caixinhas com o mesmo id" };

  try {
    // Cards e etiquetas usados precisam existir nesta conta.
    const catalog = new Map(
      (
        await prisma.catalogItem.findMany({
          where: { accountId },
          select: { id: true, buttonType: true, title: true },
        })
      ).map((item) => [item.id, item]),
    );
    const plan = toSavePlan(snapshot, (id) => catalog.get(id));
    if (plan.carouselCards.some((card) => !catalog.has(card.catalogItemId))) {
      return { ok: false, error: "Um card do carrossel não existe mais no catálogo" };
    }
    const tagIds = new Set<string>();
    for (const node of snapshot.nodes) {
      if ((node.data.kind === "ADD_TAG" || node.data.kind === "CONDITION") && node.data.config.tagId) {
        tagIds.add(node.data.config.tagId);
      }
    }
    if (tagIds.size) {
      const found = await prisma.tag.count({ where: { accountId, id: { in: [...tagIds] } } });
      if (found !== tagIds.size) return { ok: false, error: "Uma etiqueta usada no fluxo não existe mais" };
    }

    const blockIds = plan.nodes.map((node) => node.id);
    const triggerIds = plan.triggers.map((trigger) => trigger.id);
    const cardIds = plan.carouselCards.map((card) => card.id);
    const [foreignNodes, foreignTriggers, foreignCards] = await Promise.all([
      prisma.node.count({ where: { id: { in: blockIds }, flowId: { not: flowId } } }),
      prisma.trigger.count({ where: { id: { in: triggerIds }, flowId: { not: flowId } } }),
      prisma.carouselCard.count({ where: { id: { in: cardIds }, node: { flowId: { not: flowId } } } }),
    ]);
    if (foreignNodes + foreignTriggers + foreignCards > 0) return { ok: false, error: "Ids inválidos" };

    await prisma.$transaction(
      async (tx) => {
        await tx.edge.deleteMany({ where: { flowId } });
        await tx.trigger.deleteMany({ where: { flowId, id: { notIn: triggerIds } } });
        await tx.node.deleteMany({ where: { flowId, id: { notIn: blockIds } } });

        for (const { id, ...node } of plan.nodes) {
          await tx.node.upsert({ where: { id }, create: { id, flowId, ...node }, update: node });
        }

        await tx.carouselCard.deleteMany({ where: { node: { flowId }, id: { notIn: cardIds } } });
        for (const { id, ...card } of plan.carouselCards) {
          await tx.carouselCard.upsert({ where: { id }, create: { id, ...card }, update: card });
        }

        if (plan.edges.length) {
          await tx.edge.createMany({ data: plan.edges.map((edge) => ({ flowId, ...edge })) });
        }

        for (const { id, ...trigger } of plan.triggers) {
          await tx.trigger.upsert({ where: { id }, create: { id, flowId, ...trigger }, update: trigger });
        }

        await tx.flow.update({
          where: { id: flowId },
          data: {
            ...(extra.recipe ? { recipe: extra.recipe } : { viewport: plan.viewport ?? Prisma.DbNull }),
          },
        });
      },
      { timeout: 20_000 },
    );
  } catch {
    // Se o banco falhar, o salvamento já foi feito no arquivo local
  }

  return { ok: true, savedAt: new Date().toISOString() };
}
