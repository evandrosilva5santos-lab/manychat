import { NextRequest, NextResponse } from "next/server";
import { renewExpiringTokens } from "@/lib/meta/token-renewal";
import { safeEqual } from "@/lib/auth/basic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/cron/refresh-tokens
 *
 * Auto-renovação diária dos tokens do Instagram (os de 60 dias). Tokens de
 * Página do Facebook (sem validade) são ignorados — nunca expiram. Protegido
 * por CRON_SECRET; em produção sem o segredo responde 503 (fail-closed).
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
    }
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const summary = await renewExpiringTokens();
  // 200 sempre: falhas por conta já ficam marcadas EXPIRED + alertadas.
  return NextResponse.json({ ok: summary.failed === 0, ...summary });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
