import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { AccountAccessError } from "@/lib/tenancy";
import { actionErrorMessage, UserFacingError } from "./user-error";

describe("actionErrorMessage", () => {
  it("mostra a mensagem de erros escritos para o usuário", () => {
    expect(actionErrorMessage(new UserFacingError("Informe o ID da publicação específica"), "padrão")).toBe(
      "Informe o ID da publicação específica",
    );
    expect(actionErrorMessage(new AccountAccessError("Sem acesso."), "padrão")).toBe("Sem acesso.");
  });

  it("esconde detalhes de erros internos (banco, rede, bug)", () => {
    expect(actionErrorMessage(new Error('relation "Flow" does not exist'), "Erro ao salvar.")).toBe("Erro ao salvar.");
    expect(actionErrorMessage("texto solto", "Erro ao salvar.")).toBe("Erro ao salvar.");
    expect(actionErrorMessage(undefined, "Erro ao salvar.")).toBe("Erro ao salvar.");
  });
});
