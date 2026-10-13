import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { applyStripeEvent } from "@/lib/billing/stripe-billing";

export const dynamic = "force-dynamic";

function verifyStripeEvent(rawBody: string, signature: string, secret: string): Stripe.Event | null {
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/**
 * Webhook do Stripe. Segurança real = verificação de assinatura com
 * STRIPE_WEBHOOK_SECRET (mesmo modelo do webhook da Meta). Rota pública
 * por herdar o prefixo /api/webhook/ isento de Basic Auth.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe] STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET não configurados");
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const rawBody = await request.text();
  const event = verifyStripeEvent(rawBody, signature, webhookSecret);
  if (!event) {
    console.error("[stripe] Assinatura inválida — evento descartado");
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  try {
    const result = await applyStripeEvent(event);
    console.log(`[stripe] ${event.type} (${event.id}): ${result}`);
  } catch (err) {
    // 500 faz o Stripe reenviar o evento; nada foi gravado (transação desfeita).
    console.error(`[stripe] Falha ao processar ${event.type}:`, err instanceof Error ? err.name : "erro desconhecido");
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
