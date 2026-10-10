import { prisma } from "@/lib/prisma";
import type { Contact } from "@/generated/prisma/client";
import { defaultGraphClient } from "@/lib/meta/graph";
import { recordOutgoingMessage } from "./contacts";
import { compileRecipe, readRecipe } from "@/lib/flow/recipe";
import { classifyGraphFailure, RetryableError } from "@/lib/queue/errors";

export type RunnerOptions = {
  accountId: string;
  contact: Contact | any;
  flowId: string;
  /** Nó inicial. Em retomadas (runId ativo) pode ficar indefinido. */
  startNodeId?: string;
  triggerId?: string;
  runId?: string;
  inboundText?: string;
  clickedButtonId?: string;
};

/** Status que impedem um novo run para o mesmo (contato, fluxo). */
const ACTIVE_STATUSES = ["RUNNING", "WAITING_CLICK", "WAITING_DELAY"] as const;

/**
 * Substitui variáveis do contato no texto da mensagem (ex: {{name}}, {{username}}).
 */
function interpolateVariables(text: string, contact: Contact | any): string {
  return text
    .replace(/\{\{name\}\}/gi, contact.name || contact.username || "amigo(a)")
    .replace(/\{\{username\}\}/gi, contact.username || "");
}

/** Marca o run como FAILED com o motivo — envio que falha nunca some. */
async function failRun(runId: string, nodeId: string, error: string) {
  await prisma.flowRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      error: (error || "Erro desconhecido no envio").slice(0, 500),
      currentNodeId: nodeId,
      resumeAt: null,
      finishedAt: new Date(),
    },
  });
}

/**
 * Política de falha de envio. Retorna "stop" (falha permanente: run
 * FAILED e o fluxo para) ou "retry" (deixa o nó atual gravado e lança
 * RetryableError para a fila refazer com backoff).
 */
async function handleSendFailure(
  runId: string,
  nodeId: string,
  failure: { code?: string; error?: string }
): Promise<"stop" | "retry"> {
  const reason = failure.error || failure.code || "Erro desconhecido no envio";

  if (classifyGraphFailure(failure) === "retryable") {
    await prisma.flowRun.update({
      where: { id: runId },
      data: { currentNodeId: nodeId, status: "RUNNING", resumeAt: null },
    });
    throw new RetryableError(`Envio retentável no nó ${nodeId}: ${reason}`);
  }

  await failRun(runId, nodeId, reason);
  return "stop";
}

/**
 * Motor central de execução do fluxo.
 *
 * Regras de execução única:
 * - `runId` fornecido → retoma aquele run (clique, DELAY vencido, retry);
 * - sem `runId` e já existe run ATIVO do (contato, fluxo) → retoma em vez
 *   de duplicar (índice único parcial no banco cobre a corrida);
 * - run aguardando clique/espera não é redisparado por um novo gatilho.
 *
 * Regra de falha: envio com erro permanente → Message.error + run FAILED
 * e o fluxo PARA. Erro retentável (rate limit) → run volta pro nó atual e
 * RetryableError sobe para a fila tentar de novo com backoff.
 */
export async function executeFlow(options: RunnerOptions) {
  const { accountId, contact, flowId, triggerId } = options;

  // Carrega o fluxo com seus nós, conexões e cards de carrossel
  let flow: any = null;
  try {
    flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        nodes: {
          include: {
            carouselCards: {
              include: { catalogItem: true },
              orderBy: { position: "asc" },
            },
          },
        },
        edges: true,
      },
    });
  } catch (error) {
    console.error("[runner] Erro ao buscar fluxo no Prisma:", error);
    return { success: false, error: "Erro ao carregar fluxo" };
  }

  if (!flow) return { success: false, error: "Fluxo não encontrado" };

  if (flow.mode === "SIMPLE" && flow.recipe && (!flow.nodes || flow.nodes.length === 0)) {
    const compiled = compileRecipe(flow.id, readRecipe(flow.recipe));
    flow.nodes = compiled.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data,
      positionX: n.position.x,
      positionY: n.position.y,
      carouselCards: [],
    }));
    flow.edges = compiled.edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.source,
      sourceHandle: e.sourceHandle,
      targetNodeId: e.target,
    }));
  }

  // ── Localiza ou inicializa a execução (FlowRun) ────────────────
  let run: any = null;
  let isResume = false;

  if (options.runId) {
    run = await prisma.flowRun.findUnique({ where: { id: options.runId } });
    if (run) {
      isResume = true;
      if (run.status !== "RUNNING") {
        run = await prisma.flowRun.update({
          where: { id: run.id },
          data: { status: "RUNNING", resumeAt: null },
        });
      }
    }
  }

  if (!run) {
    const active = await prisma.flowRun.findFirst({
      where: {
        contactId: contact.id,
        flowId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { startedAt: "desc" },
    });

    if (active) {
      if (active.status !== "RUNNING") {
        // Já está no meio do fluxo (botão/espera pendente): novo gatilho
        // não redispara — evita DM duplicada.
        return { success: true, alreadyActive: true, runId: active.id, waiting: active.status };
      }
      run = active;
      isResume = true;
    } else {
      try {
        run = await prisma.flowRun.create({
          data: {
            flowId,
            contactId: contact.id,
            triggerId,
            status: "RUNNING",
            currentNodeId: options.startNodeId,
          },
        });
      } catch (error) {
        // Corrida pelo índice único parcial: outro worker criou primeiro.
        if ((error as { code?: string })?.code === "P2002") {
          const winner = await prisma.flowRun.findFirst({
            where: { contactId: contact.id, flowId, status: { in: [...ACTIVE_STATUSES] } },
            orderBy: { startedAt: "desc" },
          });
          if (winner) {
            return { success: true, alreadyActive: true, runId: winner.id };
          }
        }
        throw error;
      }
    }
  }

  let currentNodeId: string | null = options.startNodeId ?? run.currentNodeId ?? null;
  const visitedNodes = new Set<string>(); // Previne loops infinitos

  while (currentNodeId) {
    if (visitedNodes.has(currentNodeId)) {
      console.warn(`Loop detectado no fluxo ${flowId} no nó ${currentNodeId}`);
      break;
    }
    visitedNodes.add(currentNodeId);

    const node = flow.nodes.find((n: any) => n.id === currentNodeId);
    if (!node) break;

    const data = (node.data || {}) as Record<string, any>;
    let nextNodeId: string | null = null;
    let pauseExecution = false;

    switch (node.type) {
      // 1. Mensagem de Texto Simples
      case "MESSAGE": {
        const text = interpolateVariables(data.text || "", contact);
        if (text.trim()) {
          const res = await defaultGraphClient.sendTextMessage(contact.igsid, text);
          await recordOutgoingMessage({
            accountId,
            contactId: contact.id,
            text,
            kind: "TEXT",
            flowId,
            nodeId: node.id,
            runId: run.id,
            error: res.error,
          });
          if (!res.success) {
            const outcome = await handleSendFailure(run.id, node.id, res);
            if (outcome === "stop") {
              return { success: false, failed: true, error: res.error, runId: run.id };
            }
            return { success: false, retryable: true, error: res.error, runId: run.id };
          }
        }
        const edge = flow.edges.find((e: any) => e.sourceNodeId === node.id && !e.sourceHandle);
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      // 2. Pergunta com Botões Fixos (Button Template)
      case "QUESTION": {
        const text = interpolateVariables(data.text || "", contact);
        const buttonsRaw = Array.isArray(data.buttons) ? data.buttons : [];

        const buttons = buttonsRaw.map((b: any) => ({
          title: b.title || "ESCOLHER",
          type: b.type === "web_url" ? ("web_url" as const) : ("postback" as const),
          payload: `node:${node.id}_btn_${b.id}`,
          url: b.url,
        }));

        const res = await defaultGraphClient.sendButtonMessage(contact.igsid, text, buttons);
        await recordOutgoingMessage({
          accountId,
          contactId: contact.id,
          text,
          kind: "BUTTONS",
          payload: { buttons },
          flowId,
          nodeId: node.id,
          runId: run.id,
          error: res.error,
        });

        if (!res.success) {
          // Falhou: NÃO entra em WAITING_CLICK (não há botões no ar).
          const outcome = await handleSendFailure(run.id, node.id, res);
          if (outcome === "stop") {
            return { success: false, failed: true, error: res.error, runId: run.id };
          }
          return { success: false, retryable: true, error: res.error, runId: run.id };
        }

        await prisma.flowRun.update({
          where: { id: run.id },
          data: {
            status: "WAITING_CLICK",
            currentNodeId: node.id,
            resumeAt: null,
          },
        });
        pauseExecution = true;
        break;
      }

      // 3. Verificação de Condição (If / Else)
      case "CONDITION": {
        let conditionPassed = false;

        if (data.rule === "follows") {
          if (contact.followsAccount === true) {
            conditionPassed = true;
          } else {
            // Tri-estado: "unknown" (Meta fora do ar) não vira "não segue"
            // permanente — segue pelo ramo "no" sem cachar mentira.
            const result = await defaultGraphClient.checkUserFollows(contact.igsid);
            conditionPassed = result === "yes";
            if (result === "yes") {
              await prisma.contact.update({
                where: { id: contact.id },
                data: { followsAccount: true },
              });
            }
          }
        } else if (data.rule === "has_tag" && data.tagId) {
          const hasTag = await prisma.contactTag.findUnique({
            where: {
              contactId_tagId: {
                contactId: contact.id,
                tagId: data.tagId,
              },
            },
          });
          conditionPassed = Boolean(hasTag);
        } else if (data.rule === "reply_contains" && data.value && options.inboundText) {
          conditionPassed = options.inboundText
            .toLowerCase()
            .includes(String(data.value).toLowerCase());
        }

        const handle = conditionPassed ? "yes" : "no";
        const edge = flow.edges.find(
          (e: any) =>
            e.sourceNodeId === node.id &&
            (e.sourceHandle === handle || (!e.sourceHandle && handle === "yes"))
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      // 4. Aplicar Etiqueta (Add Tag)
      case "ADD_TAG": {
        if (data.tagId) {
          await prisma.contactTag.upsert({
            where: {
              contactId_tagId: {
                contactId: contact.id,
                tagId: data.tagId,
              },
            },
            update: {},
            create: {
              contactId: contact.id,
              tagId: data.tagId,
              appliedByFlowId: flowId,
            },
          });
        }
        const edge = flow.edges.find((e: any) => e.sourceNodeId === node.id && !e.sourceHandle);
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      // 5. Portão de Seguidor (Follow Gate)
      case "FOLLOW_GATE": {
        let isFollowing: boolean;
        if (contact.followsAccount !== null && contact.followsAccount !== undefined) {
          isFollowing = Boolean(contact.followsAccount);
        } else {
          const result = await defaultGraphClient.checkUserFollows(contact.igsid);
          isFollowing = result === "yes";
        }

        if (isFollowing) {
          const edge = flow.edges.find(
            (e: any) => e.sourceNodeId === node.id && (e.sourceHandle === "unlock" || !e.sourceHandle)
          );
          nextNodeId = edge ? edge.targetNodeId : null;
        } else {
          const text = interpolateVariables(
            data.notFollowingText || data.text || "Siga nosso perfil para desbloquear o link exclusivo!",
            contact
          );
          const buttonTitle = (data.buttonTitle || "JÁ SEGUI").slice(0, 20).toUpperCase();

          const res = await defaultGraphClient.sendButtonMessage(contact.igsid, text, [
            {
              title: buttonTitle,
              type: "postback",
              payload: `gate:${node.id}`,
            },
          ]);

          await recordOutgoingMessage({
            accountId,
            contactId: contact.id,
            text,
            kind: "BUTTONS",
            payload: { button: buttonTitle },
            flowId,
            nodeId: node.id,
            runId: run.id,
            error: res.error,
          });

          if (!res.success) {
            const outcome = await handleSendFailure(run.id, node.id, res);
            if (outcome === "stop") {
              return { success: false, failed: true, error: res.error, runId: run.id };
            }
            return { success: false, retryable: true, error: res.error, runId: run.id };
          }

          await prisma.flowRun.update({
            where: { id: run.id },
            data: {
              status: "WAITING_CLICK",
              currentNodeId: node.id,
              resumeAt: null,
            },
          });
          pauseExecution = true;
        }
        break;
      }

      // 6. Carrossel de Cards do Catálogo
      case "CAROUSEL": {
        const carouselCards = (node as any).carouselCards || [];
        if (carouselCards.length > 0) {
          const elements = carouselCards.map((cc: any) => ({
            title: cc.catalogItem.title,
            subtitle: cc.catalogItem.description || undefined,
            imageUrl: cc.catalogItem.imageUrl,
            buttonTitle: cc.catalogItem.buttonTitle,
            buttonType: cc.catalogItem.buttonType === "URL" ? "web_url" : "postback",
            url: cc.catalogItem.buttonUrl || undefined,
            payload: `card:${cc.id}`,
          }));

          const res = await defaultGraphClient.sendCarouselMessage(contact.igsid, elements);

          await recordOutgoingMessage({
            accountId,
            contactId: contact.id,
            text: `[Carrossel com ${elements.length} cards]`,
            kind: "CAROUSEL",
            payload: { cards: elements },
            flowId,
            nodeId: node.id,
            runId: run.id,
            error: res.error,
          });

          if (!res.success) {
            const outcome = await handleSendFailure(run.id, node.id, res);
            if (outcome === "stop") {
              return { success: false, failed: true, error: res.error, runId: run.id };
            }
            return { success: false, retryable: true, error: res.error, runId: run.id };
          }

          const hasPostback = carouselCards.some((cc: any) => cc.catalogItem.buttonType === "POSTBACK");
          if (hasPostback) {
            await prisma.flowRun.update({
              where: { id: run.id },
              data: {
                status: "WAITING_CLICK",
                currentNodeId: node.id,
                resumeAt: null,
              },
            });
            pauseExecution = true;
          } else {
            const edge = flow.edges.find((e: any) => e.sourceNodeId === node.id && !e.sourceHandle);
            nextNodeId = edge ? edge.targetNodeId : null;
          }
        } else {
          const edge = flow.edges.find((e: any) => e.sourceNodeId === node.id && !e.sourceHandle);
          nextNodeId = edge ? edge.targetNodeId : null;
        }
        break;
      }

      // 7. Espera / Delay
      case "DELAY": {
        const alreadyWaited =
          isResume &&
          run.currentNodeId === node.id &&
          run.resumeAt != null &&
          new Date(run.resumeAt).getTime() <= Date.now();

        if (alreadyWaited) {
          // Espera cumprida (retomada do worker): segue direto.
          const edge = flow.edges.find((e: any) => e.sourceNodeId === node.id && !e.sourceHandle);
          nextNodeId = edge ? edge.targetNodeId : null;
        } else {
          const seconds = Number(data.seconds) || 60;
          const resumeAt = new Date(Date.now() + seconds * 1000);

          await prisma.flowRun.update({
            where: { id: run.id },
            data: {
              status: "WAITING_DELAY",
              currentNodeId: node.id,
              resumeAt,
            },
          });
          pauseExecution = true;
        }
        break;
      }

      default: {
        const edge = flow.edges.find((e: any) => e.sourceNodeId === node.id && !e.sourceHandle);
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }
    }

    if (pauseExecution) {
      return { success: true, paused: true, atNodeId: node.id, runId: run.id };
    }

    currentNodeId = nextNodeId;
  }

  // Se chegou ao fim do fluxo
  await prisma.flowRun.update({
    where: { id: run.id },
    data: {
      status: "DONE",
      currentNodeId: null,
      resumeAt: null,
      finishedAt: new Date(),
    },
  });

  return { success: true, finished: true, runId: run.id };
}

/**
 * Retoma um fluxo pausado quando o lead clica num botão (Postback).
 * A reivindicação é atômica: clique duplo (ou entrega duplicada) executa
 * a retomada UMA vez só.
 */
export async function resumeFlowOnClick(params: {
  accountId: string;
  contact: Contact;
  nodeId: string;
  buttonId?: string;
  payload: string;
}) {
  const { accountId, contact, nodeId, buttonId, payload } = params;

  // Busca a execução que estava pausada aguardando clique
  const waiting = await prisma.flowRun.findFirst({
    where: {
      contactId: contact.id,
      status: "WAITING_CLICK",
      currentNodeId: nodeId,
    },
    orderBy: { startedAt: "desc" },
  });

  if (!waiting) {
    return {
      success: false,
      duplicate: true,
      error: "Nenhuma execução pausada encontrada para este clique",
    };
  }

  // Reivindicação atômica: só um clique passa.
  const claim = await prisma.flowRun.updateMany({
    where: { id: waiting.id, status: "WAITING_CLICK" },
    data: { status: "RUNNING", resumeAt: null },
  });
  if (claim.count !== 1) {
    return { success: false, duplicate: true, error: "Clique já processado" };
  }

  const run = await prisma.flowRun.findUnique({
    where: { id: waiting.id },
    include: {
      flow: {
        include: {
          nodes: true,
          edges: true,
        },
      },
    },
  });

  if (!run || !run.flow) {
    return { success: false, error: "Execução pausada sem fluxo" };
  }

  // 1. Caso seja botão de FOLLOW_GATE (gate:nodeId)
  if (payload.startsWith("gate:")) {
    const result = await defaultGraphClient.checkUserFollows(contact.igsid);

    // "unknown" não vira "não segue" no banco (não cachamos dúvida).
    if (result !== "unknown") {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { followsAccount: result === "yes" },
      });
    }

    if (result === "yes") {
      const unlockEdge = run.flow.edges.find(
        (e) => e.sourceNodeId === nodeId && (e.sourceHandle === "unlock" || !e.sourceHandle)
      );
      if (unlockEdge) {
        return executeFlow({
          accountId,
          contact,
          flowId: run.flowId,
          startNodeId: unlockEdge.targetNodeId,
          runId: run.id,
        });
      }
    } else {
      // Ainda não segue (ou a Meta não respondeu): reenvia aviso educado.
      const node = run.flow.nodes.find((n) => n.id === nodeId);
      const data = (node?.data || {}) as Record<string, any>;
      const text =
        "Ainda não consegui confirmar seu follow! 👀 Dá uma conferida se clicou em Seguir e toque no botão abaixo:";
      const buttonTitle = (data.buttonTitle || "JÁ SEGUI").slice(0, 20).toUpperCase();

      const res = await defaultGraphClient.sendButtonMessage(contact.igsid, text, [
        { title: buttonTitle, type: "postback", payload: `gate:${nodeId}` },
      ]);
      await recordOutgoingMessage({
        accountId,
        contactId: contact.id,
        text,
        kind: "BUTTONS",
        payload: { button: buttonTitle },
        flowId: run.flowId,
        nodeId,
        runId: run.id,
        error: res.error,
      });

      if (!res.success) {
        const outcome = await handleSendFailure(run.id, nodeId, res);
        if (outcome === "stop") {
          return { success: false, failed: true, error: res.error, runId: run.id };
        }
        return { success: false, retryable: true, error: res.error, runId: run.id };
      }

      // Volta a aguardar o próximo toque no botão.
      await prisma.flowRun.update({
        where: { id: run.id },
        data: { status: "WAITING_CLICK", currentNodeId: nodeId },
      });
      return { success: true, waitingAgain: true };
    }
  }

  // 2. Clique em card do CAROUSEL (payload tipo 'card:carouselCardId')
  if (payload.startsWith("card:")) {
    const cardId = payload.replace("card:", "");
    let cardEdge = run.flow.edges.find(
      (e) => e.sourceNodeId === nodeId && e.sourceHandle === cardId
    );
    if (!cardEdge) {
      cardEdge = run.flow.edges.find((e) => e.sourceNodeId === nodeId && !e.sourceHandle);
    }

    if (cardEdge) {
      return executeFlow({
        accountId,
        contact,
        flowId: run.flowId,
        startNodeId: cardEdge.targetNodeId,
        runId: run.id,
      });
    }

    await prisma.flowRun.update({
      where: { id: run.id },
      data: { status: "DONE", finishedAt: new Date(), resumeAt: null },
    });
    return { success: true, finished: true };
  }

  // 3. Botão normal de QUESTION
  let nextEdge = buttonId
    ? run.flow.edges.find((e) => e.sourceNodeId === nodeId && e.sourceHandle === buttonId)
    : null;

  if (!nextEdge) {
    nextEdge = run.flow.edges.find((e) => e.sourceNodeId === nodeId && !e.sourceHandle);
  }

  if (nextEdge) {
    return executeFlow({
      accountId,
      contact,
      flowId: run.flowId,
      startNodeId: nextEdge.targetNodeId,
      runId: run.id,
    });
  }

  // Se não há próximo nó, finaliza
  await prisma.flowRun.update({
    where: { id: run.id },
    data: { status: "DONE", finishedAt: new Date(), resumeAt: null },
  });

  return { success: true, finished: true };
}
