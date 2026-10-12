import { NextRequest, NextResponse } from "next/server";
import { connectViaFacebook, connectViaInstagram } from "@/lib/meta/connect-account";
import { describeOAuthError, getInstagramRedirectUri, OAuthConfigError, readOAuthState } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

// Retorno da Meta para os DOIS logins (mesma redirect URI). O `state` assinado
// diz qual login foi iniciado, para qual workspace e para onde voltar. Cada modo
// segue só o seu caminho: sem fallback cruzado, o erro real chega à tela.

const INVALID_STATE = "Sessão de autorização inválida ou expirada. Tente conectar novamente.";

function redirectWith(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const key of ["error", "connected", "username", "count"]) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 302);
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const fallback = `${origin}/ajustes`;

  let payload: ReturnType<typeof readOAuthState>;
  try {
    payload = readOAuthState(searchParams.get("state"));
  } catch (error) {
    const message = error instanceof OAuthConfigError ? error.message : INVALID_STATE;
    return redirectWith(fallback, { error: message });
  }
  if (!payload) return redirectWith(fallback, { error: INVALID_STATE });

  const redirectUri = getInstagramRedirectUri(request);
  const metaError = [searchParams.get("error"), searchParams.get("error_reason"), searchParams.get("error_description")]
    .filter(Boolean)
    .join(" — ");
  if (metaError) {
    console.warn("[oauth/callback] A Meta recusou a autorização", { mode: payload.mode, metaError });
    return redirectWith(payload.returnTo, { error: describeOAuthError(metaError, redirectUri) });
  }

  const code = searchParams.get("code");
  if (!code) return redirectWith(payload.returnTo, { error: "A Meta não devolveu o código de autorização. Tente conectar novamente." });

  try {
    const connect = payload.mode === "facebook" ? connectViaFacebook : connectViaInstagram;
    const usernames = await connect(code, redirectUri, payload.workspaceId);
    console.info("[oauth/callback] Contas conectadas", { mode: payload.mode, count: usernames.length });
    return redirectWith(payload.returnTo, { connected: "true", username: usernames[0] ?? "", count: String(usernames.length) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao conectar a conta.";
    console.error("[oauth/callback] Falha ao concluir o login", { mode: payload.mode, error: message });
    return redirectWith(payload.returnTo, { error: describeOAuthError(message, redirectUri) });
  }
}
