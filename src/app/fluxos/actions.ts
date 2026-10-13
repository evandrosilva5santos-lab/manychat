"use server";
// Ações do servidor usadas pelo editor: criar, salvar, renomear, duplicar e excluir fluxos.
import { requireAuth } from "@/lib/auth/requireAuth";
import { invalidIdMessage } from "@/lib/validation";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type InstagramAccount } from "@/generated/prisma/client";
import type { FlowMode, FlowStatus } from "@/generated/prisma/enums";
import { getCurrentAccount } from "@/lib/account";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { getCurrentActor, getWorkspaceRole, MANAGER_ROLES } from "@/lib/tenancy";
import { toSavePlan } from "@/lib/flow/convert";
import { compileRecipe, defaultRecipe, recipeSchema, type Recipe } from "@/lib/flow/recipe";
import { firstIssue, snapshotSchema } from "@/lib/flow/schema";
import type { FlowSnapshot } from "@/lib/flow/types";
import { prisma } from "@/lib/prisma";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type SaveResult = { ok: true; savedAt: string; flowId?: string } | { ok: false; error: string };

const FLOW_STATUSES: readonly FlowStatus[] = ["DRAFT", "LIVE", "STOPPED"];

const FLOW_NOT_FOUND = "Fluxo não encontrado.";

/** Conta ativa, se a pessoa pode configurar automações nela (OWNER/ADMIN); senão, a mensagem de erro. */
async function managedAccount(): Promise<InstagramAccount | string> {
  const account = await getCurrentAccount();
  if (!account) return "Nenhuma conta conectada. Conecte sua conta em Ajustes.";
  const actor = await getCurrentActor();
  const role = actor ? await getWorkspaceRole(actor, account.workspaceId) : null;
  return role && MANAGER_ROLES.includes(role) ? account : "Seu papel na equipe não permite alterar automações.";
}

/** Conta dona do fluxo, já conferido o papel; senão, a mensagem de erro. */
async function ownFlow(flowId: string): Promise<InstagramAccount | string> {
  const account = await managedAccount();
  if (typeof account === "string") return account;
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, accountId: account.id },
    select: { id: true },
  });
  return flow ? account : FLOW_NOT_FOUND;
}

export async function createFlow(mode: FlowMode) {
  await requireAuth();
  if (mode !== "SIMPLE" && mode !== "ADVANCED") throw new Error("Modo de fluxo inválido.");
  const account = await managedAccount();
  if (typeof account === "string") throw new UserFacingError(account);

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

  if (mode === "SIMPLE") {
    await persistSnapshot(flow.id, account.id, compileRecipe(flow.id, defaultRecipe()));
  }

  redirect(`/fluxos/${flow.id}`);
}

/** Troca o builder simples pelo avançado (só de ida: o canvas vira a fonte da verdade). */
export async function convertToAdvanced(flowId: string): Promise<SaveResult> {
  await requireAuth();
  const invalidInput = invalidIdMessage(flowId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  try {
    await prisma.flow.update({ where: { id: flowId }, data: { mode: "ADVANCED" } });
    revalidatePath(`/fluxos/${flowId}`);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[fluxos] Erro ao converter para avançado:", err);
    return { ok: false, error: actionErrorMessage(err, "Erro ao atualizar modo do fluxo.") };
  }
}

export async function saveRecipe(flowId: string, input: unknown): Promise<SaveResult> {
  await requireAuth();
  const invalidInput = flowId === "novo" ? null : invalidIdMessage(flowId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  // Criação a partir de rota /fluxos/novo
  if (flowId === "novo") {
    const account = await managedAccount();
    if (typeof account === "string") return { ok: false, error: account };

    try {
      const created = await prisma.flow.create({
        data: {
          accountId: account.id,
          name: "Nova automação rápida",
          mode: "SIMPLE",
          status: "DRAFT",
          recipe: parsed.data as Prisma.InputJsonValue,
        },
      });

      const snapshot = compileRecipe(created.id, parsed.data);
      await persistSnapshot(created.id, account.id, snapshot, { recipe: parsed.data });

      revalidatePath("/fluxos");
      return { ok: true, savedAt: new Date().toISOString(), flowId: created.id };
    } catch (err) {
      console.error("[fluxos] Erro ao criar receita:", err);
      return { ok: false, error: actionErrorMessage(err, "Erro ao salvar receita.") };
    }
  }

  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  try {
    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { mode: true } });
    if (!flow) return { ok: false, error: "Fluxo não encontrado." };

    if (flow.mode === "SIMPLE") {
      const snapshot = snapshotSchema.safeParse(compileRecipe(flowId, parsed.data));
      if (!snapshot.success) return { ok: false, error: firstIssue(snapshot.error) };

      return await persistSnapshot(flowId, account.id, snapshot.data as FlowSnapshot, { recipe: parsed.data });
    }

    await prisma.flow.update({
      where: { id: flowId },
      data: { recipe: parsed.data as Prisma.InputJsonValue },
    });

    revalidatePath(`/fluxos/${flowId}`);
    revalidatePath("/fluxos");
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[fluxos] Erro ao salvar receita:", err);
    return { ok: false, error: actionErrorMessage(err, "Erro ao atualizar receita do fluxo.") };
  }
}

export async function updateFlowStatus(flowId: string, status: FlowStatus): Promise<SaveResult> {
  await requireAuth();
  const invalidInput = invalidIdMessage(flowId) ?? (FLOW_STATUSES.includes(status) ? null : "Status inválido.");
  if (invalidInput) return { ok: false, error: invalidInput };
  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  try {
    if (status === "LIVE") {
      // Só conta como nova ativação se o fluxo ainda não estava ao vivo.
      const current = await prisma.flow.findUnique({ where: { id: flowId }, select: { status: true } });
      if (current?.status !== "LIVE") await assertWithinLimit(account.workspaceId, "maxActiveFlows");
    }
    await prisma.flow.update({ where: { id: flowId }, data: { status } });
    revalidatePath(`/fluxos/${flowId}`);
    revalidatePath("/fluxos");
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[fluxos] Erro ao atualizar status do fluxo:", err);
    return { ok: false, error: actionErrorMessage(err, "Erro ao atualizar status.") };
  }
}

export async function renameFlow(flowId: string, name: string): Promise<SaveResult> {
  await requireAuth();
  const invalidInput = invalidIdMessage(flowId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const clean = name.trim();
  if (!clean || clean.length > 80) return { ok: false, error: "O nome precisa ter de 1 a 80 caracteres" };

  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  try {
    await prisma.flow.update({ where: { id: flowId }, data: { name: clean } });
    revalidatePath(`/fluxos/${flowId}`);
    revalidatePath("/fluxos");
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[fluxos] Erro ao renomear fluxo:", err);
    return { ok: false, error: actionErrorMessage(err, "Erro ao renomear fluxo.") };
  }
}

export async function duplicateFlow(flowId: string): Promise<SaveResult & { flowId?: string }> {
  await requireAuth();
  const invalidInput = invalidIdMessage(flowId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  try {
    const original = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        nodes: true,
        edges: true,
        triggers: true,
      },
    });

    if (!original) return { ok: false, error: "Fluxo original não encontrado." };

    const cloned = await prisma.flow.create({
      data: {
        accountId: account.id,
        name: `${original.name} (cópia)`,
        mode: original.mode,
        status: "DRAFT",
        recipe: original.recipe ?? undefined,
        viewport: original.viewport ?? undefined,
      },
    });

    revalidatePath("/fluxos");
    return { ok: true, savedAt: new Date().toISOString(), flowId: cloned.id };
  } catch (err) {
    console.error("[fluxos] Erro ao duplicar fluxo:", err);
    return { ok: false, error: actionErrorMessage(err, "Falha ao duplicar fluxo.") };
  }
}

export async function deleteFlow(flowId: string): Promise<SaveResult> {
  await requireAuth();
  const invalidInput = invalidIdMessage(flowId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  try {
    // Soft-delete: o histórico (FlowRun, Message) é preservado — apagar
    // de verdade levaria o registro de envios junto (Cascade).
    await prisma.flow.update({
      where: { id: flowId },
      data: { archivedAt: new Date(), status: "STOPPED" },
    });
    revalidatePath("/fluxos");
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[fluxos] Erro ao excluir fluxo:", err);
    return { ok: false, error: actionErrorMessage(err, "Erro ao excluir fluxo.") };
  }
}

export async function createTag(name: string): Promise<{ id: string; name: string } | { error: string }> {
  await requireAuth();
  const clean = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!clean || clean.length > 40) return { error: "A etiqueta precisa ter de 1 a 40 caracteres" };

  try {
    const account = await getCurrentAccount();
    if (!account) return { error: "Nenhuma conta conectada." };

    return await prisma.tag.upsert({
      where: { accountId_name: { accountId: account.id, name: clean } },
      update: {},
      create: { accountId: account.id, name: clean },
      select: { id: true, name: true },
    });
  } catch (err) {
    return { error: actionErrorMessage(err, "Erro ao criar etiqueta.") };
  }
}

export async function saveFlow(flowId: string, input: unknown): Promise<SaveResult> {
  await requireAuth();
  const invalidInput = invalidIdMessage(flowId);
  if (invalidInput) return { ok: false, error: invalidInput };
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const account = await ownFlow(flowId);
  if (typeof account === "string") return { ok: false, error: account };

  return await persistSnapshot(flowId, account.id, parsed.data as FlowSnapshot);
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

    revalidatePath(`/fluxos/${flowId}`);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[fluxos] Erro ao persistir snapshot no Prisma:", err);
    return { ok: false, error: actionErrorMessage(err, "Erro ao salvar fluxo no banco de dados.") };
  }
}
