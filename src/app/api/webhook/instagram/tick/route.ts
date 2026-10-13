import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/basic";
import { resumePendingDeletions } from "@/lib/meta/account-lifecycle";
import { processDueEvents, resumeDueDelays } from "@/lib/queue/worker";

export const maxDuration = 60;

/**
 * GET/POST /api/webhook/instagram/tick
 *
 * Varredura durável da fila. O `after()` do webhook é best-effort — este
 * endpoint é a rede de segurança chamada por cron (Vercel Cron, uptime
 * checker ou agendador externo). Protegido por CRON_SECRET.
 *
 * Sem CRON_SECRET configurado, responde 503 (fail-closed) exceto em
 * desenvolvimento.
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

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 50);

  const events = await processDueEvents(limit);
  const delaysResumed = await resumeDueDelays(limit);

  let deletionsResumed = 0;
  try {
    deletionsResumed = (await resumePendingDeletions({ budgetMs: 20_000 })).resumed;
  } catch (err) {
    console.error("[tick] retomada de exclusões falhou:", err instanceof Error ? err.name : "erro");
  }

  return NextResponse.json({ ok: true, events, delaysResumed, deletionsResumed });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
