import crypto from "crypto";

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

  if (mode === "subscribe" && token === expectedVerifyToken && challenge) {
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
    // Se o segredo não estiver configurado localmente em dev, permite prosseguir
    return process.env.NODE_ENV !== "production";
  }

  const [prefix, signature] = signatureHeader.split("=");
  if (prefix !== "sha256" || !signature) {
    return false;
  }

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
export function parseInstagramWebhookPayload(body: any): NormalizedWebhookEvent[] {
  const events: NormalizedWebhookEvent[] = [];

  if (!body || body.object !== "instagram" || !Array.isArray(body.entry)) {
    return events;
  }

  for (const entry of body.entry) {
    const igUserId = entry.id;
    const time = entry.time || Date.now();

    // 1. Comentários (changes -> field: "comments")
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === "comments" && change.value) {
          const val = change.value;
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
      for (const msg of entry.messaging) {
        const userIgsid = msg.sender?.id;
        // Ignora mensagens enviadas pela própria conta
        if (userIgsid === igUserId) continue;

        // Clique num botão fixo (postback)
        if (msg.postback) {
          events.push({
            kind: "postback",
            igUserId,
            userIgsid,
            title: msg.postback.title || "",
            payload: msg.postback.payload || "",
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
