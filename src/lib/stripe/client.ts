import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Cliente Stripe da conta. Falha honesta sem chave — nunca modo demo
 * (regra do projeto: zero dados falsos).
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurada no ambiente.");
  }
  if (!cached) {
    cached = new Stripe(key);
  }
  return cached;
}
