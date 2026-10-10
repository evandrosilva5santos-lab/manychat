import { NextResponse } from "next/server";
import { isRequestAuthorized } from "@/lib/auth/requireAuth";
import { defaultGraphClient } from "@/lib/meta/graph";

const DEFAULT_LIMIT = 25;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;
const GENERIC_ERROR = "Não foi possível carregar as publicações do Instagram.";

function parseLimit(raw: string | null): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, value));
}

/**
 * GET /api/instagram/media?limit=N
 * Publicações da conta conectada. O ID da conta nunca vem do navegador.
 */
export async function GET(req: Request) {
  if (!isRequestAuthorized(req)) {
    return NextResponse.json({ success: false, data: [], error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
    const connection = await defaultGraphClient.validateConnection();
    const igUserId = connection.valid ? connection.igUserId : undefined;

    const result = await defaultGraphClient.getUserMedia(igUserId, limit);
    if (!result.success) {
      console.error("[media] Graph API recusou a listagem de mídia:", result.error);
      return NextResponse.json({ success: false, data: [], error: GENERIC_ERROR }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[media] Falha ao listar mídia:", error);
    return NextResponse.json({ success: false, data: [], error: GENERIC_ERROR }, { status: 500 });
  }
}
