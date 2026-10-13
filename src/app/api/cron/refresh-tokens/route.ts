import { NextRequest, NextResponse } from "next/server";
import { renewExpiringTokens } from "@/lib/meta/token-renewal";
import { resumePendingDeletions } from "@/lib/meta/account-lifecycle";
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
  // Rede de segurança das exclusões de dados pendentes; não afeta a renovação.
  let deletionsResumed = 0;
  try {
    deletionsResumed = (await resumePendingDeletions({ budgetMs: 30_000 })).resumed;
  } catch (err) {
    console.error("[cron/refresh-tokens] retomada de exclusões falhou:", err instanceof Error ? err.name : "erro");
  }

  // 200 sempre: falhas por conta já ficam marcadas EXPIRED + alertadas.
  return NextResponse.json({ ok: summary.failed === 0, ...summary, deletionsResumed });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
