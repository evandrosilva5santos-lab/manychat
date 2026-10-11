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
 */
export async function findMatchingTrigger(
  accountId: string,
  event: NormalizedWebhookEvent
): Promise<MatchedTriggerResult | null> {
  const triggers = await prisma.trigger.findMany({
    where: { flow: { accountId, status: "LIVE" } },
    include: { flow: { include: { nodes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  for (const trigger of triggers) {
    const flow = trigger.flow;
    let matches = false;
    if (event.kind === "comment" && trigger.type === "COMMENT_KEYWORD") {
      if (trigger.mediaId && trigger.mediaId !== event.mediaId) continue;
      matches = matchesKeyword(event.text, trigger.keywords, trigger.match, trigger.negativeKeywords);
    } else if (event.kind === "message" &&
      (trigger.type === "DM_KEYWORD" || (trigger.type === "STORY_REPLY" && event.isStoryReply))) {
      matches = matchesKeyword(event.text, trigger.keywords, trigger.match, trigger.negativeKeywords);
    } else if (event.kind === "postback" && trigger.type === "BUTTON_CLICK") {
      matches = Boolean(trigger.payload) && trigger.payload === event.payload;
    }
    if (!matches) continue;
    const startNodeId = trigger.startNodeId ?? flow.nodes?.[0]?.id;
    if (!startNodeId) continue;
    if (Array.isArray(flow.nodes) && flow.nodes.length > 0 && !flow.nodes.some((node) => node.id === startNodeId)) continue;
    if (trigger.cooldownSeconds > 0) {
      const recent = await prisma.flowRun.findFirst({
        where: {
          flowId: flow.id,
          flow: { accountId },
          contact: { accountId, igsid: event.userIgsid },
          startedAt: { gt: new Date(Date.now() - trigger.cooldownSeconds * 1000) },
        },
        select: { id: true },
      });
      if (recent) continue;
    }
    const replies = event.kind === "comment" ? trigger.publicReplies.filter((reply) => reply.trim()) : [];
    const publicReply = replies.length ? replies[Math.floor(Math.random() * replies.length)] : undefined;
    return { flow, trigger, startNodeId, publicReply };
  }
  return null;
}
