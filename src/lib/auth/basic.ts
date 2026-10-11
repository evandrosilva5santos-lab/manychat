// Senha na porta do painel (HTTP Basic), até o login de verdade com contas (item 8).
// Usado pelo proxy e, por defesa em profundidade, dentro das server actions.
// Só usa APIs Web (atob/TextDecoder) para funcionar em qualquer runtime.
//   SITE_PASSWORD = obrigatória em produção (sem ela o site fica fechado)
//   SITE_USER     = opcional, padrão "fluxo"

export const BASIC_AUTH_REALM = "Fluxo";
const DEFAULT_USER = "fluxo";

export type BasicAuthConfig = {
  user: string;
  password: string | undefined;
  isProduction: boolean;
};

/** authorized = credencial certa · open = dev sem senha · misconfigured = produção sem senha */
export type BasicAuthResult = "authorized" | "open" | "unauthorized" | "misconfigured";

type EnvLike = Record<string, string | undefined>;

// Rotas que a Meta e os seguidores acessam sem login.
const PUBLIC_PREFIXES = ["/api/webhook/", "/api/l/", "/api/meta/", "/api/auth/"];
const PUBLIC_PAGES = ["/privacidade", "/termos", "/exclusao-de-dados"];

export function readBasicAuthConfig(env: EnvLike = process.env): BasicAuthConfig {
  return {
    user: env.SITE_USER || DEFAULT_USER,
    password: env.SITE_PASSWORD || undefined,
    isProduction: env.NODE_ENV === "production",
  };
}

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/** Compara sem "vazar" pelo tempo de resposta quantos caracteres batem. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function decodeCredentials(authorization: string): { user: string; password: string } | null {
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Basic" || !token) return null;
  try {
    const binary = atob(token);
    const decoded = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function evaluateBasicAuth(authorization: string | null, config: BasicAuthConfig): BasicAuthResult {
  if (!config.password) {
    return config.isProduction ? "misconfigured" : "open";
  }
  if (!authorization) return "unauthorized";

  const credentials = decodeCredentials(authorization);
  if (!credentials) return "unauthorized";

  // Avalia as duas comparações sempre, para não revelar qual campo errou.
  const userOk = safeEqual(credentials.user, config.user);
  const passwordOk = safeEqual(credentials.password, config.password);
  return userOk && passwordOk ? "authorized" : "unauthorized";
}

export function isAccessAllowed(result: BasicAuthResult): boolean {
  return result === "authorized" || result === "open";
}
