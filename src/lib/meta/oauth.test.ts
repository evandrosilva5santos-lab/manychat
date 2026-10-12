import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OAuthConfigError,
  createOAuthState,
  describeOAuthError,
  exchangeCodeForShortLivedToken,
  exchangeFacebookCodeForToken,
  exchangeForLongLivedFacebookUserToken,
  exchangeForLongLivedToken,
  fetchFacebookPagesAndInstagram,
  fetchInstagramProfile,
  getFacebookAppCredentials,
  getFacebookBusinessLoginUrl,
  getInstagramAppCredentials,
  getInstagramOAuthUrl,
  getOAuthSigningSecret,
  readOAuthState,
  subscribeAccountWebhooks,
} from "./oauth";

const fetchMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };
const NOW = 1_760_000_000_000;
const MINUTE = 60_000;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.META_APP_ID = "meta_1";
  process.env.META_APP_SECRET = "meta_secret_1";
  process.env.IG_APP_ID = "ig_2";
  process.env.IG_APP_SECRET = "ig_secret_2";
  process.env.OAUTH_STATE_SECRET = "state_secret_de_teste";
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("Instagram Business Login OAuth", () => {
  it("gera a URL oficial de autorização com os escopos corretos da Meta", () => {
    const redirectUri = "https://app.startinc.com.br/api/auth/instagram/callback";
    const state = "state_seguro_anti_csrf";

    const url = getInstagramOAuthUrl(redirectUri, state);
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://www.instagram.com");
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("ig_2");
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toContain("instagram_business_manage_messages");
    expect(parsed.searchParams.get("scope")).toContain("instagram_business_manage_comments");
    expect(parsed.searchParams.get("scope")).toContain("instagram_business_basic");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("enable_fb_login")).toBe("0");
    expect(parsed.searchParams.get("force_authentication")).toBe("1");
  });

  it("troca o código recebido pelo token de curta duração usando o app do Instagram", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "short_tok_abc", user_id: "178414099999" }), { status: 200 })
    );

    const res = await exchangeCodeForShortLivedToken("codigo_meta_123", "https://app.startinc.com.br/callback");
    expect(res.accessToken).toBe("short_tok_abc");
    expect(res.igUserId).toBe("178414099999");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.instagram.com/oauth/access_token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body);
    expect(body.get("client_id")).toBe("ig_2");
    expect(body.get("client_secret")).toBe("ig_secret_2");
  });

  it("troca o token de curta duração pelo token de 60 dias com o secret do Instagram", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "long_tok_xyz", expires_in: 5184000 }), { status: 200 })
    );

    const res = await exchangeForLongLivedToken("short_tok_abc");
    expect(res.accessToken).toBe("long_tok_xyz");
    expect(res.expiresIn).toBe(5184000);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("https://graph.instagram.com/access_token");
    expect(url).toContain("grant_type=ig_exchange_token");
    expect(new URL(url).searchParams.get("client_secret")).toBe("ig_secret_2");
  });

  it("busca o perfil do usuário autenticado", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "178414099999",
          username: "evansantoos",
          name: "Evan Santos",
          profile_picture_url: "https://example.com/pic.jpg",
        }),
        { status: 200 }
      )
    );

    const profile = await fetchInstagramProfile("long_tok_xyz");
    expect(profile.igUserId).toBe("178414099999");
    expect(profile.username).toBe("evansantoos");
    expect(profile.name).toBe("Evan Santos");
  });

  it("inscreve os webhooks obrigatórios na Meta", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const ok = await subscribeAccountWebhooks("long_tok_xyz");
    expect(ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.instagram.com/v21.0/me/subscribed_apps");
    expect(JSON.parse(init.body).subscribed_fields).toEqual(["comments", "messages", "messaging_postbacks"]);
  });
});

describe("credenciais por produto", () => {
  it("getFacebookAppCredentials lê META_APP_ID/META_APP_SECRET", () => {
    expect(getFacebookAppCredentials()).toEqual({ appId: "meta_1", appSecret: "meta_secret_1" });
  });

  it("getFacebookAppCredentials falha com OAuthConfigError quando falta o app da Meta", () => {
    delete process.env.META_APP_ID;
    expect(() => getFacebookAppCredentials()).toThrow(OAuthConfigError);
  });

  it("getInstagramAppCredentials lê IG_APP_ID/IG_APP_SECRET", () => {
    expect(getInstagramAppCredentials()).toEqual({ appId: "ig_2", appSecret: "ig_secret_2" });
  });

  it("getInstagramAppCredentials recusa IG_APP_ID igual ao ID do App da Meta", () => {
    process.env.IG_APP_ID = "meta_1";
    expect(() => getInstagramAppCredentials()).toThrow(OAuthConfigError);
    expect(() => getInstagramAppCredentials()).toThrow(/ID do app do Instagram/);
  });

  it("getInstagramAppCredentials recusa IG_APP_ID ausente", () => {
    delete process.env.IG_APP_ID;
    expect(() => getInstagramAppCredentials()).toThrow(/ID do app do Instagram/);
  });

  it("getInstagramAppCredentials recusa IG_APP_SECRET vazio", () => {
    process.env.IG_APP_SECRET = "";
    expect(() => getInstagramAppCredentials()).toThrow(/ID do app do Instagram/);
  });

  it("OAuthConfigError tem name próprio", () => {
    const err = new OAuthConfigError("x");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("OAuthConfigError");
  });

  it("URL do Facebook usa META_APP_ID, versão da Graph e business_management", () => {
    const url = new URL(getFacebookBusinessLoginUrl("https://app.test/cb", "st"));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v21.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("meta_1");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement,pages_manage_metadata,business_management"
    );
    expect(url.searchParams.get("extras")).toBeNull();
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("URL do Facebook inclui extras de onboarding só com useFbe", () => {
    const url = new URL(getFacebookBusinessLoginUrl("https://app.test/cb", "st", true));
    expect(url.searchParams.get("extras")).toContain("IG_API_ONBOARDING");
  });

  it("URL do Facebook não depende do app do Instagram", () => {
    delete process.env.IG_APP_ID;
    delete process.env.IG_APP_SECRET;
    expect(() => getFacebookBusinessLoginUrl("https://app.test/cb", "st")).not.toThrow();
  });

  it("URL do Instagram falha quando IG_APP_ID é o ID do App da Meta", () => {
    process.env.IG_APP_ID = "meta_1";
    expect(() => getInstagramOAuthUrl("https://app.test/cb", "st")).toThrow(/ID do app do Instagram/);
  });

  it("troca de código do Facebook usa o app da Meta", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: "fb_user_tok" }), { status: 200 }));

    const res = await exchangeFacebookCodeForToken("code_fb", "https://app.test/cb");
    expect(res.accessToken).toBe("fb_user_tok");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v21.0/oauth/access_token");
    expect(url.searchParams.get("client_id")).toBe("meta_1");
    expect(url.searchParams.get("client_secret")).toBe("meta_secret_1");
  });

  it("token de longa duração do Facebook usa o app da Meta", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "fb_long", expires_in: 5184000 }), { status: 200 })
    );

    const res = await exchangeForLongLivedFacebookUserToken("fb_short");
    expect(res.accessToken).toBe("fb_long");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(url.searchParams.get("client_id")).toBe("meta_1");
    expect(url.searchParams.get("client_secret")).toBe("meta_secret_1");
  });
});

describe("fetchFacebookPagesAndInstagram", () => {
  const pagesResponse = () =>
    new Response(
      JSON.stringify({
        data: [
          { id: "page_1", name: "Loja", access_token: "page_tok_secreto", instagram_business_account: { id: "ig_9" } },
        ],
      }),
      { status: 200 }
    );

  it("avisa (sem vazar token) quando a inscrição de webhooks da Página falha", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(pagesResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: "loja" }), { status: 200 }))
      .mockRejectedValueOnce(new Error("timeout"));

    const accounts = await fetchFacebookPagesAndInstagram("user_tok");
    expect(accounts).toHaveLength(1);
    expect(accounts[0].username).toBe("loja");
    expect(warn).toHaveBeenCalledWith("[oauth] Falha ao inscrever webhooks da Página", "page_1");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("page_tok_secreto");
  });

  it("avisa quando a Meta responde sem success na inscrição da Página", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(pagesResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: "loja" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "x" } }), { status: 400 }));

    await fetchFacebookPagesAndInstagram("user_tok");
    expect(warn).toHaveBeenCalledWith("[oauth] Falha ao inscrever webhooks da Página", "page_1");
  });

  it("não avisa quando a inscrição da Página dá certo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(pagesResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: "loja" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await fetchFacebookPagesAndInstagram("user_tok");
    expect(warn).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[2][0]).toBe("https://graph.facebook.com/v21.0/page_1/subscribed_apps");
  });
});

describe("state OAuth assinado", () => {
  const input = { mode: "instagram" as const, workspaceId: "ws_1", returnTo: "/ajustes" };

  it("faz o round-trip com modo, workspace e retorno", () => {
    const state = createOAuthState(input, NOW);
    const payload = readOAuthState(state, NOW + MINUTE);
    expect(payload).toMatchObject(input);
    expect(payload?.iat).toBe(NOW);
    expect(payload?.nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("aceita returnTo absoluto https", () => {
    const state = createOAuthState({ ...input, mode: "facebook", returnTo: "https://app.test/conectar" }, NOW);
    expect(readOAuthState(state, NOW)?.returnTo).toBe("https://app.test/conectar");
  });

  it("gera nonces diferentes a cada chamada", () => {
    expect(createOAuthState(input, NOW)).not.toBe(createOAuthState(input, NOW));
  });

  it("retorna null para state vazio ou ausente", () => {
    expect(readOAuthState(null, NOW)).toBeNull();
    expect(readOAuthState(undefined, NOW)).toBeNull();
    expect(readOAuthState("", NOW)).toBeNull();
  });

  it("retorna null para assinatura adulterada", () => {
    const state = createOAuthState(input, NOW);
    const [body, sig] = state.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(readOAuthState(`${body}.${flipped}`, NOW)).toBeNull();
    expect(readOAuthState(`${body}.abc`, NOW)).toBeNull();
  });

  it("retorna null para payload adulterado", () => {
    const state = createOAuthState(input, NOW);
    const [, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ ...input, workspaceId: "ws_outro", nonce: "a".repeat(32), iat: NOW })).toString(
      "base64url"
    );
    expect(readOAuthState(`${forged}.${sig}`, NOW)).toBeNull();
  });

  it("retorna null quando expirado (16 minutos depois)", () => {
    const state = createOAuthState(input, NOW);
    expect(readOAuthState(state, NOW + 14 * MINUTE)).not.toBeNull();
    expect(readOAuthState(state, NOW + 16 * MINUTE)).toBeNull();
  });

  it("retorna null para formato inválido", () => {
    expect(readOAuthState("sem-ponto", NOW)).toBeNull();
    expect(readOAuthState("a.b.c", NOW)).toBeNull();
    expect(readOAuthState("%%%.zzz", NOW)).toBeNull();
  });

  it("rejeita returnTo que leva a outro domínio", () => {
    expect(() => createOAuthState({ ...input, returnTo: "//evil.com" }, NOW)).toThrow();
    expect(() => createOAuthState({ ...input, returnTo: "/\\evil.com" }, NOW)).toThrow();
    expect(() => createOAuthState({ ...input, returnTo: "javascript:alert(1)" }, NOW)).toThrow();
    expect(() => createOAuthState({ ...input, returnTo: "ajustes" }, NOW)).toThrow();
  });

  it("readOAuthState retorna null para returnTo inválido mesmo com assinatura válida", async () => {
    const crypto = await import("crypto");
    const body = Buffer.from(
      JSON.stringify({ ...input, returnTo: "//evil.com", nonce: "b".repeat(32), iat: NOW })
    ).toString("base64url");
    const sig = crypto.createHmac("sha256", "state_secret_de_teste").update(`state:${body}`).digest("hex");
    expect(readOAuthState(`${body}.${sig}`, NOW)).toBeNull();
  });

  it("falha fechado sem segredo configurado", () => {
    delete process.env.OAUTH_STATE_SECRET;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => getOAuthSigningSecret()).toThrow(OAuthConfigError);
    expect(() => createOAuthState(input, NOW)).toThrow(OAuthConfigError);
  });

  it("usa TOKEN_ENCRYPTION_KEY quando não há OAUTH_STATE_SECRET", () => {
    delete process.env.OAUTH_STATE_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = "chave_de_cripto";
    expect(getOAuthSigningSecret()).toBe("chave_de_cripto");
    const state = createOAuthState(input, NOW);
    expect(readOAuthState(state, NOW)).not.toBeNull();
  });

  it("state assinado com outro segredo é inválido", () => {
    const state = createOAuthState(input, NOW);
    process.env.OAUTH_STATE_SECRET = "outro_segredo";
    expect(readOAuthState(state, NOW)).toBeNull();
  });
});

describe("describeOAuthError", () => {
  it("explica o erro de app inválido do Instagram", () => {
    expect(describeOAuthError("Invalid platform app")).toBe(
      "O ID do app do Instagram está errado. Use o 'ID do app do Instagram' (Painel da Meta › Instagram › Configuração da API com login do Instagram), não o ID do App da Meta."
    );
  });

  it("explica a URL de retorno não cadastrada, com e sem a URL", () => {
    expect(describeOAuthError("Error validating redirect_uri", "https://app.test/cb")).toBe(
      "A URL de retorno não está cadastrada no painel da Meta: https://app.test/cb."
    );
    expect(describeOAuthError("URL Blocked: This redirect failed")).toBe(
      "A URL de retorno não está cadastrada no painel da Meta."
    );
  });

  it("explica autorização cancelada", () => {
    expect(describeOAuthError("access_denied")).toBe("Autorização cancelada no Instagram/Facebook.");
    expect(describeOAuthError("Permissions error")).toBe("Autorização cancelada no Instagram/Facebook.");
  });

  it("explica código já usado ou expirado", () => {
    const msg = "Este link de autorização expirou. Clique em conectar novamente.";
    expect(describeOAuthError("This authorization code has been used")).toBe(msg);
    expect(describeOAuthError("The authorization code has expired")).toBe(msg);
  });

  it("devolve o texto original aparado e limitado a 300 caracteres", () => {
    expect(describeOAuthError("  erro qualquer  ")).toBe("erro qualquer");
    expect(describeOAuthError("x".repeat(500))).toHaveLength(300);
  });
});

describe("Facebook Login para Empresas com config_id", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("usa config_id no lugar de scope quando META_LOGIN_CONFIG_ID está definido", () => {
    vi.stubEnv("META_APP_ID", "meta_1");
    vi.stubEnv("META_APP_SECRET", "meta_s");
    vi.stubEnv("META_LOGIN_CONFIG_ID", "cfg_42");
    const url = new URL(getFacebookBusinessLoginUrl("https://app.test/cb", "st"));
    expect(url.searchParams.get("config_id")).toBe("cfg_42");
    expect(url.searchParams.get("scope")).toBeNull();
  });
});
