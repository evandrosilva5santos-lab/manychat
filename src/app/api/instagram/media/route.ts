import { NextResponse } from "next/server";
import { isRequestAuthorized } from "@/lib/auth/requireAuth";
import { getCurrentAccount } from "@/lib/account";
import { graphClientForAccount } from "@/lib/meta/account-client";

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
    const account = await getCurrentAccount();
    if (!account || account.status !== "CONNECTED") {
      return NextResponse.json(
        { success: false, data: [], error: "Nenhum perfil conectado está selecionado." },
        { status: 409 }
      );
    }

    const result = await (await graphClientForAccount(account.id)).getUserMedia(account.igUserId, limit);
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
