import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

// scrypt é lento de propósito: folga de tempo para a máquina carregada.
describe("senhas", { timeout: 30_000 }, () => {
  it("confere a senha certa e recusa a errada", async () => {
    const stored = await hashPassword("senha-forte-1");
    expect(stored).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    await expect(verifyPassword("senha-forte-1", stored)).resolves.toBe(true);
    await expect(verifyPassword("senha-forte-2", stored)).resolves.toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (sal aleatório)", async () => {
    expect(await hashPassword("igual-igual")).not.toBe(await hashPassword("igual-igual"));
  });

  it("nunca confere sem hash guardado ou com hash malformado", async () => {
    await expect(verifyPassword("qualquer", null)).resolves.toBe(false);
    await expect(verifyPassword("qualquer", "texto-puro")).resolves.toBe(false);
    await expect(verifyPassword("qualquer", "scrypt$abc$curto")).resolves.toBe(false);
  });

  it("exige tamanho mínimo", () => {
    expect(passwordProblem("1234567")).toMatch(/8 caracteres/);
    expect(passwordProblem("12345678")).toBeNull();
  });
});
