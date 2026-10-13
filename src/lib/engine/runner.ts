import { prisma } from "@/lib/prisma";
import type { Contact } from "@/generated/prisma/client";
import { recordOutgoingMessage } from "./contacts";
import { compileRecipe, readRecipe } from "@/lib/flow/recipe";
import { classifyGraphFailure, RetryableError } from "@/lib/queue/errors";
import { encodePostback, decodePostback } from "@/lib/meta/postback";

export type TriggerContext = {
  origin: "comment" | "message" | "story_reply" | "postback";
  commentId?: string;
  mediaId?: string;
  timestamp?: number;
  privateReplySent?: boolean;
};

export type RunnerOptions = {
  accountId: string;
  contact: Contact | any;
  flowId: string;
  startNodeId?: string;
  triggerId?: string;
  runId?: string;
  inboundText?: string;
  clickedButtonId?: string;
  triggerContext?: TriggerContext;
};

const ACTIVE_STATUSES = [
  "RUNNING",
  "WAITING_CLICK",
  "WAITING_DELAY",
  "WAITING_REPLY",
] as const;

function interpolateVariables(text: string, contact: Contact | any): string {
  return text
    .replace(/\{\{name\}\}/gi, contact.name || contact.username || "amigo(a)")
    .replace(/\{\{username\}\}/gi, contact.username || "");
}

async function failRun(runId: string, nodeId: string, error: string) {
  try {
    if (typeof (prisma.flowRun as any)?.update === "function") {
      await (prisma.flowRun as any).update({
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
  } catch (err) {
    console.error("[runner] Erro ao marcar run como FAILED:", err);
  }
}

export const PROFILE_UNAVAILABLE_ERROR =
  "Perfil desconectado ou com token expirado — reconecte em Ajustes.";
export const PROFILE_DETACHED_ERROR = "Perfil descarregado";

/**
 * Move o run para outro estado SEM ressuscitar um run já FAILED (ex.: perfil
 * desconectado no meio da execução). A reabertura explícita é feita só por
 * `retryFailedSend`, que grava RUNNING por conta própria.
 */
async function updateRunUnlessFailed(
  runId: string,
  data: Record<string, unknown>,
) {
  await prisma.flowRun.updateMany({
    where: { id: runId, status: { not: "FAILED" } },
    data,
  });
}

/** Confere (barato) se a conta ainda está CONNECTED antes de falar com a Meta. */
async function accountBlockReason(accountId: string): Promise<string | null> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { status: true },
  });
  if (account?.status === "CONNECTED") return null;
  return account?.status === "DISCONNECTED"
    ? PROFILE_DETACHED_ERROR
    : PROFILE_UNAVAILABLE_ERROR;
}

async function handleSendFailure(
  runId: string,
  nodeId: string,
  failure: { code?: number | string; error?: string; retryable?: boolean },
): Promise<"stop" | "retry"> {
  const reason =
    failure.error || String(failure.code) || "Erro desconhecido no envio";

  if (
    failure.retryable ||
    classifyGraphFailure(failure as any) === "retryable"
  ) {
    await updateRunUnlessFailed(runId, {
      currentNodeId: nodeId,
      status: "RUNNING",
      resumeAt: null,
    });
    throw new RetryableError(`Envio retentável no nó ${nodeId}: ${reason}`);
  }

  await failRun(runId, nodeId, reason);
  return "stop";
}

export async function executeFlow(options: RunnerOptions) {
  const { accountId, contact, flowId, triggerId } = options;

  // Carrega o fluxo respeitando a conta informada
  let flow: any = null;
  try {
    if (typeof (prisma.flow as any).findFirst === "function") {
      flow = await (prisma.flow as any).findFirst({
        where: { id: flowId, accountId },
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
    } else {
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
    }
  } catch (error) {
    console.error("[runner] Erro ao buscar fluxo no Prisma:", error);
    return { success: false, error: "Erro ao carregar fluxo" };
  }

  if (!flow || (flow.accountId && flow.accountId !== accountId)) {
    return {
      success: false,
      error: "Fluxo não encontrado ou conta divergente",
    };
  }

  if (
    flow.mode === "SIMPLE" &&
    flow.recipe &&
    (!flow.nodes || flow.nodes.length === 0)
  ) {
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

  // Cliente Graph da conta. Sem fallback para token global: se a conta não
  // estiver utilizável, o run termina FAILED mais abaixo (nada é enviado).
  let client: any = null;
  let clientError: string | null = null;
  try {
    const { graphClientForAccount } = await import("@/lib/meta/account-client");
    client = await graphClientForAccount(accountId);
  } catch {
    clientError = PROFILE_UNAVAILABLE_ERROR;
  }

  // Checagem de private reply
  const isCommentTrigger =
    options.triggerContext?.origin === "comment" &&
    Boolean(options.triggerContext?.commentId) &&
    !options.triggerContext?.privateReplySent;

  if (isCommentTrigger) {
    const commentTimestamp = options.triggerContext?.timestamp;
    if (commentTimestamp && Date.now() - commentTimestamp > 7 * 86400000) {
      return { success: false, error: "Comentário expirado (mais de 7 dias)" };
    }

    // Só reivindica o comentário se o envio for possível: cliente e conta já resolvidos.
    const claimable = client ? (await accountBlockReason(accountId)) === null : false;
    if (claimable && prisma.privateReply) {
      try {
        await prisma.privateReply.create({
          data: { accountId, commentId: options.triggerContext!.commentId! },
        });
      } catch (err: any) {
        if (err?.code === "P2002" || err?.message?.includes("P2002")) {
          return {
            success: false,
            error: "Private reply já enviada para este comentário",
          };
        }
        return { success: false, error: "Falha ao registrar private reply" };
      }
    }
  }

  // Localiza ou inicializa a execução (FlowRun)
  let run: any = null;

  if (options.runId) {
    run =
      typeof (prisma.flowRun as any).findUnique === "function"
        ? await (prisma.flowRun as any).findUnique({
            where: { id: options.runId },
          })
        : await (prisma.flowRun as any).findFirst({
            where: { id: options.runId },
          });

    if (run) {
      if (run.status === "FAILED") {
        // Run encerrado com falha nunca é reaberto aqui (só retryFailedSend o reabre).
        return {
          success: false,
          error: run.error || "Execução já encerrada com falha",
          runId: run.id,
        };
      }
      if (run.status !== "RUNNING") {
        const reopened = await prisma.flowRun.updateMany({
          where: { id: run.id, status: { not: "FAILED" } },
          data: { status: "RUNNING", resumeAt: null },
        });
        if (reopened.count !== 1) {
          return {
            success: false,
            error: "Execução já encerrada com falha",
            runId: run.id,
          };
        }
        run = { ...run, status: "RUNNING", resumeAt: null };
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
        return {
          success: true,
          alreadyActive: true,
          runId: active.id,
          waiting: active.status,
        };
      }
      run = active;
    } else {
      try {
        run = await prisma.flowRun.create({
          data: {
            flowId,
            contactId: contact.id,
            triggerId,
            status: "RUNNING",
            currentNodeId: options.startNodeId,
            triggerContext: (options.triggerContext as any) ?? null,
          },
        });
      } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
          const winner = await prisma.flowRun.findFirst({
            where: {
              contactId: contact.id,
              flowId,
              status: { in: [...ACTIVE_STATUSES] },
            },
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

  let currentNodeId: string | null =
    options.startNodeId ?? run.currentNodeId ?? null;
  if (!client) {
    const reason = clientError ?? PROFILE_UNAVAILABLE_ERROR;
    await failRun(run.id, currentNodeId ?? "", reason);
    return { success: false, failed: true, error: reason, runId: run.id };
  }
  const visitedNodes = new Set<string>();

  while (currentNodeId) {
    if (visitedNodes.has(currentNodeId)) {
      console.warn(`Loop detectado no fluxo ${flowId} no nó ${currentNodeId}`);
      await failRun(run.id, currentNodeId, "Loop detectado no fluxo");
      return { success: false, error: "Loop detectado", runId: run.id };
    }
    visitedNodes.add(currentNodeId);

    const node = flow.nodes.find((n: any) => n.id === currentNodeId);
    if (!node) break;

    const data = (node.data || {}) as Record<string, any>;
    let nextNodeId: string | null = null;
    let pauseExecution = false;

    // Nós que falam com a Meta: reconfirma que o perfil segue CONNECTED.
    const callsMeta =
      ["MESSAGE", "QUESTION", "FOLLOW_GATE", "CAROUSEL"].includes(node.type) ||
      (node.type === "CONDITION" && data.rule === "follows");
    if (callsMeta) {
      const blocked = await accountBlockReason(accountId);
      if (blocked) {
        await failRun(run.id, currentNodeId, blocked);
        return { success: false, failed: true, error: blocked, runId: run.id };
      }
    }

    // Verificar se o envio atual exige verificação de janela de 24h
    const isSendingPrivateReply =
      isCommentTrigger &&
      visitedNodes.size === 1 &&
      Boolean(options.triggerContext?.commentId);

    if (
      ["MESSAGE", "QUESTION", "FOLLOW_GATE", "CAROUSEL"].includes(node.type)
    ) {
      if (!isSendingPrivateReply) {
        let checkWindow = false;
        let lastInbound: Date | null = null;

        if (typeof (prisma.contact as any)?.findFirst === "function") {
          const contactRecord = await (prisma.contact as any).findFirst({
            where: { id: contact.id, accountId },
          });
          if (contactRecord) {
            checkWindow = true;
            lastInbound = contactRecord.lastInboundAt;
          }
        } else if (contact && "lastInboundAt" in contact) {
          checkWindow = true;
          lastInbound = contact.lastInboundAt;
        }

        if (checkWindow) {
          const now = Date.now();
          const inboundTime = lastInbound ? new Date(lastInbound).getTime() : 0;
          const isWindowOpen =
            inboundTime > 0 &&
            inboundTime <= now &&
            now - inboundTime <= 24 * 3600 * 1000;

          if (!isWindowOpen) {
            await failRun(
              run.id,
              currentNodeId,
              "Janela de 24 horas fechada pela Meta",
            );
            return {
              success: false,
              error: "Janela de 24 horas fechada pela Meta",
              runId: run.id,
            };
          }
        }
      }
    }

    const sendContext = isSendingPrivateReply
      ? { commentId: options.triggerContext!.commentId }
      : undefined;

    switch (node.type) {
      // 1. Mensagem de Texto
      case "MESSAGE": {
        const text = interpolateVariables(data.text || "", contact);
        if (text.trim()) {
          const res = await client.sendTextMessage(
            contact.igsid,
            text,
            sendContext,
          );
          await recordOutgoingMessage({
            accountId,
            contactId: contact.id,
            text,
            kind: "TEXT",
            flowId,
            nodeId: node.id,
            runId: run.id,
            error: res.error,
            igMessageId: res.messageId ?? res.id,
          });

          if (!res.success) {
            const outcome = await handleSendFailure(run.id, node.id, res);
            if (outcome === "stop") {
              return {
                success: false,
                failed: true,
                error: res.error,
                runId: run.id,
              };
            }
            return {
              success: false,
              retryable: true,
              error: res.error,
              runId: run.id,
            };
          }
        }

        const edge = flow.edges.find(
          (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
        );
        nextNodeId = edge ? edge.targetNodeId : null;

        if (isSendingPrivateReply) {
          await updateRunUnlessFailed(run.id, {
            status: "WAITING_REPLY",
            currentNodeId: nextNodeId,
            triggerContext: {
              ...(options.triggerContext || {}),
              privateReplySent: true,
            },
          });
          return {
            success: true,
            paused: true,
            waitingReply: true,
            runId: run.id,
          };
        }
        break;
      }

      // 2. Pergunta com Botões (QUESTION)
      case "QUESTION": {
        const text = interpolateVariables(data.text || "", contact);
        const buttonsRaw = (data.buttons || []) as any[];

        if (buttonsRaw.length === 0) {
          await failRun(run.id, node.id, "Pergunta sem botões");
          return {
            success: false,
            failed: true,
            error: "Pergunta sem botões",
            runId: run.id,
          };
        }

        const buttons = [];
        for (const b of buttonsRaw) {
          if (b.type === "web_url") {
            let tracked = b.url;
            try {
              const { trackedUrl } = await import("./tracked-links");
              tracked = await trackedUrl(accountId, contact.id, node.id, b.url);
            } catch {
              tracked = b.url;
            }
            buttons.push({
              title: (b.title || "ABRIR").slice(0, 20),
              type: "web_url" as const,
              url: tracked,
            });
          } else {
            const payload = encodePostback({
              kind: "question",
              nodeId: node.id,
              buttonId: b.id,
              runId: run.id,
            });
            buttons.push({
              title: (b.title || "ESCOLHER").slice(0, 20),
              type: "postback" as const,
              payload,
            });
          }
        }

        const res = await client.sendButtonMessage(
          contact.igsid,
          text,
          buttons,
          sendContext,
        );
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
          const outcome = await handleSendFailure(run.id, node.id, res);
          if (outcome === "stop") {
            return {
              success: false,
              failed: true,
              error: res.error,
              runId: run.id,
            };
          }
          return {
            success: false,
            retryable: true,
            error: res.error,
            runId: run.id,
          };
        }

        const hasPostback = buttons.some((b) => b.type === "postback");
        if (hasPostback) {
          await updateRunUnlessFailed(run.id, {
            status: "WAITING_CLICK",
            currentNodeId: node.id,
            resumeAt: null,
          });
          pauseExecution = true;
        } else {
          const defaultEdge = flow.edges.find(
            (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
          );
          nextNodeId = defaultEdge ? defaultEdge.targetNodeId : null;
        }

        if (isSendingPrivateReply && !hasPostback) {
          await updateRunUnlessFailed(run.id, {
            status: "WAITING_REPLY",
            currentNodeId: nextNodeId,
            triggerContext: {
              ...(options.triggerContext || {}),
              privateReplySent: true,
            },
          });
          return {
            success: true,
            paused: true,
            waitingReply: true,
            runId: run.id,
          };
        }
        break;
      }

      // 3. Verificação de Condição (CONDITION)
      case "CONDITION": {
        let conditionPassed = false;

        if (data.rule === "link_clicked") {
          try {
            const { hasClickedLink } = await import("./tracked-links");
            conditionPassed = await hasClickedLink(
              accountId,
              contact.id,
              data.nodeId || node.id,
            );
          } catch {
            conditionPassed = false;
          }
        } else if (data.rule === "follows") {
          try {
            const result = await client.checkUserFollows(contact.igsid);
            conditionPassed = Boolean(result);
            if (conditionPassed && prisma.contact?.update) {
              await prisma.contact.update({
                where: { id: contact.id },
                data: { followsAccount: true },
              });
            }
          } catch {
            conditionPassed = false;
          }
        }

        const targetHandle = conditionPassed ? "yes" : "no";
        const edge = flow.edges.find(
          (e: any) =>
            e.sourceNodeId === node.id && e.sourceHandle === targetHandle,
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      // 4. Delay / Espera (DELAY)
      case "DELAY": {
        const isResumingThisDelay =
          Boolean(options.runId) && options.startNodeId === node.id;
        if (isResumingThisDelay) {
          const edge = flow.edges.find(
            (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          break;
        }

        const seconds = Math.min(Math.max(data.seconds || 60, 60), 23 * 3600);
        const resumeAt = new Date(Date.now() + seconds * 1000);

        const edge = flow.edges.find(
          (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
        );
        nextNodeId = edge ? edge.targetNodeId : null;

        await updateRunUnlessFailed(run.id, {
          status: "WAITING_DELAY",
          currentNodeId: nextNodeId,
          resumeAt,
        });
        pauseExecution = true;
        break;
      }

      // 5. Adicionar Etiqueta (ADD_TAG)
      case "ADD_TAG": {
        if (data.tagId && prisma.contactTag?.upsert) {
          try {
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
              },
            });
          } catch (err) {
            console.error("[runner] Erro ao aplicar tag:", err);
          }
        }

        const edge = flow.edges.find(
          (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      // 6. Follow Gate (FOLLOW_GATE)
      case "FOLLOW_GATE": {
        let isFollowing = false;
        try {
          isFollowing = await client.checkUserFollows(contact.igsid);
        } catch {
          isFollowing = false;
        }

        if (isFollowing) {
          const unlockEdge = flow.edges.find(
            (e: any) =>
              e.sourceNodeId === node.id &&
              (e.sourceHandle === "unlock" || !e.sourceHandle),
          );
          nextNodeId = unlockEdge ? unlockEdge.targetNodeId : null;
        } else {
          const text = interpolateVariables(
            data.notFollowingText ||
              data.text ||
              "Siga nosso perfil e toque no botão abaixo:",
            contact,
          );
          const buttonTitle = (data.buttonTitle || "JÁ SEGUI")
            .slice(0, 20)
            .toUpperCase();
          const payload = encodePostback({
            kind: "gate",
            nodeId: node.id,
            runId: run.id,
          });

          const res = await client.sendButtonMessage(
            contact.igsid,
            text,
            [{ title: buttonTitle, type: "postback", payload }],
            sendContext,
          );

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
              return {
                success: false,
                failed: true,
                error: res.error,
                runId: run.id,
              };
            }
            return {
              success: false,
              retryable: true,
              error: res.error,
              runId: run.id,
            };
          }

          await updateRunUnlessFailed(run.id, {
            status: "WAITING_CLICK",
            currentNodeId: node.id,
            resumeAt: null,
          });
          pauseExecution = true;
        }
        break;
      }

      // 7. Carrossel (CAROUSEL)
      case "CAROUSEL": {
        const cards = node.carouselCards || [];
        if (cards.length === 0) {
          await failRun(run.id, node.id, "Carrossel sem cards");
          return {
            success: false,
            failed: true,
            error: "Carrossel sem cards",
            runId: run.id,
          };
        }

        const elements = cards.map((c: any) => ({
          title: c.catalogItem?.name || "Produto",
          subtitle: c.catalogItem?.description || undefined,
          imageUrl: c.catalogItem?.imageUrl || "",
          buttonTitle: c.catalogItem?.buttonTitle || "VER MAIS",
          buttonType:
            c.catalogItem?.buttonType === "URL"
              ? ("web_url" as const)
              : ("postback" as const),
          payload: encodePostback({
            kind: "card",
            nodeId: node.id,
            buttonId: c.id,
            runId: run.id,
          }),
          url: c.catalogItem?.buttonUrl,
        }));

        const res = await client.sendCarouselMessage(
          contact.igsid,
          elements,
          sendContext,
        );
        await recordOutgoingMessage({
          accountId,
          contactId: contact.id,
          kind: "CAROUSEL",
          flowId,
          nodeId: node.id,
          runId: run.id,
          error: res.error,
        });

        if (!res.success) {
          const outcome = await handleSendFailure(run.id, node.id, res);
          if (outcome === "stop") {
            return {
              success: false,
              failed: true,
              error: res.error,
              runId: run.id,
            };
          }
          return {
            success: false,
            retryable: true,
            error: res.error,
            runId: run.id,
          };
        }

        await updateRunUnlessFailed(run.id, {
          status: "WAITING_CLICK",
          currentNodeId: node.id,
          resumeAt: null,
        });
        pauseExecution = true;
        break;
      }

      // 8. Nota Interna (NOTE)
      case "NOTE": {
        const edge = flow.edges.find(
          (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      default: {
        const edge = flow.edges.find(
          (e: any) => e.sourceNodeId === node.id && !e.sourceHandle,
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }
    }

    if (pauseExecution) {
      return { success: true, paused: true, atNodeId: node.id, runId: run.id };
    }

    currentNodeId = nextNodeId;
  }

  // Finalização do run
  await updateRunUnlessFailed(run.id, {
    status: "DONE",
    currentNodeId: null,
    resumeAt: null,
    finishedAt: new Date(),
  });

  return { success: true, finished: true, runId: run.id };
}

export async function resumeFlowOnClick(params: {
  accountId: string;
  contact: Contact | any;
  nodeId: string;
  buttonId?: string;
  payload: string;
}) {
  const { accountId, contact, nodeId, buttonId, payload } = params;

  const decoded = decodePostback(payload);
  const targetNodeId = decoded?.nodeId ?? nodeId;
  const targetButtonId = decoded?.buttonId ?? buttonId;
  const targetRunId = decoded?.runId;

  const waiting = await prisma.flowRun.findFirst({
    where: {
      contactId: contact.id,
      status: "WAITING_CLICK",
      ...(targetRunId ? { id: targetRunId } : { currentNodeId: targetNodeId }),
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

  const claim = await prisma.flowRun.updateMany({
    where: { id: waiting.id, status: "WAITING_CLICK" },
    data: { status: "RUNNING", resumeAt: null },
  });
  if (claim.count !== 1) {
    return { success: false, duplicate: true, error: "Clique já processado" };
  }

  let flow: any = (waiting as any).flow ?? null;
  if (!flow) {
    if (typeof (prisma.flow as any).findFirst === "function") {
      flow = await (prisma.flow as any).findFirst({
        where: { id: waiting.flowId, accountId },
        include: { nodes: true, edges: true },
      });
    } else {
      flow = await prisma.flow.findUnique({
        where: { id: waiting.flowId },
        include: { nodes: true, edges: true },
      });
    }
  }

  if (!flow) {
    return { success: false, error: "Fluxo não encontrado" };
  }

  let nextEdge = targetButtonId
    ? flow.edges.find(
        (e: any) =>
          e.sourceNodeId === targetNodeId && e.sourceHandle === targetButtonId,
      )
    : null;

  if (!nextEdge) {
    nextEdge = flow.edges.find(
      (e: any) => e.sourceNodeId === targetNodeId && !e.sourceHandle,
    );
  }

  if (nextEdge) {
    return executeFlow({
      accountId,
      contact,
      flowId: flow.id,
      startNodeId: nextEdge.targetNodeId,
      runId: waiting.id,
    });
  }

  await updateRunUnlessFailed(waiting.id, {
    status: "DONE",
    finishedAt: new Date(),
    resumeAt: null,
  });

  return { success: true, finished: true };
}

export async function resumeFlowOnMessage(params: {
  accountId: string;
  contact: Contact | any;
  inboundText: string;
}) {
  const { accountId, contact } = params;

  const waiting = await prisma.flowRun.findFirst({
    where: {
      contactId: contact.id,
      status: "WAITING_REPLY",
    },
    orderBy: { startedAt: "desc" },
  });

  if (!waiting || !waiting.currentNodeId) {
    return { success: false };
  }

  const claim = await prisma.flowRun.updateMany({
    where: { id: waiting.id, status: "WAITING_REPLY" },
    data: { status: "RUNNING", resumeAt: null },
  });

  if (claim.count !== 1) {
    return { success: false };
  }

  return executeFlow({
    accountId,
    contact,
    flowId: waiting.flowId,
    startNodeId: waiting.currentNodeId,
    runId: waiting.id,
    inboundText: params.inboundText,
  });
}
