import { describe, expect, it } from "vitest";
import { matchesConfirmation, normalizeConfirmation } from "./confirm-match";

describe("normalizeConfirmation", () => {
  it("apara espaços, remove um @ inicial e ignora maiúsculas", () => {
    expect(normalizeConfirmation("  @Loja.Sunset ")).toBe("loja.sunset");
  });

  it("remove só um @ inicial", () => {
    expect(normalizeConfirmation("@@x")).toBe("@x");
  });

  it("aceita vazio, nulo e indefinido", () => {
    expect(normalizeConfirmation("")).toBe("");
    expect(normalizeConfirmation(null)).toBe("");
    expect(normalizeConfirmation(undefined)).toBe("");
  });
});

describe("matchesConfirmation", () => {
  it("confere com ou sem @ e com espaços nas pontas", () => {
    expect(matchesConfirmation("loja_a", "loja_a")).toBe(true);
    expect(matchesConfirmation("@LOJA_A ", "loja_a")).toBe(true);
    expect(matchesConfirmation("loja_a", "@loja_a")).toBe(true);
  });

  it("não confere com texto diferente, parcial ou vazio", () => {
    expect(matchesConfirmation("loja", "loja_a")).toBe(false);
    expect(matchesConfirmation("loja_a2", "loja_a")).toBe(false);
    expect(matchesConfirmation("", "loja_a")).toBe(false);
  });

  it("nunca confere quando o nome esperado é vazio", () => {
    expect(matchesConfirmation("", "")).toBe(false);
    expect(matchesConfirmation("@", "@")).toBe(false);
  });

  it("não ignora espaços internos nem caracteres especiais", () => {
    expect(matchesConfirmation("lo ja", "loja")).toBe(false);
    expect(matchesConfirmation("loja_ã", "loja_a")).toBe(false);
  });
});
