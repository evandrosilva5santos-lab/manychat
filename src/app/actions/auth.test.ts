import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), delete: vi.fn() },
  deleteMany: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => m.cookieStore) }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { userSession: { deleteMany: m.deleteMany } } }));

import { hashSessionToken } from "@/lib/tenancy";
import { logout } from "./auth";

beforeEach(() => {
  vi.resetAllMocks();
  m.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  m.deleteMany.mockResolvedValue({ count: 1 });
});

describe("logout", () => {
  it("apaga a sessão pelo hash do cookie, limpa os 3 cookies e redireciona para /sair", async () => {
    m.cookieStore.get.mockImplementation((name: string) => (name === "fluxo_session" ? { value: "token-opaco" } : undefined));

    await expect(logout()).rejects.toThrow("NEXT_REDIRECT:/sair");

    expect(m.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken("token-opaco") } });
    expect(m.cookieStore.delete.mock.calls.map(([name]) => name).sort()).toEqual(
      ["active_ig_account_id", "fluxo_session", "fluxo_workspace_view"],
    );
    expect(m.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("sem cookie de sessão (operador Basic Auth) não toca o banco mas limpa cookies e redireciona", async () => {
    m.cookieStore.get.mockReturnValue(undefined);

    await expect(logout()).rejects.toThrow("NEXT_REDIRECT:/sair");

    expect(m.deleteMany).not.toHaveBeenCalled();
    expect(m.cookieStore.delete).toHaveBeenCalledTimes(3);
  });

  it("falha ao apagar no banco ainda limpa os cookies e propaga o erro depois", async () => {
    m.cookieStore.get.mockReturnValue({ value: "t" });
    m.deleteMany.mockRejectedValue(new Error("db down"));

    await expect(logout()).rejects.toThrow("db down");
    expect(m.cookieStore.delete).toHaveBeenCalledTimes(3);
  });
});
