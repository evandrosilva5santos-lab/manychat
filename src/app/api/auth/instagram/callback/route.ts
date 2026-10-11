import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  getInstagramRedirectUri,
  subscribeAccountWebhooks,
} from "@/lib/meta/oauth";
import { encryptToken } from "@/lib/security/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  // Usuário cancelou ou a Meta retornou erro
  if (error) {
    console.warn("[oauth/callback] Erro retornado pela Meta:", { error, errorReason, errorDescription });
    return NextResponse.redirect(`${origin}/ajustes?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/ajustes?error=codigo_oauth_ausente`);
  }

  // Validação anti-CSRF do state
  const cookieState = request.cookies.get("ig_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    console.error("[oauth/callback] State CSRF inválido ou ausente:", { state, cookieState });
    return NextResponse.redirect(`${origin}/ajustes?error=estado_csrf_invalido`);
  }

  try {
    const redirectUri = getInstagramRedirectUri(request);

    // 1. Troca o código pelo token de curta duração
    const { accessToken: shortLivedToken, igUserId } = await exchangeCodeForShortLivedToken(code, redirectUri);

    // 2. Troca pelo token de longa duração (60 dias)
    const { accessToken: longLivedToken, expiresIn } = await exchangeForLongLivedToken(shortLivedToken);

    // 3. Busca os dados oficiais do perfil autenticado
    const profile = await fetchInstagramProfile(longLivedToken);

    // 4. Inscreve os Webhooks oficiais automaticamente
    await subscribeAccountWebhooks(longLivedToken);

    // 5. Criptografa o token com AES-256-GCM para armazenamento seguro
    const encryptedToken = encryptToken(longLivedToken);
    const expiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000);

    // 6. Grava ou atualiza a conta no banco de dados real (Supabase Postgres)
    const account = await prisma.instagramAccount.upsert({
      where: { igUserId: profile.igUserId },
      create: {
        igUserId: profile.igUserId,
        username: profile.username,
        name: profile.name || null,
        profilePicUrl: profile.profilePicUrl || null,
        accessTokenEnc: encryptedToken,
        tokenExpiresAt: expiresAt,
        status: "CONNECTED",
      },
      update: {
        username: profile.username,
        name: profile.name || null,
        profilePicUrl: profile.profilePicUrl || null,
        accessTokenEnc: encryptedToken,
        tokenExpiresAt: expiresAt,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
    });

    console.info(`[oauth/callback] Conta @${account.username} (${account.igUserId}) conectada com sucesso via OAuth!`);

    const response = NextResponse.redirect(
      `${origin}/ajustes?connected=true&username=${encodeURIComponent(account.username)}`,
      302
    );

    // Limpa o cookie temporário de CSRF
    response.cookies.delete("ig_oauth_state");

    return response;
  } catch (err: any) {
    console.error("[oauth/callback] Erro no fluxo OAuth:", err);
    return NextResponse.redirect(
      `${origin}/ajustes?error=${encodeURIComponent(err?.message || "falha_ao_conectar_conta")}`
    );
  }
}
