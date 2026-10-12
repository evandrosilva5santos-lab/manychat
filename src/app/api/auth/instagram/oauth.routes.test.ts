import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tenancy, connect, ConnectUserError } = vi.hoisted(() => ({
  ConnectUserError: class ConnectUserError extends Error {},
  tenancy: { getCurrentActor: vi.fn(), getOrCreateWorkspaceForActor: vi.fn(), workspaceExists: vi.fn() },
  connect: { connectViaInstagram: vi.fn(), connectViaFacebook: vi.fn() },
}));
vi.mock("@/lib/tenancy", () => ({ ...tenancy, IMPERSONATION_COOKIE: "fluxo_workspace_view" }));
vi.mock("@/lib/meta/connect-account", () => ({ ...connect, ConnectUserError }));

import { createConnectInvite } from "@/lib/meta/connect-invite";
import { createOAuthState } from "@/lib/meta/oauth";
import { GET as callbackGET } from "./callback/route";
import { GET as loginGET } from "./login/route";

const ORIGIN = "http://localhost:3007";
const login = (query: string, cookie?: string) =>
  loginGET(new NextRequest(`${ORIGIN}/api/auth/instagram/login${query}`, cookie ? { headers: { cookie } } : undefined));
const callback = (query: string) => callbackGET(new NextRequest(`https://app.test/api/auth/instagram/callback${query}`));
const location = (res: Response) => new URL(res.headers.get("location") ?? "");

beforeEach(() => {
  vi.stubEnv("META_APP_ID", "meta_111");
  vi.stubEnv("META_APP_SECRET", "meta_secret");
  vi.stubEnv("IG_APP_ID", "ig_222");
  vi.stubEnv("IG_APP_SECRET", "ig_secret");
  vi.stubEnv("OAUTH_STATE_SECRET", "state-secret-de-teste-com-tamanho-suficiente");
  vi.stubEnv("APP_URL", "https://app.test");
  tenancy.getCurrentActor.mockResolvedValue({ id: "u1", role: "CLIENT", name: "C", email: "c@x" });
  tenancy.getOrCreateWorkspaceForActor.mockResolvedValue({ id: "ws_sessao" });
  tenancy.workspaceExists.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("GET /api/auth/instagram/login", () => {
  it("Instagram (padrão) usa o ID do app do Instagram e a redirect URI canônica", async () => {
    const url = location(await login("?mode=instagram"));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("ig_222");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/api/auth/instagram/callback");
  });

  it("Facebook usa o ID do App da Meta no diálogo do Facebook", async () => {
    const url = location(await login("?mode=facebook"));
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.pathname).toMatch(/\/dialog\/oauth$/);
    expect(url.searchParams.get("client_id")).toBe("meta_111");
  });

  it("IG_APP_ID igual ao META_APP_ID volta para a tela com o erro explicado, sem ir à Meta", async () => {
    vi.stubEnv("IG_APP_ID", "meta_111");
    const url = location(await login("?mode=instagram"));
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/ajustes`);
    expect(url.searchParams.get("error")).toContain("ID do app do Instagram");
  });

  it("cliente com convite válido inicia o login amarrado ao workspace do convite", async () => {
    tenancy.getCurrentActor.mockResolvedValue(null);
    const convite = createConnectInvite("ws_cliente");
    const url = location(await login(`?from=conectar&mode=facebook&convite=${convite}`));
    expect(url.hostname).toBe("www.facebook.com");
    const state = url.searchParams.get("state") ?? "";
    const res = await callback(`?code=abc&state=${encodeURIComponent(state)}`);
    expect(connect.connectViaFacebook).toHaveBeenCalledWith("abc", "https://app.test/api/auth/instagram/callback", "ws_cliente");
    const back = location(res);
    expect(back.pathname).toBe("/conectar");
    expect(back.searchParams.get("convite")).toBe(convite);
  });

  it("/conectar sem sessão e sem convite volta com aviso para pedir um novo link", async () => {
    tenancy.getCurrentActor.mockResolvedValue(null);
    const url = location(await login("?from=conectar&mode=instagram"));
    expect(url.pathname).toBe("/conectar");
    expect(url.searchParams.get("error")).toContain("Link de conexão inválido");
  });

  it("convite adulterado é recusado", async () => {
    tenancy.getCurrentActor.mockResolvedValue(null);
    const url = location(await login(`?from=conectar&convite=${createConnectInvite("ws_cliente")}x`));
    expect(url.searchParams.get("error")).toContain("Link de conexão inválido");
  });

  it("convite de workspace que não existe mais é recusado antes de ir à Meta", async () => {
    tenancy.getCurrentActor.mockResolvedValue(null);
    tenancy.workspaceExists.mockResolvedValue(false);
    const url = location(await login(`?from=conectar&convite=${createConnectInvite("ws_apagado")}`));
    expect(url.pathname).toBe("/conectar");
    expect(url.searchParams.get("error")).toContain("Link de conexão inválido");
  });

  it("superadmin vendo um cliente conecta no workspace desse cliente", async () => {
    tenancy.getCurrentActor.mockResolvedValue({ id: "adm", role: "SUPERADMIN", name: "A", email: "a@x" });
    const state = location(await login("?mode=instagram", "fluxo_workspace_view=ws_visto")).searchParams.get("state") ?? "";
    await callback(`?code=abc&state=${encodeURIComponent(state)}`);
    expect(connect.connectViaInstagram).toHaveBeenCalledWith("abc", expect.any(String), "ws_visto");
  });
});

describe("GET /api/auth/instagram/callback", () => {
  const stateFor = (mode: "instagram" | "facebook") =>
    encodeURIComponent(createOAuthState({ mode, workspaceId: "ws_1", returnTo: `${ORIGIN}/ajustes` }));

  it("state inválido não chama a Meta e volta para uma página pública (sem prompt de senha)", async () => {
    const url = location(await callback("?code=abc&state=forjado"));
    expect(url.pathname).toBe("/conectar");
    expect(url.searchParams.get("error")).toContain("inválida ou expirada");
    expect(connect.connectViaInstagram).not.toHaveBeenCalled();
    expect(connect.connectViaFacebook).not.toHaveBeenCalled();
  });

  it("modo Facebook chama só o fluxo do Facebook e, se falhar, NÃO tenta o Instagram", async () => {
    connect.connectViaFacebook.mockRejectedValue(new ConnectUserError("Nenhuma conta profissional do Instagram vinculada a uma Página"));
    const url = location(await callback(`?code=abc&state=${stateFor("facebook")}`));
    expect(connect.connectViaInstagram).not.toHaveBeenCalled();
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/ajustes`);
    expect(url.searchParams.get("error")).toContain("Nenhuma conta profissional");
  });

  it("sucesso volta para a tela de origem com a conta conectada", async () => {
    connect.connectViaInstagram.mockResolvedValue(["loja"]);
    const url = location(await callback(`?code=abc&state=${stateFor("instagram")}`));
    expect(url.searchParams.get("connected")).toBe("true");
    expect(url.searchParams.get("username")).toBe("loja");
  });

  it("erro técnico da Meta vira mensagem acionável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    connect.connectViaInstagram.mockRejectedValue(new Error("Meta OAuth Error: Invalid platform app"));
    const url = location(await callback(`?code=abc&state=${stateFor("instagram")}`));
    expect(url.searchParams.get("error")).toContain("ID do app do Instagram");
  });

  it("erro interno (ex.: banco) não vaza para a URL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    connect.connectViaInstagram.mockRejectedValue(new Error("Invalid `prisma.instagramAccount.create()` invocation: accessTokenEnc=segredo"));
    const url = location(await callback(`?code=abc&state=${stateFor("instagram")}`));
    expect(url.searchParams.get("error")).toBe("Não foi possível salvar a conexão. Tente novamente em instantes.");
  });

  it("cancelamento na Meta vira mensagem amigável", async () => {
    const url = location(await callback(`?error=access_denied&error_reason=user_denied&state=${stateFor("instagram")}`));
    expect(url.searchParams.get("error")).toBe("Autorização cancelada no Instagram/Facebook.");
    expect(connect.connectViaInstagram).not.toHaveBeenCalled();
  });

  it("sem código de autorização não tenta conectar", async () => {
    const url = location(await callback(`?state=${stateFor("instagram")}`));
    expect(url.searchParams.get("error")).toBeTruthy();
    expect(connect.connectViaInstagram).not.toHaveBeenCalled();
  });
});
