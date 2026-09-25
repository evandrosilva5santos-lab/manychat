import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/l/[code]
 * Rota de redirecionamento e rastreamento de cliques em links de automações (ex: WhatsApp).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Busca parâmetro opcional u (url codificada em base64 ou query)
  const targetUrl = request.nextUrl.searchParams.get("to");

  if (targetUrl) {
    try {
      const decoded = decodeURIComponent(targetUrl);
      return NextResponse.redirect(new URL(decoded), 302);
    } catch {
      return NextResponse.redirect(targetUrl, 302);
    }
  }

  // Fallback padrão se não houver URL específica
  return NextResponse.redirect(new URL("/", request.url), 302);
}
