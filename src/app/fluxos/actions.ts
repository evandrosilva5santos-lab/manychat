"use server";
// Ações do servidor usadas pelo editor: criar, salvar e renomear fluxo, criar etiqueta.
// Atenção: ainda não há login (Etapa 6). Até lá, qualquer um que abrir o site consegue
// chamar estas ações — não publique o site antes da Etapa 6.
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { FlowMode, FlowStatus } from "@/generated/prisma/enums";
import { getCurrentAccount } from "@/lib/account";
import { toSavePlan } from "@/lib/flow/convert";
import { compileRecipe, defaultRecipe, recipeSchema, type Recipe } from "@/lib/flow/recipe";
import { firstIssue, snapshotSchema } from "@/lib/flow/schema";
import type { FlowSnapshot } from "@/lib/flow/types";
import { prisma } from "@/lib/prisma";

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

async function ownFlow(flowId: string) {
  const account = await getCurrentAccount();
  if (flowId === "demo-casamento") return account;
  try {
    const flow = await prisma.flow.findFirst({ where: { id: flowId, accountId: account.id }, select: { id: true } });
    return flow ? account : null;
  } catch {
    return account;
  }
}

export async function createFlow(mode: FlowMode) {
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
}

/** Troca o builder simples pelo avançado (só de ida: o canvas vira a fonte da verdade). */
export async function convertToAdvanced(flowId: string): Promise<SaveResult> {
  if (flowId === "demo-casamento") {
    return { ok: true, savedAt: new Date().toISOString() };
  }
  if (!(await ownFlow(flowId))) return { ok: false, error: "Fluxo não encontrado" };
  await prisma.flow.update({ where: { id: flowId }, data: { mode: "ADVANCED" } });
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function saveRecipe(flowId: string, input: unknown): Promise<SaveResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  if (flowId === "demo-casamento") {
    return { ok: true, savedAt: new Date().toISOString() };
  }

  const account = await ownFlow(flowId);
  if (!account) return { ok: false, error: "Fluxo não encontrado" };
  const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { mode: true } });
  if (flow?.mode !== "SIMPLE") return { ok: false, error: "Este fluxo já está no builder avançado" };

  // A receita compilada passa pela mesma conferência do editor avançado.
  const snapshot = snapshotSchema.safeParse(compileRecipe(flowId, parsed.data));
  if (!snapshot.success) return { ok: false, error: firstIssue(snapshot.error) };
  return persistSnapshot(flowId, account.id, snapshot.data as FlowSnapshot, { recipe: parsed.data });
}

export async function updateFlowStatus(flowId: string, status: FlowStatus): Promise<SaveResult> {
  if (!(await ownFlow(flowId))) return { ok: false, error: "Fluxo não encontrado" };
  await prisma.flow.update({ where: { id: flowId }, data: { status } });
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function renameFlow(flowId: string, name: string): Promise<SaveResult> {
  const clean = name.trim();
  if (!clean || clean.length > 80) return { ok: false, error: "O nome precisa ter de 1 a 80 caracteres" };
  if (!(await ownFlow(flowId))) return { ok: false, error: "Fluxo não encontrado" };
  await prisma.flow.update({ where: { id: flowId }, data: { name: clean } });
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function createTag(name: string): Promise<{ id: string; name: string } | { error: string }> {
  const clean = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!clean || clean.length > 40) return { error: "A etiqueta precisa ter de 1 a 40 caracteres" };
  const account = await getCurrentAccount();
  return prisma.tag.upsert({
    where: { accountId_name: { accountId: account.id, name: clean } },
    update: {},
    create: { accountId: account.id, name: clean },
    select: { id: true, name: true },
  });
}

export async function saveFlow(flowId: string, input: unknown): Promise<SaveResult> {
  const account = await ownFlow(flowId);
  if (!account) return { ok: false, error: "Fluxo não encontrado" };

  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return persistSnapshot(flowId, account.id, parsed.data as FlowSnapshot);
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

  // Os ids vêm do navegador: nenhum pode ser de outro fluxo.
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
      // Linhas são recriadas do zero a cada salvamento.
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
          // A receita gera o fluxo de novo a cada salvamento: não guarda zoom.
          ...(extra.recipe ? { recipe: extra.recipe } : { viewport: plan.viewport ?? Prisma.DbNull }),
        },
      });
    },
    { timeout: 20_000 },
  );

  return { ok: true, savedAt: new Date().toISOString() };
}
