import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getCurrentAccount } = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  db: {
    message: { findMany: vi.fn() },
    flow: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/account", () => ({ getCurrentAccount }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/meta/account-client", () => ({ graphClientForAccount: vi.fn() }));

import { getConversationThread } from "./conversas/actions";
import { deleteFlow } from "./fluxos/actions";

describe("ações isoladas por conta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentAccount.mockResolvedValue({ id: "account-a", username: "cliente-a" });
    db.message.findMany.mockResolvedValue([]);
    db.flow.findFirst.mockResolvedValue(null);
  });

  it("cliente A não lê as mensagens do contato da conta B", async () => {
    await expect(getConversationThread("contact-b")).resolves.toEqual({ ok: true, messages: [] });
    expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { contactId: "contact-b", accountId: "account-a" } }));
  });

  it("cliente A não altera o fluxo da conta B", async () => {
    await expect(deleteFlow("flow-b")).resolves.toEqual({ ok: false, error: "Fluxo não encontrado." });
    expect(db.flow.findFirst).toHaveBeenCalledWith({ where: { id: "flow-b", accountId: "account-a" }, select: { id: true } });
    expect(db.flow.update).not.toHaveBeenCalled();
  });
});
