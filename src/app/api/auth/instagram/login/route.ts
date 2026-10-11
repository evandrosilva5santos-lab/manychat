import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getInstagramOAuthUrl, getInstagramRedirectUri } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    const redirectUri = getInstagramRedirectUri(request);
    const authUrl = getInstagramOAuthUrl(redirectUri, state);

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
