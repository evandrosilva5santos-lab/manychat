import { NextRequest, NextResponse } from "next/server";
import {
  generateOAuthState,
  getFacebookBusinessLoginUrl,
  getInstagramOAuthUrl,
  getInstagramRedirectUri,
} from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const from = request.nextUrl.searchParams.get("from");
    const returnPath = from === "conectar" ? "/conectar" : "/ajustes";
    const returnUrl = `${origin}${returnPath}`;
    const state = generateOAuthState(returnUrl);
    const redirectUri = getInstagramRedirectUri(request);
    const mode = request.nextUrl.searchParams.get("mode");

    // Por padrão ou quando mode !== "instagram", utiliza o Business Login oficial da Meta
    // conforme https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram
    const authUrl =
      mode === "instagram"
        ? getInstagramOAuthUrl(redirectUri, state)
        : getFacebookBusinessLoginUrl(redirectUri, state);

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
