import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headerStore = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerStore.get(name.toLowerCase()) ?? null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/account", () => ({
  getCurrentAccount: vi.fn(async () => ({
    id: "acc_1",
    username: "conta",
    name: null,
    igUserId: "178",
    status: "CONNECTED",
  })),
  listAllAccounts: vi.fn(async () => []),
}));
// Qualquer acesso ao banco nestes testes é um erro: as actions devem parar antes.
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: () => { throw new Error("banco não deveria ser acessado"); } }),
}));
vi.mock("@/lib/meta/graph", () => ({ defaultGraphClient: {} }));

import { UnauthorizedError } from "@/lib/auth/requireAuth";
import { getMetaSettings, renewMetaToken, revealWebhookVerifyToken } from "./ajustes/actions";
import { deleteCatalogItem } from "./catalogo/actions";
import { addTagToContact } from "./contatos/actions";
import { getConversationThread, sendManualDirectMessage } from "./conversas/actions";
import { deleteFlow, updateFlowStatus } from "./fluxos/actions";

const AUTH = `Basic ${btoa("fluxo:senha-teste")}`;

beforeEach(() => {
  headerStore.clear();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_USER", "fluxo");
  vi.stubEnv("SITE_PASSWORD", "senha-teste");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server actions without credentials", () => {
  it.each([
    ["sendManualDirectMessage", () => sendManualDirectMessage("c1", "oi")],
    ["deleteFlow", () => deleteFlow("f1")],
    ["deleteCatalogItem", () => deleteCatalogItem("i1")],
    ["addTagToContact", () => addTagToContact("c1", "t1")],
    ["renewMetaToken", () => renewMetaToken()],
    ["getMetaSettings", () => getMetaSettings()],
    ["revealWebhookVerifyToken", () => revealWebhookVerifyToken()],
  ])("%s is rejected before doing anything", async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("server actions with credentials", () => {
  beforeEach(() => {
    headerStore.set("authorization", AUTH);
  });

  it("getMetaSettings never returns the webhook verify token itself", async () => {
    vi.stubEnv("WEBHOOK_VERIFY_TOKEN", "token-super-secreto-123");
    const settings = await getMetaSettings();
    expect(JSON.stringify(settings)).not.toContain("token-super-secreto-123");
    expect(settings.webhookVerifyTokenConfigured).toBe(true);
    expect(settings.webhookVerifyTokenHint).toMatch(/^tok•+$/);
  });

  it("getMetaSettings reports a missing verify token instead of inventing a default", async () => {
    vi.stubEnv("WEBHOOK_VERIFY_TOKEN", "");
    const settings = await getMetaSettings();
    expect(settings.webhookVerifyTokenConfigured).toBe(false);
    expect(settings.webhookVerifyTokenHint).toBeNull();
  });

  it("rejects invalid ids before touching the database", async () => {
    await expect(deleteFlow("")).resolves.toEqual({ ok: false, error: "Identificador ausente." });
    await expect(getConversationThread("x".repeat(500))).resolves.toMatchObject({ ok: false });
    await expect(addTagToContact("c1", "")).resolves.toMatchObject({ ok: false });
  });

  it("rejects an unknown flow status", async () => {
    await expect(updateFlowStatus("f1", "HACKED" as never)).resolves.toEqual({ ok: false, error: "Status inválido." });
  });
});
