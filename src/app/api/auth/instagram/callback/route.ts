import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForShortLivedToken,
  exchangeFacebookCodeForToken,
  exchangeForLongLivedFacebookUserToken,
  exchangeForLongLivedToken,
  fetchFacebookPagesAndInstagram,
  fetchInstagramProfile,
  getInstagramRedirectUri,
  subscribeAccountWebhooks,
  verifyOAuthState,
} from "@/lib/meta/oauth";
import { encryptToken } from "@/lib/security/token";
import { getOrCreateWorkspaceForActor, requireActor } from "@/lib/tenancy";

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

  // Validação anti-CSRF do state:
  // 1. Tenta validação HMAC assinada (funciona inclusive entre localhost e Vercel)
  // 2. Ou compara com o cookie ig_oauth_state (quando no mesmo domínio)
  const { valid: hmacValid, returnTo } = state ? verifyOAuthState(state) : { valid: false, returnTo: null };
  const cookieState = request.cookies.get("ig_oauth_state")?.value;
  const cookieValid = Boolean(state && cookieState && state === cookieState);

  if (!hmacValid && !cookieValid) {
    console.error("[oauth/callback] State CSRF inválido ou ausente:", { state, hmacValid, cookieValid });
    return NextResponse.redirect(`${origin}/ajustes?error=estado_csrf_invalido`);
  }

  let redirectBase = origin;
  let redirectPath = "/ajustes";
  if (returnTo) {
    try {
      if (returnTo.startsWith("http")) {
        const u = new URL(returnTo);
        redirectBase = u.origin;
        redirectPath = u.pathname || "/ajustes";
      } else if (returnTo.startsWith("/")) {
        redirectPath = returnTo;
      }
    } catch {
      // fallback
    }
  }

  try {
    const actor = await requireActor();
    const workspace = await getOrCreateWorkspaceForActor(actor);
    const redirectUri = getInstagramRedirectUri(request);
    let connectedUsername = "instagram_account";

    // Estratégia 1: Tenta o fluxo de Business Login for Instagram (Meta oficial via Facebook dialog)
    // Conforme: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram
    let fbSuccess = false;
    try {
      const fbToken = await exchangeFacebookCodeForToken(code, redirectUri);
      // Troca por token de usuário de longa duração → o token de Página daí
      // derivado NÃO expira (é o que torna o token "permanente").
      const longLivedUser = await exchangeForLongLivedFacebookUserToken(fbToken.accessToken);
      const accounts = await fetchFacebookPagesAndInstagram(longLivedUser.accessToken);

      if (accounts.length > 0) {
        for (const acc of accounts) {
          const encrypted = encryptToken(acc.pageAccessToken);
          const existing = await prisma.instagramAccount.findUnique({
            where: { igUserId: acc.igUserId },
            select: { id: true, workspaceId: true },
          });
          if (existing && existing.workspaceId !== workspace.id) {
            throw new Error("Esta conta do Instagram já está vinculada a outro cliente.");
          }
          await (existing ? prisma.instagramAccount.update({
            where: { id: existing.id },
            data: {
              username: acc.username,
              name: acc.name || acc.pageName || null,
              profilePicUrl: acc.profilePicUrl || null,
              accessTokenEnc: encrypted,
              tokenExpiresAt: null,
              status: "CONNECTED",
            },
          }) : prisma.instagramAccount.create({
            data: {
              workspaceId: workspace.id,
              igUserId: acc.igUserId,
              username: acc.username,
              name: acc.name || acc.pageName || null,
              profilePicUrl: acc.profilePicUrl || null,
              accessTokenEnc: encrypted,
              tokenExpiresAt: null, // Page tokens do Facebook não expiram
              status: "CONNECTED",
            },
          }));
          connectedUsername = acc.username;
        }
        fbSuccess = true;
      }
    } catch (fbErr: any) {
      console.warn("[oauth/callback] Tentativa de Facebook Business Login falhou, tentando Instagram direto:", fbErr?.message);
    }

    // Estratégia 2: Se não foi pelo Facebook ou se nenhuma página veio vinculada, tenta o fluxo direto do Instagram
    if (!fbSuccess) {
      const { accessToken: shortLivedToken } = await exchangeCodeForShortLivedToken(code, redirectUri);
      const { accessToken: longLivedToken, expiresIn } = await exchangeForLongLivedToken(shortLivedToken);
      const profile = await fetchInstagramProfile(longLivedToken);
      await subscribeAccountWebhooks(longLivedToken);

      const encryptedToken = encryptToken(longLivedToken);
      const expiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000);

      const existing = await prisma.instagramAccount.findUnique({
        where: { igUserId: profile.igUserId },
        select: { id: true, workspaceId: true },
      });
      if (existing && existing.workspaceId !== workspace.id) {
        throw new Error("Esta conta do Instagram já está vinculada a outro cliente.");
      }
      const account = await (existing ? prisma.instagramAccount.update({
        where: { id: existing.id },
        data: {
          username: profile.username,
          name: profile.name || null,
          profilePicUrl: profile.profilePicUrl || null,
          accessTokenEnc: encryptedToken,
          tokenExpiresAt: expiresAt,
          status: "CONNECTED",
        },
      }) : prisma.instagramAccount.create({
        data: {
          workspaceId: workspace.id,
          igUserId: profile.igUserId,
          username: profile.username,
          name: profile.name || null,
          profilePicUrl: profile.profilePicUrl || null,
          accessTokenEnc: encryptedToken,
          tokenExpiresAt: expiresAt,
          status: "CONNECTED",
        },
      }));
      connectedUsername = account.username;
    }

    console.info(`[oauth/callback] Conta @${connectedUsername} conectada com sucesso via OAuth!`);

    const response = NextResponse.redirect(
      `${redirectBase}${redirectPath}?connected=true&username=${encodeURIComponent(connectedUsername)}`,
      302
    );

    // Limpa o cookie temporário de CSRF
    response.cookies.delete("ig_oauth_state");

    return response;
  } catch (err: any) {
    console.error("[oauth/callback] Erro no fluxo OAuth:", err);
    return NextResponse.redirect(
      `${redirectBase}${redirectPath}?error=${encodeURIComponent(err?.message || "falha_ao_conectar_conta")}`
    );
  }
}
