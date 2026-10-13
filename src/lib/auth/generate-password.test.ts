import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";
import { generatePassword } from "./generate-password";

describe("generatePassword", () => {
  it("gera senha aceita pela regra de senha, sem caracteres ambíguos e diferente a cada vez", () => {
    const first = generatePassword();
    expect(first).toHaveLength(12);
    expect(passwordProblem(first)).toBeNull();
    expect(first).not.toMatch(/[lIO01]/);
    expect(generatePassword()).not.toBe(first);
  });
});
