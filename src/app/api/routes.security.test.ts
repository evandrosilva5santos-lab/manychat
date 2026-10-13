import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const graph = vi.hoisted(() => ({ getUserMedia: vi.fn() }));
const graphClientForAccount = vi.hoisted(() => vi.fn());
const getCurrentAccount = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount }));
vi.mock("@/lib/prisma", () => ({ prisma: { trackedLink: db } }));
vi.mock("@/lib/account", () => ({ getCurrentAccount }));
vi.mock("@/lib/engine/contacts", () => ({
  getOrCreateContact: vi.fn(),
  recordIncomingMessage: vi.fn(),
  recordOutgoingMessage: vi.fn(),
}));
vi.mock("@/lib/engine/matcher", () => ({ findMatchingTrigger: vi.fn() }));
vi.mock("@/lib/engine/runner", () => ({ executeFlow: vi.fn(), resumeFlowOnClick: vi.fn() }));

import { GET as mediaGET } from "./instagram/media/route";
import { GET as linkGET } from "./l/[code]/route";
import { GET as webhookGET, POST as webhookPOST } from "./webhook/instagram/route";

const AUTH = `Basic ${btoa("fluxo:senha-teste")}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_USER", "fluxo");
  vi.stubEnv("SITE_PASSWORD", "senha-teste");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/instagram/media", () => {
  const call = (query = "", authorized = true) =>
    mediaGET(
      new Request(`http://localhost/api/instagram/media${query}`, {
        headers: authorized ? { authorization: AUTH } : {},
      })
    );

  beforeEach(() => {
    getCurrentAccount.mockResolvedValue({ id: "acc_1", igUserId: "178_conta_conectada", status: "CONNECTED" });
    graphClientForAccount.mockResolvedValue(graph);
    graph.getUserMedia.mockResolvedValue({ success: true, data: [] });
  });

  it("returns 401 without credentials and never calls the Graph API", async () => {
    const res = await call("", false);
    expect(res.status).toBe(401);
    expect(graph.getUserMedia).not.toHaveBeenCalled();
  });

  it("ignora userId da URL e usa a conta ativa", async () => {
    await call("?userId=conta_de_outra_pessoa");
    expect(graphClientForAccount).toHaveBeenCalledWith("acc_1");
    expect(graph.getUserMedia).toHaveBeenCalledWith("178_conta_conectada", 25);
  });

  it.each([
    ["?limit=999", 50],
    ["?limit=0", 1],
    ["?limit=-5", 1],
    ["?limit=abc", 25],
    ["?limit=12", 12],
  ])("clamps %s to %i", async (query, expected) => {
    await call(query);
    expect(graph.getUserMedia).toHaveBeenCalledWith("178_conta_conectada", expected);
  });

  it("informa quando nenhum perfil conectado está selecionado", async () => {
    getCurrentAccount.mockResolvedValue(null);
    const res = await call();

    expect(res.status).toBe(409);
    expect(graphClientForAccount).not.toHaveBeenCalled();
    expect((await res.json()).error).toMatch(/perfil.*conectado/i);
  });

  it("returns a generic error when the Graph API fails (no internal details)", async () => {
    graph.getUserMedia.mockResolvedValue({ success: false, data: [], error: "Invalid OAuth access token EAAB-segredo" });
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("EAAB");
    expect(body.success).toBe(false);
  });

  it("returns a generic 500 when the Graph client throws", async () => {
    graph.getUserMedia.mockRejectedValue(new Error("stack interno /Users/x"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("/Users/x");
  });
});

describe("GET /api/l/[code]", () => {
  const call = (code: string, query = "") =>
    linkGET(new NextRequest(`http://localhost/api/l/${code}${query}`), { params: Promise.resolve({ code }) });

  it("returns 404 for an invalid code without touching the database", async () => {
    const res = await call("x");
    expect(res.status).toBe(404);
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("never redirects to a URL taken from the query string (no open redirect)", async () => {
    db.findUnique.mockResolvedValue(null);
    const res = await call("codigoInexistente1", "?to=https://site-malicioso.com");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects to the stored https URL and records the click", async () => {
    db.findUnique.mockResolvedValue({ id: "l1", url: "https://wa.me/5551999999999", firstClickedAt: null });
    db.update.mockResolvedValue({});
    const res = await call("codigoValido123");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wa.me/5551999999999");
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1" },
        data: expect.objectContaining({ clicks: { increment: 1 } }),
      })
    );
  });

  it("refuses to redirect to a stored URL that is not https", async () => {
    db.findUnique.mockResolvedValue({ id: "l2", url: "javascript:alert(1)", firstClickedAt: null });
    const res = await call("codigoValido456");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still redirects when recording the click fails", async () => {
    db.findUnique.mockResolvedValue({ id: "l3", url: "https://exemplo.com", firstClickedAt: null });
    db.update.mockRejectedValue(new Error("db down"));
    const res = await call("codigoValido789");
    expect(res.status).toBe(302);
  });

  it("returns 503 when the link cannot be looked up", async () => {
    db.findUnique.mockRejectedValue(new Error("db down"));
    const res = await call("codigoValido000");
    expect(res.status).toBe(503);
  });
});

describe("/api/webhook/instagram", () => {
  const body = JSON.stringify({ object: "instagram", entry: [] });
  const sign = (payload: string, secret: string) =>
    `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  const post = (payload: string, signature?: string) =>
    webhookPOST(
      new NextRequest("http://localhost/api/webhook/instagram", {
        method: "POST",
        body: payload,
        headers: signature ? { "x-hub-signature-256": signature } : {},
      })
    );
  const verify = (token: string) =>
    webhookGET(
      new NextRequest(
        `http://localhost/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=777`
      )
    );

  it("GET returns 500 when WEBHOOK_VERIFY_TOKEN is not configured (no default token)", async () => {
    vi.stubEnv("WEBHOOK_VERIFY_TOKEN", "");
    expect((await verify("fluxo_webhook_token")).status).toBe(500);
  });

  it("GET echoes the challenge only for the configured token", async () => {
    vi.stubEnv("WEBHOOK_VERIFY_TOKEN", "token-configurado");
    const ok = await verify("token-configurado");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("777");
    expect((await verify("errado")).status).toBe(403);
  });

  it("POST returns 500 when no app secret is configured", async () => {
    vi.stubEnv("IG_APP_SECRET", "");
    vi.stubEnv("META_APP_SECRET", "");
    expect((await post(body)).status).toBe(500);
  });

  it("POST rejects a missing or wrong signature with 401", async () => {
    vi.stubEnv("IG_APP_SECRET", "segredo-ig");
    expect((await post(body)).status).toBe(401);
    expect((await post(body, sign(body, "outro"))).status).toBe(401);
  });

  it("POST accepts a signature made with the Instagram app secret", async () => {
    vi.stubEnv("IG_APP_SECRET", "segredo-ig");
    vi.stubEnv("META_APP_SECRET", "segredo-meta");
    expect((await post(body, sign(body, "segredo-ig"))).status).toBe(200);
  });

  it("POST returns 400 for invalid JSON with a valid signature", async () => {
    vi.stubEnv("IG_APP_SECRET", "segredo-ig");
    expect((await post("{quebrado", sign("{quebrado", "segredo-ig"))).status).toBe(400);
  });

  it("POST accepts unsigned events only with the explicit dev flag", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("IG_APP_SECRET", "");
    vi.stubEnv("META_APP_SECRET", "");
    vi.stubEnv("ALLOW_UNSIGNED_WEBHOOKS", "1");
    expect((await post(body)).status).toBe(200);
  });
});
