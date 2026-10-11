import crypto from "crypto";
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
    const host = req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      return `${proto}://${host}`;
    }
  }
  return "https://manychat-evandrosilva5santos-7492s-projects.vercel.app";
}

export function getInstagramRedirectUri(req?: Request): string {
  const base = getAppBaseUrl(req);
  return `${base}/api/auth/instagram/callback`;
}

/**
 * Gera um state assinado com HMAC para proteção anti-CSRF,
 * permitindo preservar a URL de retorno (ex: localhost) com segurança.
 */
export function generateOAuthState(returnTo?: string): string {
  const secret = process.env.IG_APP_SECRET || process.env.META_APP_SECRET || "meta-secret-state";
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString("hex");
  const payload = JSON.stringify({ r: random, t: timestamp, ret: returnTo || null });
  const basePayload = Buffer.from(payload).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(basePayload).digest("hex");
  return `${basePayload}.${hmac}`;
}

/**
 * Valida o state HMAC recebido no callback.
 */
export function verifyOAuthState(stateStr: string): { valid: boolean; returnTo?: string | null } {
  try {
    const secret = process.env.IG_APP_SECRET || process.env.META_APP_SECRET || "meta-secret-state";
    const parts = stateStr.split(".");
    if (parts.length !== 2) return { valid: false };
    const [basePayload, signature] = parts;
    const expectedHmac = crypto.createHmac("sha256", secret).update(basePayload).digest("hex");
    if (signature !== expectedHmac) {
      return { valid: false };
    }
    const data = JSON.parse(Buffer.from(basePayload, "base64url").toString("utf-8"));
    // Expira em 30 minutos
    if (Date.now() - Number(data.t) > 30 * 60 * 1000) {
      return { valid: false };
    }
    return { valid: true, returnTo: data.ret };
  } catch {
    return { valid: false };
  }
}

/**
 * Constrói a URL do Business Login for Instagram oficial da Meta (via Facebook Login com IG_API_ONBOARDING).
 * Referência: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram
 */
export function getFacebookBusinessLoginUrl(redirectUri: string, state: string): string {
  const clientId = process.env.IG_APP_ID || process.env.META_APP_ID;
  if (!clientId) {
    throw new Error("IG_APP_ID ou META_APP_ID não configurado no ambiente.");
  }

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("display", "page");
  url.searchParams.set("extras", JSON.stringify({ setup: { channel: "IG_API_ONBOARDING" } }));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement,pages_manage_metadata"
  );
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Constrói a URL de autorização oficial do Instagram Business Login direto (OAuth sem Facebook).
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

/**
 * Troca o código retornado pelo dialog de Facebook/Meta por um token de acesso de usuário.
 */
export async function exchangeFacebookCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const clientId = process.env.IG_APP_ID || process.env.META_APP_ID;
  const clientSecret = process.env.IG_APP_SECRET || process.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do app Meta (ID/Secret) não configuradas.");
  }

  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw || !raw.access_token) {
    const errorMsg = raw?.error?.message || "Falha ao trocar código do Facebook por token";
    throw new Error(`Meta Facebook OAuth Error: ${errorMsg}`);
  }

  return {
    accessToken: raw.access_token,
    expiresIn: raw.expires_in,
  };
}

export type FacebookConnectedAccount = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igUserId: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
};

/**
 * Passo 4 da documentação oficial:
 * Consulta GET /me/accounts?fields=id,name,access_token,instagram_business_account
 * e captura as contas comerciais do Instagram vinculadas às Páginas do Facebook.
 */
export async function fetchFacebookPagesAndInstagram(
  userAccessToken: string
): Promise<FacebookConnectedAccount[]> {
  const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("access_token", userAccessToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${userAccessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw || !Array.isArray(raw.data)) {
    throw new Error("Falha ao buscar páginas e contas do Instagram na Graph API.");
  }

  const results: FacebookConnectedAccount[] = [];

  for (const page of raw.data) {
    if (page.instagram_business_account?.id) {
      const igId = page.instagram_business_account.id;
      let username = page.name || "instagram_account";
      let name: string | undefined = undefined;
      let profilePicUrl: string | undefined = undefined;

      try {
        const igProfileRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=username,name,profile_picture_url&access_token=${page.access_token}`,
          { signal: AbortSignal.timeout(10_000) }
        );
        const igData = await igProfileRes.json().catch(() => null);
        if (igData?.username) {
          username = igData.username;
          name = igData.name;
          profilePicUrl = igData.profile_picture_url;
        }
      } catch {
        // Fallback
      }

      // Inscreve a Página nos webhooks oficiais
      try {
        await fetch(`https://graph.facebook.com/v21.0/${page.id}/subscribed_apps`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${page.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscribed_fields: ["messages", "messaging_postbacks", "feed"],
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Fallback
      }

      results.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igUserId: igId,
        username,
        name,
        profilePicUrl,
      });
    }
  }

  return results;
}
