import { prisma } from "@/lib/prisma";
import type { Flow, Node, Edge, Contact } from "@/generated/prisma/client";
import { defaultGraphClient } from "@/lib/meta/graph";
import { recordOutgoingMessage } from "./contacts";

export type RunnerOptions = {
  accountId: string;
  contact: Contact;
  flowId: string;
  startNodeId: string;
  triggerId?: string;
  runId?: string;
  inboundText?: string;
  clickedButtonId?: string;
};

/**
 * Substitui variáveis do contato no texto da mensagem (ex: {{name}}, {{username}}).
 */
function interpolateVariables(text: string, contact: Contact): string {
  return text
    .replace(/\{\{name\}\}/gi, contact.name || contact.username || "amigo(a)")
    .replace(/\{\{username\}\}/gi, contact.username || "");
}

/**
 * Motor central de execução do fluxo (Etapa 3).
 * Percorre os nós respeitando botões fixos, condições, tags e paradas.
 */
export async function executeFlow(options: RunnerOptions) {
  const { accountId, contact, flowId, startNodeId, triggerId } = options;

  // Carrega o fluxo com seus nós, conexões e cards de carrossel
  const flow = await prisma.flow.findUnique({
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

  if (!flow) return { success: false, error: "Fluxo não encontrado" };

  // Localiza ou inicializa a execução (FlowRun)
  let run = options.runId
    ? await prisma.flowRun.findUnique({ where: { id: options.runId } })
    : null;

  if (!run) {
    run = await prisma.flowRun.create({
      data: {
        flowId,
        contactId: contact.id,
        triggerId,
        status: "RUNNING",
        currentNodeId: startNodeId,
      },
    });
  } else {
    run = await prisma.flowRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", currentNodeId: startNodeId },
    });
  }

  let currentNodeId: string | null = startNodeId;
  const visitedNodes = new Set<string>(); // Previne loops infinitos

  while (currentNodeId) {
    if (visitedNodes.has(currentNodeId)) {
      console.warn(`Loop detectado no fluxo ${flowId} no nó ${currentNodeId}`);
      break;
    }
    visitedNodes.add(currentNodeId);

    const node = flow.nodes.find((n) => n.id === currentNodeId);
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
        }
        // Próximo passo pela saída padrão
        const edge = flow.edges.find((e) => e.sourceNodeId === node.id);
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

        // Pausa a execução aguardando o clique do lead em um dos botões
        await prisma.flowRun.update({
          where: { id: run.id },
          data: {
            status: "WAITING_CLICK",
            currentNodeId: node.id,
          },
        });
        pauseExecution = true;
        break;
      }

      // 3. Verificação de Condição (If / Else)
      case "CONDITION": {
        let conditionPassed = false;

        if (data.rule === "follows") {
          // Verifica se o contato segue
          conditionPassed = Boolean(contact.followsAccount);
          if (!conditionPassed) {
            // Tenta consultar a Meta se não temos certeza
            conditionPassed = await defaultGraphClient.checkUserFollows(contact.igsid);
            if (conditionPassed) {
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
          (e) => e.sourceNodeId === node.id && (e.sourceHandle === handle || !e.sourceHandle)
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
        const edge = flow.edges.find((e) => e.sourceNodeId === node.id);
        nextNodeId = edge ? edge.targetNodeId : null;
        break;
      }

      // 5. Portão de Seguidor (Follow Gate)
      case "FOLLOW_GATE": {
        const isFollowing = contact.followsAccount ?? (await defaultGraphClient.checkUserFollows(contact.igsid));

        if (isFollowing) {
          // Se já segue, segue pela saída de desbloqueio
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === node.id && (e.sourceHandle === "unlock" || !e.sourceHandle)
          );
          nextNodeId = edge ? edge.targetNodeId : null;
        } else {
          // Se não segue, manda mensagem com botão de confirmação
          const text = interpolateVariables(
            data.notFollowingText || data.text || "Siga nosso perfil para desbloquear o link exclusivo!",
            contact
          );
          const buttonTitle = (data.buttonTitle || "JÁ SEGUI").slice(0, 20).toUpperCase();

          await defaultGraphClient.sendButtonMessage(contact.igsid, text, [
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
          });

          await prisma.flowRun.update({
            where: { id: run.id },
            data: {
              status: "WAITING_CLICK",
              currentNodeId: node.id,
            },
          });
          pauseExecution = true;
        }
        break;
      }

      // 6. Carrossel de Cards do Catálogo (Etapa 5)
      case "CAROUSEL": {
        const carouselCards = (node as any).carouselCards || [];
        if (carouselCards.length > 0) {
          const elements = carouselCards.map((cc: any, idx: number) => ({
            title: cc.catalogItem.title,
            subtitle: cc.catalogItem.description || undefined,
            imageUrl: cc.catalogItem.imageUrl,
            buttonTitle: cc.catalogItem.buttonTitle,
            buttonType: cc.catalogItem.buttonType === "URL" ? "web_url" : "postback",
            url: cc.catalogItem.buttonUrl || undefined,
            payload: `card:${cc.id}`,
          }));

          await defaultGraphClient.sendCarouselMessage(contact.igsid, elements);

          await recordOutgoingMessage({
            accountId,
            contactId: contact.id,
            text: `[Carrossel com ${elements.length} cards]`,
            kind: "CAROUSEL",
            payload: { cards: elements },
            flowId,
            nodeId: node.id,
            runId: run.id,
          });

          // Se algum card tem botão POSTBACK, o fluxo pausa aguardando o clique do lead
          const hasPostback = carouselCards.some((cc: any) => cc.catalogItem.buttonType === "POSTBACK");
          if (hasPostback) {
            await prisma.flowRun.update({
              where: { id: run.id },
              data: {
                status: "WAITING_CLICK",
                currentNodeId: node.id,
              },
            });
            pauseExecution = true;
          } else {
            // Se todos os botões são links externos (URL), segue para a próxima caixinha conectada
            const edge = flow.edges.find((e) => e.sourceNodeId === node.id);
            nextNodeId = edge ? edge.targetNodeId : null;
          }
        } else {
          // Sem cards configurados, avança para a próxima caixinha
          const edge = flow.edges.find((e) => e.sourceNodeId === node.id);
          nextNodeId = edge ? edge.targetNodeId : null;
        }
        break;
      }

      // 7. Espera / Delay
      case "DELAY": {
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
        break;
      }

      default: {
        const edge = flow.edges.find((e) => e.sourceNodeId === node.id);
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
      finishedAt: new Date(),
    },
  });

  return { success: true, finished: true, runId: run.id };
}

/**
 * Retoma um fluxo pausado quando o lead clica num botão (Postback).
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
  const run = await prisma.flowRun.findFirst({
    where: {
      contactId: contact.id,
      status: "WAITING_CLICK",
      currentNodeId: nodeId,
    },
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
    return { success: false, error: "Nenhuma execução pausada encontrada para este clique" };
  }

  // 1. Caso seja botão de FOLLOW_GATE (gate:nodeId)
  if (payload.startsWith("gate:")) {
    // Checa novamente se o lead passou a seguir
    const isNowFollowing = await defaultGraphClient.checkUserFollows(contact.igsid);
    await prisma.contact.update({
      where: { id: contact.id },
      data: { followsAccount: isNowFollowing },
    });

    if (isNowFollowing) {
      // Avança pelo handle 'unlock'
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
      // Ainda não segue: reenvia aviso educado
      const node = run.flow.nodes.find((n) => n.id === nodeId);
      const data = (node?.data || {}) as Record<string, any>;
      const text = "Ainda não consegui confirmar seu follow! 👀 Dá uma conferida se clicou em Seguir e toque no botão abaixo:";
      const buttonTitle = (data.buttonTitle || "JÁ SEGUI").slice(0, 20).toUpperCase();

      await defaultGraphClient.sendButtonMessage(contact.igsid, text, [
        { title: buttonTitle, type: "postback", payload: `gate:${nodeId}` },
      ]);
      return { success: true, message: "Ainda não segue" };
    }
  }

  // 2. Clique em card do CAROUSEL (payload tipo 'card:carouselCardId')
  if (payload.startsWith("card:")) {
    const cardId = payload.replace("card:", "");
    // Procura aresta cujo sourceHandle seja o id do CarouselCard clicado
    let cardEdge = run.flow.edges.find(
      (e) => e.sourceNodeId === nodeId && e.sourceHandle === cardId
    );
    if (!cardEdge) {
      // Se não achou aresta com o handle específico, pega a aresta geral que sai do nó
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
      data: { status: "DONE", finishedAt: new Date() },
    });
    return { success: true, finished: true };
  }

  // 3. Botão normal de QUESTION
  // Procura aresta cujo sourceHandle seja o id do botão clicado
  let nextEdge = buttonId
    ? run.flow.edges.find((e) => e.sourceNodeId === nodeId && e.sourceHandle === buttonId)
    : null;

  // Se não achou aresta com o handle específico, pega a aresta geral que sai do nó
  if (!nextEdge) {
    nextEdge = run.flow.edges.find((e) => e.sourceNodeId === nodeId);
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
    data: { status: "DONE", finishedAt: new Date() },
  });

  return { success: true, finished: true };
}
