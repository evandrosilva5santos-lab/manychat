import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuth, getAccount, exportData } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAccount: vi.fn(),
  exportData: vi.fn(),
}));
vi.mock("@/lib/auth/requireAuth", async () => {
  const { UnauthorizedError } = await vi.importActual<typeof import("@/lib/auth/requireAuth")>("@/lib/auth/requireAuth");
  return { requireAuth, UnauthorizedError };
});
vi.mock("@/lib/account", () => ({ getCurrentAccount: getAccount }));
vi.mock("@/lib/lgpd/contact-data", () => ({ exportContactData: exportData }));

import { UnauthorizedError } from "@/lib/auth/requireAuth";
import { GET } from "./route";

const call = (id: string) => GET(new Request(`http://localhost/api/contatos/${id}/exportar`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  getAccount.mockResolvedValue({ id: "acc_1" });
});

describe("GET /api/contatos/[id]/exportar", () => {
  it("401 sem login, sem consultar dados", async () => {
    requireAuth.mockRejectedValue(new UnauthorizedError());
    expect((await call("c_1")).status).toBe(401);
    expect(exportData).not.toHaveBeenCalled();
  });

  it("404 para contato que não é do perfil ativo", async () => {
    exportData.mockResolvedValue(null);
    expect((await call("c_outro")).status).toBe(404);
    expect(exportData).toHaveBeenCalledWith("acc_1", "c_outro");
  });

  it("409 sem perfil ativo", async () => {
    getAccount.mockResolvedValue(null);
    expect((await call("c_1")).status).toBe(409);
  });

  it("200 com JSON para download e sem cache", async () => {
    exportData.mockResolvedValue({ formato: "instachat-titular/v1" });
    const res = await call("c_1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="contato-c_1.json"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ formato: "instachat-titular/v1" });
  });
});
