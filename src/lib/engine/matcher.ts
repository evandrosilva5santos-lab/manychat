import { prisma } from "@/lib/prisma";
import type { Trigger } from "@/generated/prisma/client";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

export type MatchedTriggerResult = {
  flow: { id: string };
  trigger: Trigger | any;
  startNodeId: string;
  publicReply?: string;
};

/** Tipo de gatilho que corresponde a cada tipo de evento. */
const TRIGGER_TYPE_BY_KIND = {
  comment: "COMMENT_KEYWORD",
  message: "DM_KEYWORD",
  postback: "BUTTON_CLICK",
} as const;

/**
 * Normaliza strings para comparação insensível a maiúsculas, acentos e espaços extras.
 */
function cleanText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Confere se o texto recebido satisfaz a regra de palavras-chave do gatilho.
 */
export function matchesKeyword(
  text: string,
  keywords: string[],
  matchType: "CONTAINS" | "EXACT" | "ANY" = "CONTAINS",
  negativeKeywords?: string[]
): boolean {
  const target = cleanText(text);

  // Palavras-chave negativas: se o comentário contiver alguma delas, descarta o gatilho
  if (negativeKeywords && negativeKeywords.length > 0) {
    const hasNegative = negativeKeywords.some((neg) => {
      const cleanNeg = cleanText(neg);
      return cleanNeg && ` ${target} `.includes(` ${cleanNeg} `);
    });
    if (hasNegative) return false;
  }

  if (matchType === "ANY") return true;
  if (!keywords || keywords.length === 0) return false;

  if (matchType === "EXACT") {
    return keywords.some((k) => Boolean(cleanText(k)) && cleanText(k) === target);
  }

  // CONTAINS: testa se alguma palavra-chave está contida no texto
  return keywords.some((k) => {
    const cleaned = cleanText(k);
    if (!cleaned) return false;
    return ` ${target} `.includes(` ${cleaned} `);
  });
}

/**
 * Encontra o fluxo e gatilho ativo para o evento recebido do Instagram.
 *
 * Performance: busca APENAS os gatilhos do tipo certo (via índice
 * Trigger(type, mediaId) + fluxo LIVE da conta). Os nós só são lidos
 * para o fluxo que deu match, e apenas quando o gatilho não tem
 * startNodeId definido.
 */
export async function findMatchingTrigger(
  accountId: string,
  event: NormalizedWebhookEvent
): Promise<MatchedTriggerResult | null> {
  const triggerType = TRIGGER_TYPE_BY_KIND[event.kind];

  let triggers: any[] = [];
  try {
    triggers = await prisma.trigger.findMany({
      where: {
        type: triggerType,
        flow: { accountId, status: "LIVE" },
      },
      include: { flow: { select: { id: true } } },
    });
  } catch (error) {
    console.error("[matcher] Erro ao buscar gatilhos no Prisma:", error);
    return null;
  }

  const startNodeCache = new Map<string, string | null>();

  async function resolveStartNodeId(flowId: string, fallback: string | null): Promise<string | null> {
    if (fallback) return fallback;
    if (startNodeCache.has(flowId)) return startNodeCache.get(flowId) ?? null;
    const firstNode = await prisma.node.findFirst({
      where: { flowId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    startNodeCache.set(flowId, firstNode?.id ?? null);
    return firstNode?.id ?? null;
  }

  for (const trigger of triggers) {
    const flowId = trigger.flowId;

    // 1. Gatilho de Comentário
    if (event.kind === "comment" && trigger.type === "COMMENT_KEYWORD") {
      // Se o gatilho foi amarrado a um post específico, valida o ID da mídia
      if (trigger.mediaId && trigger.mediaId !== event.mediaId) {
        continue;
      }

      if (matchesKeyword(event.text, trigger.keywords, trigger.match, trigger.negativeKeywords)) {
        const startNodeId = await resolveStartNodeId(flowId, trigger.startNodeId);
        if (!startNodeId) continue;

        // Sorteia uma resposta pública caso haja variações cadastradas
        let publicReply: string | undefined;
        if (trigger.publicReplies && trigger.publicReplies.length > 0) {
          const valid = trigger.publicReplies.filter((r: string) => r.trim().length > 0);
          if (valid.length > 0) {
            const randomIndex = Math.floor(Math.random() * valid.length);
            publicReply = valid[randomIndex];
          }
        }

        return { flow: { id: flowId }, trigger, startNodeId, publicReply };
      }
    }

    // 2. Gatilho de Palavra-chave no Direct (DM)
    if (event.kind === "message" && trigger.type === "DM_KEYWORD") {
      if (matchesKeyword(event.text, trigger.keywords, trigger.match, trigger.negativeKeywords)) {
        const startNodeId = await resolveStartNodeId(flowId, trigger.startNodeId);
        if (!startNodeId) continue;
        return { flow: { id: flowId }, trigger, startNodeId };
      }
    }

    // 3. Gatilho de Clique em Botão (Button Click / Postback)
    if (event.kind === "postback" && trigger.type === "BUTTON_CLICK") {
      if (trigger.payload && trigger.payload === event.payload) {
        const startNodeId = await resolveStartNodeId(flowId, trigger.startNodeId);
        if (!startNodeId) continue;
        return { flow: { id: flowId }, trigger, startNodeId };
      }
    }
  }

  return null;
}
