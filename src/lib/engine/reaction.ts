// Reação ❤️ à última mensagem que o lead mandou no Direct (API oficial:
// sender_action "react"). É um extra do lembrete: nunca bloqueia o envio.
import { prisma } from "@/lib/prisma";
import { errorCode } from "@/lib/log-safe";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mensagens que a pessoa mandou e que têm o mid da Meta (dá para reagir). */
const REACTABLE_KINDS = ["TEXT", "POSTBACK", "MEDIA", "STORY_REPLY"] as const;

type Reactor = { reactToMessage(to: string, messageId: string, reaction?: string): Promise<{ success: boolean; error?: string }> };

export type ReactionOutcome = "reacted" | "skipped" | "failed";

export async function reactToLastInbound(
  client: Reactor,
  params: { accountId: string; contactId: string; igsid: string },
): Promise<ReactionOutcome> {
  try {
    const last = await prisma.message.findFirst({
      where: {
        accountId: params.accountId,
        contactId: params.contactId,
        direction: "IN",
        kind: { in: [...REACTABLE_KINDS] },
        igMessageId: { not: null },
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { igMessageId: true },
    });
    if (!last?.igMessageId) return "skipped";

    const result = await client.reactToMessage(params.igsid, last.igMessageId, "love");
    if (!result.success) {
      console.warn(`[reação] Meta recusou a reação conta=${params.accountId} motivo=${result.error ?? "desconhecido"}`);
      return "failed";
    }
    return "reacted";
  } catch (error) {
    console.warn(`[reação] Falha ao reagir conta=${params.accountId} (${errorCode(error)})`);
    return "failed";
  }
}
