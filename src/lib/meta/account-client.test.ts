import { afterEach, describe, expect, it, vi } from "vitest";
const { findUnique, update } = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({prisma:{instagramAccount:{findUnique,update}}}));
import { graphClientForAccount } from "./account-client";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("account-scoped credentials", () => {
  it("refuses a global token owned by another account", async () => { findUnique.mockResolvedValue({igUserId:"a",status:"CONNECTED"}); vi.stubEnv("IG_ACCESS_TOKENS_JSON",""); vi.stubEnv("IG_ACCESS_TOKEN","test-token"); vi.stubEnv("IG_USER_ID","b"); await expect(graphClientForAccount("account")).rejects.toThrow("Token não configurado"); });
  it("selects mapping token and expires only the affected account", async () => { findUnique.mockResolvedValue({igUserId:"a",status:"CONNECTED"}); vi.stubEnv("IG_ACCESS_TOKENS_JSON",JSON.stringify({a:"token-a",b:"token-b"})); const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:190}}),{status:400})); vi.stubGlobal("fetch",fetchMock); const client=await graphClientForAccount("account-a"); await client.sendTextMessage("u","oi"); expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-a"); expect(update).toHaveBeenCalledWith({where:{id:"account-a"},data:{status:"EXPIRED"}}); });
  it("rejects unavailable accounts and malformed mapping without revealing it", async () => { findUnique.mockResolvedValue(null); await expect(graphClientForAccount("missing")).rejects.toThrow("indisponível"); findUnique.mockResolvedValue({igUserId:"a",status:"CONNECTED"}); vi.stubEnv("IG_ACCESS_TOKENS_JSON","secret-invalid-json"); await expect(graphClientForAccount("a")).rejects.toThrow("Configuração de tokens por conta inválida."); });
});
