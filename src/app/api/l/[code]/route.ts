import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSafeHttpsUrl, isValidLinkCode } from "@/lib/links/tracked";

const NOT_FOUND = () => new NextResponse("Link não encontrado.", { status: 404 });

/**
 * GET /api/l/[code]
 * Conta o clique e redireciona para a URL salva no banco. Nunca usa URL vinda da
 * query (`?to=`), para o domínio não virar redirecionador aberto para golpes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!isValidLinkCode(code)) return NOT_FOUND();

  let link: { id: string; url: string; firstClickedAt: Date | null } | null;
  try {
    link = await prisma.trackedLink.findUnique({
      where: { code },
      select: { id: true, url: true, firstClickedAt: true },
    });
  } catch (err) {
    console.error("[link] Falha ao buscar link rastreado", err);
    return new NextResponse("Link temporariamente indisponível.", { status: 503 });
  }

  if (!link || !isSafeHttpsUrl(link.url)) return NOT_FOUND();

  const now = new Date();
  try {
    await prisma.trackedLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 }, lastClickedAt: now, firstClickedAt: link.firstClickedAt ?? now },
    });
  } catch (err) {
    // O seguidor ainda deve chegar ao destino; a falha fica registrada no log.
    console.error("[link] Falha ao registrar clique", err);
  }

  return NextResponse.redirect(link.url, 302);
}
