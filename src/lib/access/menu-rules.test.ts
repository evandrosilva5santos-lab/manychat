import { describe, expect, it } from "vitest";
import { menuItemsFor } from "./menu-rules";

describe("menu por papel", () => {
  it("atendente não vê cobrança, ajustes, perfis nem admin", () => {
    expect(menuItemsFor("OPERATOR")).toEqual(["minha-conta", "equipe", "privacidade", "termos"]);
  });

  it("dono e administrador veem plano e ajustes; só o Super Admin vê o painel", () => {
    expect(menuItemsFor("OWNER")).toEqual(["minha-conta", "contas", "equipe", "plano", "ajustes", "privacidade", "termos"]);
    expect(menuItemsFor("ADMIN")).not.toContain("admin");
    expect(menuItemsFor("SUPERADMIN")).toContain("admin");
  });
});
