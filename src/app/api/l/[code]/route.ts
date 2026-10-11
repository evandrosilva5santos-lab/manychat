import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSafeHttpsUrl, isValidLinkCode } from "@/lib/links/tracked";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => new NextResponse("Link não encontrado.", { status: 404 });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code || !isValidLinkCode(code)) return NOT_FOUND();

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
      data: {
        clicks: { increment: 1 },
        lastClickedAt: now,
        firstClickedAt: link.firstClickedAt ?? now,
      },
    });
  } catch (err) {
    console.error("[link] Falha ao registrar clique", err);
  }

  return NextResponse.redirect(link.url, 302);
}
