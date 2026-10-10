import crypto from "crypto";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

/**
 * Chave estável que identifica unicamente um evento da Meta.
 * A Meta reentrega webhooks por até 36h em caso de falha — a mesma
 * entrega deve gerar sempre a MESMA chave (por isso nada de Date.now()
 * ou Math.random aqui).
 *
 * Prioridade: IDs nativos (comment_id, mid). Postback sem mid (erro da
 * Meta ou payload antigo): hash de remetente+timestamp+payload.
 */
export function idempotencyKeyFor(event: NormalizedWebhookEvent): string {
  const account = `ig:${event.igUserId}`;

  if (event.kind === "comment") {
    return `${account}:comment:${event.commentId}`;
  }

  if (event.kind === "message") {
    return `${account}:message:${event.messageId}`;
  }

  if (event.postbackMid) {
    return `${account}:postback:${event.postbackMid}`;
  }

  const stable = `${event.userIgsid}|${event.timestamp}|${event.payload}|${event.title}`;
  const hash = crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
  return `${account}:postback:hash:${hash}`;
}
