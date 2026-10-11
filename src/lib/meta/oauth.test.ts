import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  getInstagramOAuthUrl,
  subscribeAccountWebhooks,
} from "./oauth";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Instagram Business Login OAuth", () => {
  it("gera a URL oficial de autorização com os escopos corretos da Meta", () => {
    process.env.IG_APP_ID = "app_123456";
    const redirectUri = "https://app.startinc.com.br/api/auth/instagram/callback";
    const state = "state_seguro_anti_csrf";

    const url = getInstagramOAuthUrl(redirectUri, state);
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://www.instagram.com");
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("app_123456");
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toContain("instagram_business_manage_messages");
    expect(parsed.searchParams.get("scope")).toContain("instagram_business_manage_comments");
    expect(parsed.searchParams.get("scope")).toContain("instagram_business_basic");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("enable_fb_login")).toBe("0");
    expect(parsed.searchParams.get("force_authentication")).toBe("1");
  });

  it("troca o código recebido pelo token de curta duração", async () => {
    process.env.IG_APP_ID = "app_123456";
    process.env.IG_APP_SECRET = "secret_meta_987";

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "short_tok_abc", user_id: "178414099999" }), { status: 200 })
    );

    const res = await exchangeCodeForShortLivedToken("codigo_meta_123", "https://app.startinc.com.br/callback");
    expect(res.accessToken).toBe("short_tok_abc");
    expect(res.igUserId).toBe("178414099999");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.instagram.com/oauth/access_token");
    expect(init.method).toBe("POST");
  });

  it("troca o token de curta duração pelo token de 60 dias", async () => {
    process.env.IG_APP_SECRET = "secret_meta_987";

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "long_tok_xyz", expires_in: 5184000 }), { status: 200 })
    );

    const res = await exchangeForLongLivedToken("short_tok_abc");
    expect(res.accessToken).toBe("long_tok_xyz");
    expect(res.expiresIn).toBe(5184000);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("https://graph.instagram.com/access_token");
    expect(url).toContain("grant_type=ig_exchange_token");
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
