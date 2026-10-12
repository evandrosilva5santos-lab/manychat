import { NextRequest, NextResponse } from "next/server";
import {
  generateOAuthState,
  getFacebookBusinessLoginUrl,
  getInstagramOAuthUrl,
  getInstagramRedirectUri,
} from "@/lib/meta/oauth";
import { requireActor } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // A conta conectada será vinculada ao ator da sessão no callback.
    // Nunca se inicia OAuth anônimo para evitar anexar um perfil a outro cliente.
    await requireActor();
    const origin = request.nextUrl.origin;
    const from = request.nextUrl.searchParams.get("from");
    const returnPath = from === "conectar" ? "/conectar" : "/ajustes";
    const returnUrl = `${origin}${returnPath}`;
    const state = generateOAuthState(returnUrl);
    const redirectUri = getInstagramRedirectUri(request);
    const mode = request.nextUrl.searchParams.get("mode");
    const useFbe = mode === "fbe" || request.nextUrl.searchParams.get("fbe") === "1";

    // Instagram Login é o padrão (logar com qualquer conta); Facebook só quando
    // explicitamente pedido (?mode=facebook), para contas vinculadas a Página.
    const authUrl =
      mode === "facebook"
        ? getFacebookBusinessLoginUrl(redirectUri, state, useFbe)
        : getInstagramOAuthUrl(redirectUri, state);

    const response = NextResponse.redirect(authUrl, 302);

    // Salva o state em cookie httpOnly para proteção anti-CSRF
    response.cookies.set("ig_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || redirectUri.startsWith("https://"),
      sameSite: "lax",
      maxAge: 60 * 15, // 15 minutos
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[oauth/login] Erro ao iniciar login do Instagram:", error);
    const origin = request.nextUrl.origin;
    return NextResponse.redirect(`${origin}/ajustes?error=${encodeURIComponent(error?.message || "falha_ao_iniciar_oauth")}`);
  }
}
