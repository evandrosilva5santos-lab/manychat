import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  allowUnsignedWebhooks,
  parseInstagramWebhookPayload,
  readWebhookSecrets,
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "@/lib/meta/webhook";
import { idempotencyKeyFor } from "@/lib/queue/idempotency";
import { enqueueEvent } from "@/lib/queue/store";
import { processDueEvents } from "@/lib/queue/worker";

/**
 * GET /api/webhook/instagram
 * Desafio de verificação do Webhook pela Meta.
 */
export async function GET(request: NextRequest) {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[webhook] WEBHOOK_VERIFY_TOKEN não configurado");
    return new Response("Webhook não configurado.", { status: 500 });
  }
  const challenge = verifyWebhookChallenge(request.nextUrl.searchParams, verifyToken);

  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Verificação falhou. Token inválido.", { status: 403 });
}

/**
 * POST /api/webhook/instagram
 *
 * Contrato de confiabilidade (Item 4):
 * 1. Valida assinatura HMAC (fail-closed; 401 se forjada) e JSON (400).
 * 2. Grava cada evento em `WebhookEvent` ANTES de qualquer processamento
 *    (chave de idempotência única). Entrega duplicada → P2002 → 200 e
 *    nada é reprocessado.
 * 3. Se a gravação falhar → 500: a Meta reentrega (até 36h) e a fila
 *    garante o exatamente-uma-vez.
 * 4. Responde 200 imediatamente; o processamento roda no worker
 *    (via `after()` agora e cron /tick como rede de segurança).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // 1. Validação de Assinatura HMAC SHA-256 (falha fechada)
  if (!allowUnsignedWebhooks()) {
    const secrets = readWebhookSecrets();
    if (secrets.length === 0) {
      console.error("[webhook] IG_APP_SECRET/META_APP_SECRET não configurados");
      return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
    }
    if (!verifyWebhookSignature(rawBody, signature, secrets)) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // 2. Extração dos eventos padronizados (Zod)
  const events = parseInstagramWebhookPayload(body);

  // 3. Enfileiramento idempotente
  let duplicates = 0;
  try {
    for (const event of events) {
      const result = await enqueueEvent({
        idempotencyKey: idempotencyKeyFor(event),
        type: event.kind,
        payload: event,
      });
      if ("duplicate" in result) duplicates++;
    }
  } catch (error) {
    // Banco fora do ar no recebimento: 500 para a Meta reentregar.
    console.error("[webhook] Falha ao gravar evento na fila:", error);
    return NextResponse.json({ error: "Falha ao enfileirar evento" }, { status: 500 });
  }

  // 4. Processamento assíncrono (best-effort; o cron /tick cobre o resto)
  if (events.length > duplicates) {
    after(async () => {
      try {
        await processDueEvents(10);
      } catch (error) {
        console.error("[webhook] Worker pós-resposta falhou:", error);
      }
    });
  }

  // A Meta exige resposta 200 OK imediata
  return NextResponse.json({ status: "ok", received: events.length, duplicates });
}
