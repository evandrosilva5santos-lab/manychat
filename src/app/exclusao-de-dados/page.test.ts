import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { db } = vi.hoisted(() => ({ db: { dataDeletionRequest: { findUnique: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import Page, { metadata } from "./page";

const render = async (codigo?: string) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ codigo }) }));
const row = (status: string, accountsAffected = 1) => ({
  code: "abc_DEF-123", status, accountsAffected, createdAt: new Date("2026-10-12T15:00:00Z"),
});
afterEach(() => vi.clearAllMocks());

describe("/exclusao-de-dados", () => {
  it("não é indexada e mostra as instruções sem código", async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    const html = await render();
    expect(html).toContain("Como apagar seus dados do instachat");
    expect(db.dataDeletionRequest.findUnique).not.toHaveBeenCalled();
  });
  it.each([
    ["PENDING", 1, "Em andamento"],
    ["COMPLETED", 2, "Concluído"],
    ["COMPLETED", 0, "Nenhum dado encontrado"],
    ["FAILED", 0, "Tentaremos de novo sozinhos"],
  ])("estado %s (%i contas)", async (status, n, text) => {
    db.dataDeletionRequest.findUnique.mockResolvedValue(row(status, n));
    const html = await render("abc_DEF-123");
    expect(html).toContain("Código de acompanhamento");
    expect(html).toContain(text);
  });
  it("código desconhecido ou malformado não consulta com valor inválido", async () => {
    db.dataDeletionRequest.findUnique.mockResolvedValue(null);
    expect(await render("naoexiste")).toContain("Não encontramos um pedido com este código");
    db.dataDeletionRequest.findUnique.mockClear();
    expect(await render("a b';--")).toContain("Não encontramos um pedido");
    expect(await render("x".repeat(65))).toContain("Não encontramos um pedido");
    expect(db.dataDeletionRequest.findUnique).not.toHaveBeenCalled();
  });
});
