import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConnectInvite, readConnectInvite } from "./connect-invite";
import { createOAuthState, readOAuthState } from "./oauth";

const ORIGINAL_ENV = { ...process.env };
const NOW = 1_760_000_000_000;
const DAY = 86_400_000;

beforeEach(() => {
  process.env.OAUTH_STATE_SECRET = "state_secret_de_teste";
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("convite de conexão do cliente", () => {
  it("faz o round-trip do workspace", () => {
    const token = createConnectInvite("ws_cliente", NOW);
    expect(readConnectInvite(token, NOW + DAY)).toEqual({ workspaceId: "ws_cliente" });
  });

  it("expira após 7 dias por padrão", () => {
    const token = createConnectInvite("ws_cliente", NOW);
    expect(readConnectInvite(token, NOW + 7 * DAY - 1)).not.toBeNull();
    expect(readConnectInvite(token, NOW + 7 * DAY + 1)).toBeNull();
  });

  it("respeita ttl personalizado", () => {
    const token = createConnectInvite("ws_cliente", NOW, 1000);
    expect(readConnectInvite(token, NOW + 2000)).toBeNull();
  });

  it("retorna null para token vazio, malformado ou adulterado", () => {
    expect(readConnectInvite(null, NOW)).toBeNull();
    expect(readConnectInvite("", NOW)).toBeNull();
    expect(readConnectInvite("sem-ponto", NOW)).toBeNull();

    const token = createConnectInvite("ws_cliente", NOW);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ w: "ws_outro", exp: NOW + DAY })).toString("base64url");
    expect(readConnectInvite(`${forged}.${sig}`, NOW)).toBeNull();
    expect(readConnectInvite(`${token}0`, NOW)).toBeNull();
  });

  it("state OAuth não vale como convite", () => {
    const state = createOAuthState({ mode: "instagram", workspaceId: "ws_cliente", returnTo: "/conectar" }, NOW);
    expect(readConnectInvite(state, NOW)).toBeNull();
  });

  it("convite não vale como state OAuth", () => {
    const token = createConnectInvite("ws_cliente", NOW);
    expect(readOAuthState(token, NOW)).toBeNull();
  });

  it("rejeita workspace vazio na criação", () => {
    expect(() => createConnectInvite("", NOW)).toThrow();
  });

  it("falha fechado sem segredo configurado", () => {
    delete process.env.OAUTH_STATE_SECRET;
    expect(() => createConnectInvite("ws_cliente", NOW)).toThrow();
  });
});
