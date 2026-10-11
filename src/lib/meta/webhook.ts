import crypto from "crypto";
import { z } from "zod";

const identifier = z.string().min(1);
const webhookEntrySchema = z.object({
  id: identifier,
  time: z.number().finite().nonnegative().optional(),
  changes: z.array(z.unknown()).optional(),
  messaging: z.array(z.unknown()).optional(),
});
export const instagramWebhookSchema = z.object({
  object: z.literal("instagram"),
  entry: z.array(z.unknown()),
});
const commentSchema = z.object({
  field: z.literal("comments"),
  value: z.object({
    id: identifier,
    text: z.string().default(""),
    from: z.object({ id: identifier, username: z.string().optional() }),
    media: z.object({ id: identifier }).optional(),
    created_time: z.number().finite().nonnegative().optional(),
    parent_id: identifier.optional(),
  }),
});
const messagingSchema = z.object({
  sender: z.object({ id: identifier }),
  recipient: z.object({ id: identifier }).optional(),
  timestamp: z.number().finite().nonnegative().optional(),
  postback: z.object({ mid: identifier.optional(), title: z.string().default(""), payload: identifier }).optional(),
  message: z.object({ mid: identifier, text: z.string().optional(), is_echo: z.boolean().optional(), reply_to: z.object({ story: z.object({ id: identifier.optional() }).passthrough().optional() }).passthrough().optional() }).optional(),
});

export type NormalizedWebhookEvent =
  | {
      kind: "comment";
      igUserId: string;
      commentId: string;
      mediaId?: string;
      userIgsid: string;
      username?: string;
      text: string;
      timestamp: number;
    }
  | {
      kind: "message";
      isStoryReply?: boolean;
      igUserId: string;
      messageId: string;
      userIgsid: string;
      text: string;
      timestamp: number;
    }
  | {
      kind: "postback";
      messageId?: string;
      postbackMid?: string;
      igUserId: string;
      userIgsid: string;
      title: string;
      payload: string;
      timestamp: number;
    };

/**
 * Validação do handshake inicial da Meta (GET /api/webhook/instagram).
 */
export function verifyWebhookChallenge(
  searchParams: URLSearchParams,
  expectedVerifyToken: string
): string | null {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (expectedVerifyToken && mode === "subscribe" && token === expectedVerifyToken && challenge) {
    return challenge;
  }
  return null;
}

/**
 * Validação de integridade e segurança HMAC SHA-256 do cabeçalho x-hub-signature-256.
 */
export function verifyMetaHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  if (!/^sha256=[a-fA-F0-9]{64}$/.test(signatureHeader)) {
    return false;
  }
  const signature = signatureHeader.slice(7);

  const expectedHmac = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedHmac, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Normaliza os eventos brutos da Meta em estruturas limpas e tipadas.
 */
export function parseInstagramWebhookPayload(body: unknown): NormalizedWebhookEvent[] {
  const events: NormalizedWebhookEvent[] = [];
  const parsed = instagramWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return events;
  }

  for (const rawEntry of parsed.data.entry) {
    const parsedEntry = webhookEntrySchema.safeParse(rawEntry);
    if (!parsedEntry.success) continue;
    const entry = parsedEntry.data;
    const igUserId = entry.id;
    // Meta entry.time / comment.created_time are seconds; messaging.timestamp is milliseconds.
    const time = (entry.time ?? 0) * 1000;

    // 1. Comentários (changes -> field: "comments")
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        const parsedChange = commentSchema.safeParse(change);
        if (parsedChange.success) {
          const val = parsedChange.data.value;
          // Ignora comentários feitos pelo próprio dono da conta (evita loops e disparos para si mesmo)
          if (val.from.id === igUserId || val.parent_id) continue;

          events.push({
            kind: "comment",
            igUserId,
            commentId: val.id,
            mediaId: val.media?.id,
            userIgsid: val.from?.id,
            username: val.from?.username,
            text: val.text || "",
            timestamp: val.created_time === undefined ? time : val.created_time * 1000,
          });
        }
      }
    }

    // 2. Mensagens e Cliques de Botão (messaging)
    if (Array.isArray(entry.messaging)) {
      for (const rawMessage of entry.messaging) {
        const parsedMessage = messagingSchema.safeParse(rawMessage);
        if (!parsedMessage.success) continue;
        const msg = parsedMessage.data;
        const userIgsid = msg.sender?.id;
        // Ignora mensagens enviadas pela própria conta
        if (userIgsid === igUserId || msg.message?.is_echo || (msg.recipient && msg.recipient.id !== igUserId)) continue;

        // Clique num botão fixo (postback)
        if (msg.postback) {
          events.push({
            kind: "postback",
            messageId: msg.postback.mid,
            postbackMid: msg.postback.mid,
            igUserId,
            userIgsid,
            title: msg.postback.title || "",
            payload: msg.postback.payload || "",
            timestamp: msg.timestamp ?? time,
          });
        }
        // Mensagem de texto normal recebida
        else if (msg.message && msg.message.text) {
          events.push({
            kind: "message",
            ...(msg.message.reply_to?.story ? { isStoryReply: true } : {}),            igUserId,
            messageId: msg.message.mid,
            userIgsid,
            text: msg.message.text,
            timestamp: msg.timestamp ?? time,
          });
        }
      }
    }
  }

  return events;
}

/** Both names are supported while installations migrate to Instagram Login. */
export function readWebhookSecrets(env: Record<string, string | undefined> = process.env): string[] {
  return [...new Set([env.IG_APP_SECRET, env.META_APP_SECRET].filter((value): value is string => Boolean(value?.trim())))];
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secrets: string[]): boolean {
  return secrets.some((secret) => verifyMetaHmacSignature(rawBody, signature, secret));
}

/** Explicit local fixture support; production always requires a valid signature. */
export function allowUnsignedWebhooks(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "development" && env.ALLOW_UNSIGNED_WEBHOOKS === "1";
}
