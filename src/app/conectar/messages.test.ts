import { describe, expect, it } from "vitest";
import { friendlyConnectError } from "./messages";

describe("friendlyConnectError", () => {
  it("convite inválido, expirado ou de workspace removido vira o texto amigável", () => {
    const expected = "Este link não está mais ativo. Peça um novo a quem cuida da sua conta.";
    expect(friendlyConnectError("Link de conexão inválido ou expirado. Peça um novo link a quem cuida da sua conta.")).toBe(expected);
    expect(friendlyConnectError("Convite expirado")).toBe(expected);
  });

  it("mantém outros erros e trata vazio", () => {
    expect(friendlyConnectError("A Meta recusou o acesso.")).toBe("A Meta recusou o acesso.");
    expect(friendlyConnectError(null)).toBeNull();
    expect(friendlyConnectError("")).toBeNull();
  });
});
