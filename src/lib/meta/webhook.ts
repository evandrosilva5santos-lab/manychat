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
  }),
});
const messagingSchema = z.object({
  sender: z.object({ id: identifier }),
  recipient: z.object({ id: identifier }).optional(),
  timestamp: z.number().finite().nonnegative().optional(),
  postback: z
    .object({ title: z.string().default(""), payload: identifier, mid: z.string().optional() })
    .optional(),
  message: z.object({ mid: identifier, text: z.string().optional(), is_echo: z.boolean().optional() }).optional(),
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
      igUserId: string;
      messageId: string;
      userIgsid: string;
      text: string;
      timestamp: number;
    }
  | {
      kind: "postback";
      igUserId: string;
      userIgsid: string;
      title: string;
      payload: string;
      /// mid do postback na Meta — chave de idempotência quando presente.
      postbackMid?: string;
      timestamp: number;
    };

import { safeEqual } from "@/lib/auth/basic";

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

  if (expectedVerifyToken && mode === "subscribe" && token && safeEqual(token, expectedVerifyToken) && challenge) {
    return challenge;
  }
  return null;
}

type EnvLike = Record<string, string | undefined>;

/**
 * Segredos aceitos na assinatura do webhook. No Instagram Login a Meta assina com
 * o segredo do app Instagram (IG_APP_SECRET); META_APP_SECRET fica como alternativa.
 */
export function readWebhookSecrets(env: EnvLike = process.env): string[] {
  const secrets = [env.IG_APP_SECRET, env.META_APP_SECRET].filter((s): s is string => Boolean(s));
  return [...new Set(secrets)];
}

/** Webhook sem assinatura só com flag explícita e nunca em produção. */
export function allowUnsignedWebhooks(env: EnvLike = process.env): boolean {
  return env.ALLOW_UNSIGNED_WEBHOOKS === "1" && env.NODE_ENV !== "production";
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secrets: string[]): boolean {
  return secrets.some((secret) => verifyMetaHmacSignature(rawBody, signatureHeader, secret));
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
    const time = entry.time || Date.now();

    // 1. Comentários (changes -> field: "comments")
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        const parsedChange = commentSchema.safeParse(change);
        if (parsedChange.success) {
          const val = parsedChange.data.value;
          // Ignora comentários feitos pelo próprio dono da conta (evita loops e disparos para si mesmo)
          if (val.from?.id === igUserId) continue;

          events.push({
            kind: "comment",
            igUserId,
            commentId: val.id,
            mediaId: val.media?.id,
            userIgsid: val.from?.id,
            username: val.from?.username,
            text: val.text || "",
            timestamp: val.created_time || time,
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
            igUserId,
            userIgsid,
            title: msg.postback.title || "",
            payload: msg.postback.payload || "",
            postbackMid: msg.postback.mid,
            timestamp: msg.timestamp || time,
          });
        }
        // Mensagem de texto normal recebida
        else if (msg.message && msg.message.text) {
          events.push({
            kind: "message",
            igUserId,
            messageId: msg.message.mid,
            userIgsid,
            text: msg.message.text,
            timestamp: msg.timestamp || time,
          });
        }
      }
    }
  }

  return events;
}
