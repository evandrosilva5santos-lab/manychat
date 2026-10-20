import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/basic";
import { processDuePosts } from "@/lib/autoposter/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/cron/autoposter — publica os posts do Autoposter cuja hora chegou.
 * Protegido por CRON_SECRET (Bearer); em produção sem o segredo responde 503.
 * Deve ser chamado a cada minuto (pg_cron/QStash); o cron diário da Vercel é só rede de segurança.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
    }
  } else if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const summary = await processDuePosts(new Date(), 10);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/autoposter] falhou:", error instanceof Error ? error.message : "erro");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
