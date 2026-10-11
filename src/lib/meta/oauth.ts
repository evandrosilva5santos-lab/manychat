import { z } from "zod";

const oauthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.union([z.string(), z.number()]).transform(String),
  permissions: z.array(z.string()).optional(),
});

const longLivedTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().positive(),
});

const profileResponseSchema = z.object({
  user_id: z.string().optional(),
  id: z.string().optional(),
  username: z.string().min(1),
  name: z.string().optional(),
  profile_picture_url: z.string().optional(),
});

export function getAppBaseUrl(req?: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.startsWith("http")) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  if (req) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "localhost:3007";
    return `${proto}://${host}`;
  }
  return "https://manychat-evandrosilva5santos-7492s-projects.vercel.app";
}

export function getInstagramRedirectUri(req?: Request): string {
  const base = getAppBaseUrl(req);
  return `${base}/api/auth/instagram/callback`;
}

/**
 * Constrói a URL de autorização oficial do Instagram Business Login (OAuth).
 */
export function getInstagramOAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.IG_APP_ID || process.env.META_APP_ID;
  if (!clientId) {
    throw new Error("IG_APP_ID ou META_APP_ID não configurado no ambiente.");
  }

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments"
  );
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Troca o código temporário recebido no callback pelo token de curta duração.
 */
export async function exchangeCodeForShortLivedToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; igUserId: string }> {
  const clientId = process.env.IG_APP_ID || process.env.META_APP_ID;
  const clientSecret = process.env.IG_APP_SECRET || process.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do app Meta (ID/Secret) não configuradas.");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", redirectUri);
  body.set("code", code);

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw) {
    const errorMsg = raw?.error_message || raw?.error?.message || "Falha ao trocar código por token";
    throw new Error(`Meta OAuth Error: ${errorMsg}`);
  }

  const parsed = oauthTokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Resposta de token da Meta fora do padrão esperado.");
  }

  return {
    accessToken: parsed.data.access_token,
    igUserId: parsed.data.user_id,
  };
}

/**
 * Troca o token de curta duração por um token de longa duração (60 dias).
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientSecret = process.env.IG_APP_SECRET || process.env.META_APP_SECRET;
  if (!clientSecret) {
    throw new Error("META_APP_SECRET não configurado.");
  }

  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw) {
    const errorMsg = raw?.error?.message || "Falha ao gerar token de 60 dias";
    throw new Error(`Meta Token Exchange Error: ${errorMsg}`);
  }

  const parsed = longLivedTokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Resposta de token de longa duração inválida.");
  }

  return {
    accessToken: parsed.data.access_token,
    expiresIn: parsed.data.expires_in,
  };
}

/**
 * Obtém os dados de perfil (user_id, username, nome, foto) da conta autenticada.
 */
export async function fetchInstagramProfile(accessToken: string): Promise<{
  igUserId: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}> {
  const url = new URL("https://graph.instagram.com/v21.0/me");
  url.searchParams.set("fields", "user_id,username,name,profile_picture_url");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw) {
    throw new Error("Falha ao carregar perfil do Instagram da Meta.");
  }

  const parsed = profileResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Dados de perfil do Instagram incompatíveis.");
  }

  const igUserId = parsed.data.user_id || parsed.data.id;
  if (!igUserId) {
    throw new Error("Identificador da conta do Instagram ausente no perfil.");
  }

  return {
    igUserId,
    username: parsed.data.username,
    name: parsed.data.name,
    profilePicUrl: parsed.data.profile_picture_url,
  };
}

/**
 * Inscreve automaticamente os webhooks da Meta nos campos comments, messages e messaging_postbacks.
 */
export async function subscribeAccountWebhooks(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("https://graph.instagram.com/v21.0/me/subscribed_apps", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscribed_fields: ["comments", "messages", "messaging_postbacks"],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => null);
    return Boolean(data?.success);
  } catch {
    return false;
  }
}
