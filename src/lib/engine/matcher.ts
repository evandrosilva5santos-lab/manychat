import { prisma } from "@/lib/prisma";
import type { Trigger, Flow } from "@/generated/prisma/client";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

export type MatchedTriggerResult = {
  flow: Flow;
  trigger: Trigger;
  startNodeId: string;
  publicReply?: string;
};

/**
 * Normaliza strings para comparação insensível a maiúsculas e espaços extras.
 */
function cleanText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Confere se o texto recebido satisfaz a regra de palavras-chave do gatilho.
 */
export function matchesKeyword(
  text: string,
  keywords: string[],
  matchType: "CONTAINS" | "EXACT" | "ANY"
): boolean {
  if (matchType === "ANY") return true;
  if (!keywords || keywords.length === 0) return true;

  const target = cleanText(text);

  if (matchType === "EXACT") {
    return keywords.some((k) => cleanText(k) === target);
  }

  // CONTAINS: testa se alguma palavra-chave está contida no texto
  return keywords.some((k) => {
    const cleaned = cleanText(k);
    if (!cleaned) return false;
    return target.includes(cleaned);
  });
}

/**
 * Encontra o fluxo e gatilho ativo para o evento recebido do Instagram.
 */
export async function findMatchingTrigger(
  accountId: string,
  event: NormalizedWebhookEvent
): Promise<MatchedTriggerResult | null> {
  // Busca todos os fluxos LIVE da conta que possuem gatilhos
  const flows = await prisma.flow.findMany({
    where: {
      accountId,
      status: "LIVE",
    },
    include: {
      triggers: true,
      nodes: true,
    },
  });

  for (const flow of flows) {
    for (const trigger of flow.triggers) {
      // 1. Gatilho de Comentário
      if (event.kind === "comment" && trigger.type === "COMMENT_KEYWORD") {
        // Se o gatilho foi amarrado a um post específico, valida o ID da mídia
        if (trigger.mediaId && event.mediaId && trigger.mediaId !== event.mediaId) {
          continue;
        }

        if (matchesKeyword(event.text, trigger.keywords, trigger.match)) {
          const startNodeId = trigger.startNodeId || flow.nodes[0]?.id;
          if (!startNodeId) continue;

          // Sorteia uma resposta pública caso haja variações cadastradas
          let publicReply: string | undefined;
          if (trigger.publicReplies && trigger.publicReplies.length > 0) {
            const valid = trigger.publicReplies.filter((r) => r.trim().length > 0);
            if (valid.length > 0) {
              const randomIndex = Math.floor(Math.random() * valid.length);
              publicReply = valid[randomIndex];
            }
          }

          return { flow, trigger, startNodeId, publicReply };
        }
      }

      // 2. Gatilho de Palavra-chave no Direct (DM)
      if (event.kind === "message" && trigger.type === "DM_KEYWORD") {
        if (matchesKeyword(event.text, trigger.keywords, trigger.match)) {
          const startNodeId = trigger.startNodeId || flow.nodes[0]?.id;
          if (!startNodeId) continue;
          return { flow, trigger, startNodeId };
        }
      }

      // 3. Gatilho de Clique em Botão (Button Click / Postback)
      if (event.kind === "postback" && trigger.type === "BUTTON_CLICK") {
        if (trigger.payload && trigger.payload === event.payload) {
          const startNodeId = trigger.startNodeId || flow.nodes[0]?.id;
          if (!startNodeId) continue;
          return { flow, trigger, startNodeId };
        }
      }
    }
  }

  return null;
}
