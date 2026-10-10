import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defaultGraphClient } from "./graph";
import { GET } from "@/app/api/instagram/media/route";

describe("InstagramGraphClient - getUserMedia", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("deve retornar mock quando não há token configurado", async () => {
    delete process.env.IG_ACCESS_TOKEN;
    const result = await defaultGraphClient.getUserMedia();

    expect(result.success).toBe(true);
    expect(result.mock).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const firstPost = result.data[0];
    expect(firstPost).toHaveProperty("id");
    expect(firstPost).toHaveProperty("caption");
    expect(firstPost).toHaveProperty("mediaType");
    expect(firstPost).toHaveProperty("timestamp");
    expect(firstPost).toHaveProperty("likeCount");
    expect(firstPost).toHaveProperty("commentsCount");
  });

  it("deve chamar a Graph API corretamente quando houver token", async () => {
    process.env.IG_ACCESS_TOKEN = "test-token";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "123",
            caption: "Hello World",
            media_type: "IMAGE",
            media_url: "https://example.com/image.jpg",
            timestamp: "2026-01-01T00:00:00+0000",
            like_count: 10,
            comments_count: 5,
          }
        ]
      })
    } as Response);

    const targetUserId = "me";
    const limit = 10;

    const result = await defaultGraphClient.getUserMedia(targetUserId, limit);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Validar fetch request payload
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain(`https://graph.facebook.com/v21.0/${targetUserId}/media`);
    expect(url.toString()).toContain("fields=id%2Ccaption%2Cmedia_type%2Cmedia_url%2Cthumbnail_url%2Cpermalink%2Ctimestamp%2Clike_count%2Ccomments_count");
    expect(url.toString()).toContain("limit=10");

    expect(init?.headers).toEqual({
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json"
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].mediaType).toBe("IMAGE");
    expect(result.data[0].likeCount).toBe(10);
  });

  it("deve retornar erro formatado quando a API rejeita (HTTP 400)", async () => {
    process.env.IG_ACCESS_TOKEN = "test-token";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: "Token expired"
        }
      })
    } as Response);

    const result = await defaultGraphClient.getUserMedia("me");

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.error).toBe("Token expired");
  });

  it("deve retornar erro defensivo quando a rede falha / execeção lançada", async () => {
    process.env.IG_ACCESS_TOKEN = "test-token";

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network Error"));

    const result = await defaultGraphClient.getUserMedia("me");

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.error).toBe("Network Error");
  });
});

describe("GET /api/instagram/media", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("deve retornar 200 com os dados simulados quando não há token", async () => {
    delete process.env.IG_ACCESS_TOKEN;
    const req = new Request("http://localhost:3007/api/instagram/media");
    const response = await GET(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("deve aceitar parâmetros de limite e passar para o getUserMedia", async () => {
    process.env.IG_ACCESS_TOKEN = "test-token";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    } as Response);

    const req = new Request("http://localhost:3007/api/instagram/media?userId=12345&limit=5");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain("12345/media");
    expect(url.toString()).toContain("limit=5");
  });

  it("deve retornar 500 no caso de erro da API", async () => {
    process.env.IG_ACCESS_TOKEN = "test-token";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Auth Error" } })
    } as Response);

    const req = new Request("http://localhost:3007/api/instagram/media");
    const response = await GET(req);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Auth Error");
  });
});
