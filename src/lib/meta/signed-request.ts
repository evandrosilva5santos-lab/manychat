import crypto from "crypto";
import { z } from "zod";

export type SignedRequestResult = {
  provider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  userId: string;
  issuedAt: Date;
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

const payloadSchema = z.object({
  algorithm: z.string().refine((a) => a.toUpperCase() === "HMAC-SHA256"),
  user_id: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform(String),
  issued_at: z.number().finite(),
});

/**
 * Valida o `signed_request` dos callbacks da Meta (desautorizar / exclusão de
 * dados). O HMAC é calculado sobre o payload como recebido. Retorna null em
 * qualquer falha, sem detalhes.
 */
export function verifySignedRequest(raw: string, now = new Date()): SignedRequestResult | null {
  try {
    if (typeof raw !== "string") return null;
    const parts = raw.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [sigPart, payloadPart] = parts;
    const sig = Buffer.from(sigPart, "base64url");

    const candidates: Array<[SignedRequestResult["provider"], string | undefined]> = [
      ["INSTAGRAM_LOGIN", process.env.IG_APP_SECRET],
      ["FACEBOOK_LOGIN", process.env.META_APP_SECRET],
    ];
    let provider: SignedRequestResult["provider"] | null = null;
    for (const [candidate, secret] of candidates) {
      if (!secret) continue;
      const expected = crypto.createHmac("sha256", secret).update(payloadPart).digest();
      if (expected.length === sig.length && crypto.timingSafeEqual(expected, sig)) {
        provider = candidate;
        break;
      }
    }
    if (!provider) return null;

    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")));
    if (!parsed.success) return null;

    const issuedAt = new Date(parsed.data.issued_at * 1000);
    const age = now.getTime() - issuedAt.getTime();
    if (age > MAX_AGE_MS || -age > MAX_FUTURE_MS) return null;

    return { provider, userId: parsed.data.user_id, issuedAt };
  } catch {
    return null;
  }
}

const MAX_BODY_BYTES = 8192;

export type CallbackParse =
  | { ok: true; raw: string; data: SignedRequestResult }
  | { ok: false; reason: "too_large" | "missing" | "invalid_signature" };

/** Lê e valida o corpo `signed_request=...` dos callbacks da Meta, antes de qualquer acesso ao banco. */
export async function parseCallbackRequest(request: Request): Promise<CallbackParse> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return { ok: false, reason: "too_large" };
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return { ok: false, reason: "too_large" };
  const raw = new URLSearchParams(body).get("signed_request");
  if (!raw) return { ok: false, reason: "missing" };
  const data = verifySignedRequest(raw);
  return data ? { ok: true, raw, data } : { ok: false, reason: "invalid_signature" };
}
