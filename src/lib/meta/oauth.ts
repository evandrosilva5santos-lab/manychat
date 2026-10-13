import crypto from "crypto";
import { z } from "zod";
import { GRAPH_API_VERSION } from "./graph";

/**
 * Erro de configuração do OAuth (variáveis de ambiente ausentes ou trocadas).
 * Sempre falha fechado: sem credencial correta, nenhum fluxo é iniciado.
 */
export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthConfigError";
  }
}

export type AppCredentials = { appId: string; appSecret: string };

/**
 * Credenciais do App da Meta (Facebook Login → tokens de Página).
 * Painel da Meta › Configurações do app › Básico (ID do App / Chave Secreta).
 */
export function getFacebookAppCredentials(): AppCredentials {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new OAuthConfigError(
      "Configure META_APP_ID e META_APP_SECRET (ID do App da Meta e a chave secreta, em Configurações do app › Básico)."
    );
  }
  return { appId, appSecret };
}

const INSTAGRAM_APP_HINT =
  "Use o 'ID do app do Instagram' (Painel da Meta › Instagram › Configuração da API com login do Instagram › Configurações do login comercial) e o respectivo secret.";

/**
 * Credenciais do Instagram Login (instagram.com/oauth). O "ID do app do
 * Instagram" é DIFERENTE do ID do App da Meta; usar o da Meta gera o erro
 * "Invalid platform app" na tela de autorização.
 */
export function getInstagramAppCredentials(): AppCredentials {
  const appId = process.env.IG_APP_ID?.trim();
  const appSecret = process.env.IG_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new OAuthConfigError(`Configure IG_APP_ID e IG_APP_SECRET. ${INSTAGRAM_APP_HINT}`);
  }
  const metaAppId = process.env.META_APP_ID?.trim();
  if (metaAppId && appId === metaAppId) {
    throw new OAuthConfigError(`IG_APP_ID está igual ao ID do App da Meta. ${INSTAGRAM_APP_HINT}`);
  }
  return { appId, appSecret };
}

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

// ---------------------------------------------------------------------------
// Assinatura HMAC (state OAuth e convite de cliente)
// ---------------------------------------------------------------------------

/**
 * Segredo das assinaturas HMAC (state OAuth e convite). Sem fallback fixo:
 * se nada estiver configurado, falha fechado.
 */
export function getOAuthSigningSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET?.trim() || process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new OAuthConfigError(
      "Configure OAUTH_STATE_SECRET ou TOKEN_ENCRYPTION_KEY para assinar o state do OAuth com segurança."
    );
  }
  return secret;
}

/**
 * Assina `domain:body` com HMAC-SHA256 (hex). O domínio separa os tipos de
 * token ("state", "invite"), então um nunca é aceito no lugar do outro.
 */
export function signWithDomain(domain: string, body: string): string {
  return crypto.createHmac("sha256", getOAuthSigningSecret()).update(`${domain}:${body}`).digest("hex");
}

/** Compara a assinatura em tempo constante (protege contra timing attacks). */
export function hasValidDomainSignature(domain: string, body: string, signature: string): boolean {
  const expected = Buffer.from(signWithDomain(domain, body), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

/** Separa `body.signature`; retorna null se o formato não bater. */
export function splitSignedToken(token: string): { body: string; signature: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { body: parts[0], signature: parts[1] };
}

/** Decodifica JSON em base64url; retorna null se não for JSON válido. */
export function decodeBase64UrlJson(body: string): unknown {
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// State OAuth assinado (anti-CSRF + workspace de destino)
// ---------------------------------------------------------------------------

export type OAuthMode = "instagram" | "facebook";
export type OAuthStatePayload = {
  mode: OAuthMode;
  workspaceId: string;
  returnTo: string;
  nonce: string;
  iat: number;
};

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const OAUTH_STATE_CLOCK_SKEW_MS = 60 * 1000;
const STATE_DOMAIN = "state";

/**
 * Retorno seguro: URL absoluta http(s) ou caminho interno ("/ajustes").
 * Bloqueia "//evil.com" e "/\evil.com", que o navegador trata como outro domínio.
 */
function isSafeReturnTo(value: string): boolean {
  if (value.startsWith("/")) {
    return !/^\/[/\\]/.test(value);
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const oauthStatePayloadSchema = z.object({
  mode: z.enum(["instagram", "facebook"]),
  workspaceId: z.string().min(1),
  returnTo: z.string().min(1).refine(isSafeReturnTo),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  iat: z.number().int().nonnegative(),
});

/**
 * Gera o state do OAuth: base64url(JSON) + "." + HMAC("state:" + base64url).
 * Carrega o modo, o workspace de destino e a URL de retorno; vale 15 minutos.
 */
export function createOAuthState(
  input: { mode: OAuthMode; workspaceId: string; returnTo: string },
  now = Date.now()
): string {
  const payload: OAuthStatePayload = oauthStatePayloadSchema.parse({
    mode: input.mode,
    workspaceId: input.workspaceId,
    returnTo: input.returnTo,
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: now,
  });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signWithDomain(STATE_DOMAIN, body)}`;
}

/**
 * Valida o state recebido no callback. Retorna null (nunca lança) para state
 * ausente, adulterado, expirado ou malformado. Sem segredo configurado lança
 * OAuthConfigError (falha fechado).
 */
export function readOAuthState(state: string | null | undefined, now = Date.now()): OAuthStatePayload | null {
  if (!state) return null;
  const parts = splitSignedToken(state);
  if (!parts) return null;
  if (!hasValidDomainSignature(STATE_DOMAIN, parts.body, parts.signature)) return null;

  const parsed = oauthStatePayloadSchema.safeParse(decodeBase64UrlJson(parts.body));
  if (!parsed.success) return null;

  const { iat } = parsed.data;
  if (now - iat > OAUTH_STATE_TTL_MS) return null;
  if (iat - now > OAUTH_STATE_CLOCK_SKEW_MS) return null;
  return parsed.data;
}

const LEGACY_STATE_DOMAIN = "legacy-state";
const LEGACY_STATE_TTL_MS = 30 * 60 * 1000;

/** @deprecated use createOAuthState/readOAuthState */
export function generateOAuthState(returnTo?: string): string {
  const payload = JSON.stringify({
    r: crypto.randomBytes(16).toString("hex"),
    t: Date.now().toString(),
    ret: returnTo || null,
  });
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${signWithDomain(LEGACY_STATE_DOMAIN, body)}`;
}

/** @deprecated use createOAuthState/readOAuthState */
export function verifyOAuthState(stateStr: string): { valid: boolean; returnTo?: string | null } {
  try {
    const parts = splitSignedToken(stateStr);
    if (!parts || !hasValidDomainSignature(LEGACY_STATE_DOMAIN, parts.body, parts.signature)) {
      return { valid: false };
    }
    const data = decodeBase64UrlJson(parts.body) as { t?: string; ret?: string | null } | null;
    if (!data || Date.now() - Number(data.t) > LEGACY_STATE_TTL_MS) {
      return { valid: false };
    }
    return { valid: true, returnTo: data.ret ?? null };
  } catch {
    return { valid: false };
  }
}

// ---------------------------------------------------------------------------
// Mensagens de erro amigáveis
// ---------------------------------------------------------------------------

const MAX_RAW_ERROR_LENGTH = 300;

/** Traduz erros crus da Meta em mensagens que o usuário entende e consegue resolver. */
export function describeOAuthError(raw: string, redirectUri?: string): string {
  if (/invalid platform app/i.test(raw)) {
    return "O ID do app do Instagram está errado. Use o 'ID do app do Instagram' (Painel da Meta › Instagram › Configuração da API com login do Instagram), não o ID do App da Meta.";
  }
  if (/redirect_uri|url bloqueada|url blocked/i.test(raw)) {
    return `A URL de retorno não está cadastrada no painel da Meta${redirectUri ? `: ${redirectUri}` : ""}.`;
  }
  if (/access_denied|user denied|permissions error/i.test(raw)) {
    return "Autorização cancelada no Instagram/Facebook.";
  }
  if (/code has been used|authorization code.*expired|código.*(usado|expirad)/i.test(raw)) {
    return "Este link de autorização expirou. Clique em conectar novamente.";
  }
  return raw.trim().slice(0, MAX_RAW_ERROR_LENGTH);
}

// ---------------------------------------------------------------------------
// URLs de autorização
// ---------------------------------------------------------------------------

const FACEBOOK_LOGIN_SCOPES = [
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "business_management",
].join(",");

/**
 * Constrói a URL do Business Login for Instagram oficial da Meta (via Facebook Login com IG_API_ONBOARDING).
 * Usa SEMPRE o App da Meta (META_APP_ID), nunca o ID do app do Instagram.
 * Referência: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram
 */
export function getFacebookBusinessLoginUrl(redirectUri: string, state: string, useFbe = false): string {
  const { appId: clientId } = getFacebookAppCredentials();

  const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("display", "page");
  if (useFbe) {
    url.searchParams.set("extras", JSON.stringify({ setup: { channel: "IG_API_ONBOARDING" } }));
  }
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  // Login do Facebook para Empresas: com uma "configuração" criada no painel, o
  // config_id substitui o scope (as permissões ficam definidas na configuração).
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim();
  if (configId) url.searchParams.set("config_id", configId);
  else url.searchParams.set("scope", FACEBOOK_LOGIN_SCOPES);
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Constrói a URL de autorização oficial do Instagram Business Login direto (OAuth sem Facebook).
 * Usa o "ID do app do Instagram" (IG_APP_ID), nunca o ID do App da Meta.
 */
export function getInstagramOAuthUrl(redirectUri: string, state: string): string {
  const { appId: clientId } = getInstagramAppCredentials();

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
  const { appId: clientId, appSecret: clientSecret } = getInstagramAppCredentials();

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

const UNSUPPORTED_METHOD_RE = /Unsupported request - method type/i;

/**
 * Chamada de troca/renovação de token: GET documentado; se a Meta responder
 * "Unsupported request - method type", repete UMA vez com POST (mesmos params
 * no corpo form-urlencoded). Logs sem tokens/segredos.
 */
async function tokenRequestWithMethodRetry(
  url: URL
): Promise<{ res: Response; raw: any }> {
  const attempt = async (method: "GET" | "POST") => {
    const init: RequestInit = { method, signal: AbortSignal.timeout(15_000) };
    let target = url.toString();
    if (method === "POST") {
      target = `${url.origin}${url.pathname}`;
      init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
      init.body = new URLSearchParams(url.searchParams).toString();
    }
    const res = await fetch(target, init);
    const raw = await res.json().catch(() => null);
    if (!res.ok || !raw) {
      console.warn("[oauth] Falha na troca de token", {
        method,
        code: raw?.error?.code,
        error_subcode: raw?.error?.error_subcode,
        fbtrace_id: raw?.error?.fbtrace_id,
        httpStatus: res.status,
      });
    }
    return { res, raw };
  };

  const first = await attempt("GET");
  const message: unknown = first.raw?.error?.message;
  if (!first.res.ok && typeof message === "string" && UNSUPPORTED_METHOD_RE.test(message)) {
    return attempt("POST");
  }
  return first;
}

/**
 * Troca o token de curta duração por um token de longa duração (60 dias).
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const { appSecret: clientSecret } = getInstagramAppCredentials();

  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const { res, raw } = await tokenRequestWithMethodRetry(url);
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
 * Erro da renovação de token com contexto para decidir se é PERMANENTE
 * (token revogado/expirado → reconectar) ou PASSAGEIRO (rede/limite → tentar
 * de novo no próximo ciclo, sem desconectar a conta).
 */
export class MetaTokenError extends Error {
  readonly httpStatus: number;
  readonly code?: number;
  constructor(message: string, httpStatus: number, code?: number) {
    super(message);
    this.name = "MetaTokenError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
  /** Token morto de vez: só 190 (OAuthException) ou 400/401. O resto é passageiro. */
  get isPermanent(): boolean {
    return this.code === 190 || this.httpStatus === 400 || this.httpStatus === 401;
  }
}

/**
 * Renova um token de longa duração do Instagram (ig_refresh_token), gerando
 * outro de 60 dias. A Meta só aceita token com +24h de vida. Usado pelo cron
 * de auto-renovação (src/lib/meta/token-renewal.ts) para o token nunca vencer.
 */
export async function refreshInstagramLongLivedToken(
  longLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  let res: Response;
  let raw: any;
  try {
    ({ res, raw } = await tokenRequestWithMethodRetry(url));
  } catch (err) {
    // Timeout / rede → passageiro (httpStatus 0).
    throw new MetaTokenError(`Falha de rede ao renovar token: ${(err as Error).message}`, 0);
  }

  if (!res.ok || !raw) {
    const errorMsg = raw?.error?.message || `Falha ao renovar token (HTTP ${res.status})`;
    throw new MetaTokenError(errorMsg, res.status, raw?.error?.code);
  }

  const parsed = longLivedTokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MetaTokenError("Resposta de renovação de token inválida.", res.status);
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
  /** ID app-scoped (`id` do /me); distinto do igUserId (user_id) quando a Meta devolve ambos. */
  metaUserId?: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/me`);
  url.searchParams.set("fields", "id,user_id,username,name,profile_picture_url");
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
    metaUserId: parsed.data.id,
    username: parsed.data.username,
    name: parsed.data.name,
    profilePicUrl: parsed.data.profile_picture_url,
  };
}

/** ID do usuário do Facebook dono do token (null se não for possível obter). */
export async function fetchFacebookUserId(userAccessToken: string): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me`);
  url.searchParams.set("fields", "id");
  url.searchParams.set("access_token", userAccessToken);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    const raw = await res.json().catch(() => null);
    if (!res.ok || typeof raw?.id !== "string" || !raw.id) {
      console.warn("[oauth] Não foi possível obter o ID do usuário do Facebook", {
        code: raw?.error?.code,
        httpStatus: res.status,
      });
      return null;
    }
    return raw.id;
  } catch (error) {
    console.warn("[oauth] Falha ao obter o ID do usuário do Facebook", (error as Error).message);
    return null;
  }
}

/**
 * Inscreve automaticamente os webhooks da Meta nos campos comments, messages e messaging_postbacks.
 */
export async function subscribeAccountWebhooks(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.instagram.com/${GRAPH_API_VERSION}/me/subscribed_apps`, {
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
  const { appId: clientId, appSecret: clientSecret } = getFacebookAppCredentials();

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
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

/**
 * Troca o token de usuário do Facebook (curto) por um de longa duração (~60d).
 * Essencial para o token "nunca expirar": o token de PÁGINA obtido a partir de
 * um token de usuário de longa duração NÃO expira. Sem este passo, o token de
 * Página também seria curto e morreria em ~1h.
 */
export async function exchangeForLongLivedFacebookUserToken(
  shortLivedUserToken: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const { appId: clientId, appSecret: clientSecret } = getFacebookAppCredentials();

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("fb_exchange_token", shortLivedUserToken);

  const res = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(15_000) });
  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw || !raw.access_token) {
    const errorMsg = raw?.error?.message || "Falha ao gerar token de longa duração do Facebook";
    throw new Error(`Meta Facebook Token Exchange Error: ${errorMsg}`);
  }

  return { accessToken: raw.access_token, expiresIn: raw.expires_in };
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
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`);
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
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${igId}?fields=username,name,profile_picture_url&access_token=${page.access_token}`,
          { signal: AbortSignal.timeout(10_000) }
        );
        const igData = await igProfileRes.json().catch(() => null);
        if (igData?.username) {
          username = igData.username;
          name = igData.name;
          profilePicUrl = igData.profile_picture_url;
        }
      } catch {
        // Sem o perfil, a conta fica com o nome da Página; registra para não falhar em silêncio.
        console.warn("[oauth] Falha ao ler o perfil do Instagram da Página", page.id);
      }

      // Inscreve a Página nos webhooks oficiais (falha não bloqueia a conexão,
      // mas precisa aparecer no log — nunca logar tokens).
      try {
        const subRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${page.id}/subscribed_apps`, {
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
        const subData = await subRes.json().catch(() => null);
        if (!subRes.ok || !subData?.success) {
          console.warn("[oauth] Falha ao inscrever webhooks da Página", page.id);
        }
      } catch {
        console.warn("[oauth] Falha ao inscrever webhooks da Página", page.id);
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
