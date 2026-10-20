import { describe, expect, it, vi } from "vitest";
import { publishToInstagram, type PublishInput, type PublisherDeps } from "./publisher";

function fakeGraph(responses: Array<{ match: RegExp; body: unknown; status?: number }>) {
  const calls: Array<{ url: string; body?: Record<string, string> }> = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    calls.push({ url: href, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const hit = responses.find((response) => response.match.test(href));
    return new Response(JSON.stringify(hit?.body ?? {}), { status: hit?.status ?? 200 });
  });
  const deps: PublisherDeps = { fetch: fetchMock as unknown as typeof fetch, sleep: async () => {}, pollBudgetMs: 1_000 };
  return { calls, deps };
}

const base: PublishInput = {
  igUserId: "17841",
  token: "tok",
  provider: "instagram",
  format: "feed",
  mediaType: "IMAGE",
  mediaUrls: ["https://cdn.exemplo.com/foto.jpg"],
  caption: "Legenda",
};

describe("publishToInstagram", () => {
  it("publica imagem no feed em duas etapas e busca o link", async () => {
    const { calls, deps } = fakeGraph([
      { match: /17841\/media_publish/, body: { id: "MEDIA1" } },
      { match: /17841\/media$/, body: { id: "CONT1" } },
      { match: /MEDIA1\?fields=permalink/, body: { permalink: "https://instagram.com/p/x" } },
    ]);
    const result = await publishToInstagram(base, deps);
    expect(result).toEqual({ ok: true, mediaId: "MEDIA1", permalink: "https://instagram.com/p/x", warning: undefined });
    expect(calls[0].body).toEqual({ image_url: base.mediaUrls[0], caption: "Legenda" });
    expect(calls[1].body).toEqual({ creation_id: "CONT1" });
    expect(calls[0].url).toContain("https://graph.instagram.com/");
  });

  it("explica a falta de permissão de publicação sem tentar de novo", async () => {
    const { deps } = fakeGraph([{ match: /media$/, status: 403, body: { error: { code: 10, message: "perm" } } }]);
    const result = await publishToInstagram(base, deps);
    expect(result).toMatchObject({ ok: false, retryable: false, expired: false });
    if (!result.ok) expect(result.error).toContain("instagram_business_content_publish");
  });

  it("marca token expirado", async () => {
    const { deps } = fakeGraph([{ match: /media$/, status: 400, body: { error: { code: 190 } } }]);
    expect(await publishToInstagram(base, deps)).toMatchObject({ ok: false, expired: true, retryable: false });
  });

  it("reels espera o vídeo ficar pronto antes de publicar", async () => {
    const { calls, deps } = fakeGraph([
      { match: /media_publish/, body: { id: "R1" } },
      { match: /CONTR\?fields=status_code/, body: { status_code: "FINISHED" } },
      { match: /media$/, body: { id: "CONTR" } },
    ]);
    const result = await publishToInstagram({ ...base, format: "reels", mediaType: "VIDEO", mediaUrls: ["https://cdn.exemplo.com/v.mp4"] }, deps);
    expect(result.ok).toBe(true);
    expect(calls[0].body).toMatchObject({ media_type: "REELS", video_url: "https://cdn.exemplo.com/v.mp4" });
  });

  it("carrossel cria um contêiner por item e um contêiner pai", async () => {
    let n = 0;
    const { calls, deps } = fakeGraph([
      { match: /media_publish/, body: { id: "C1" } },
      { match: /media$/, body: { get id() { n += 1; return `ITEM${n}`; } } },
    ]);
    const result = await publishToInstagram({ ...base, mediaType: "CAROUSEL", mediaUrls: ["https://a/1.jpg", "https://a/2.jpg"] }, deps);
    expect(result.ok).toBe(true);
    expect(calls.filter((call) => call.body?.is_carousel_item === "true")).toHaveLength(2);
    expect(calls[2].body).toMatchObject({ media_type: "CAROUSEL", children: "ITEM1,ITEM2" });
  });

  it("recusa post sem mídia", async () => {
    const { deps } = fakeGraph([]);
    expect(await publishToInstagram({ ...base, mediaUrls: [] }, deps)).toMatchObject({ ok: false });
  });
});
