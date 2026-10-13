import { describe, expect, it } from "vitest";
import { accountStatusLabel, isAccountConnected, pausedFlowLabel, tokenStoredLabel } from "./account-status";

describe("accountStatusLabel", () => {
  it("traduz cada estado real para pt-BR (nunca o enum cru)", () => {
    expect(accountStatusLabel("CONNECTED").label).toBe("Conectado");
    expect(accountStatusLabel("EXPIRED").label).toBe("Token expirado");
    expect(accountStatusLabel("DISCONNECTED").label).toBe("Descarregado — automações paradas");
  });

  it("estado desconhecido não vaza o enum", () => {
    expect(accountStatusLabel("QUALQUER_COISA").label).toBe("Estado desconhecido");
  });

  it("expõe tom semântico por estado", () => {
    expect(accountStatusLabel("CONNECTED").tone).toBe("success");
    expect(accountStatusLabel("EXPIRED").tone).toBe("warning");
    expect(accountStatusLabel("DISCONNECTED").tone).toBe("danger");
  });
});

describe("pausedFlowLabel", () => {
  it("só pausa quando o perfil não está conectado", () => {
    expect(pausedFlowLabel("CONNECTED")).toBeNull();
    expect(pausedFlowLabel("DISCONNECTED")).toBe("Pausado — perfil descarregado");
    expect(pausedFlowLabel("EXPIRED")).toBe("Pausado — token expirado");
  });

  it("sem perfil não mostra nada", () => {
    expect(pausedFlowLabel(null)).toBeNull();
    expect(pausedFlowLabel(undefined)).toBeNull();
  });
});

describe("isAccountConnected", () => {
  it("é verdadeiro só para CONNECTED", () => {
    expect(isAccountConnected("CONNECTED")).toBe(true);
    expect(isAccountConnected("EXPIRED")).toBe(false);
    expect(isAccountConnected(null)).toBe(false);
  });
});

describe("tokenStoredLabel", () => {
  it("reflete se há token guardado para a conta", () => {
    expect(tokenStoredLabel({ status: "CONNECTED", tokenStatus: "ACTIVE", hasStoredToken: true })).toBe("Guardado e válido");
    expect(tokenStoredLabel({ status: "EXPIRED", tokenStatus: "EXPIRED", hasStoredToken: true })).toBe("Expirado");
    expect(tokenStoredLabel({ status: "DISCONNECTED", tokenStatus: "REVOKED", hasStoredToken: false })).toBe("Removido ao descarregar");
    expect(tokenStoredLabel({ status: "CONNECTED", tokenStatus: null, hasStoredToken: false })).toBe("Não guardado");
  });
});

import { describeValidity } from "./account-status";

describe("describeValidity", () => {
  const iso = "2026-12-20T15:00:00.000Z";

  it("Facebook não expira", () => {
    expect(describeValidity({ authProvider: "FACEBOOK_LOGIN", status: "CONNECTED", tokenExpiresAt: null })).toBe("Não expira");
  });

  it("Instagram conectado renova sozinho até a data (fuso de São Paulo)", () => {
    expect(describeValidity({ authProvider: "INSTAGRAM_LOGIN", status: "CONNECTED", tokenExpiresAt: iso })).toBe("Renova sozinho até 20/12/2026");
  });

  it("Instagram conectado sem data registrada", () => {
    expect(describeValidity({ authProvider: "INSTAGRAM_LOGIN", status: "CONNECTED", tokenExpiresAt: null })).toBe("Sem data de validade registrada");
  });

  it("expirado e descarregado explicam o que falta", () => {
    expect(describeValidity({ authProvider: "INSTAGRAM_LOGIN", status: "EXPIRED", tokenExpiresAt: iso })).toBe("Expirou em 20/12/2026");
    expect(describeValidity({ authProvider: "INSTAGRAM_LOGIN", status: "EXPIRED", tokenExpiresAt: null })).toBe("Expirou");
    expect(describeValidity({ authProvider: "FACEBOOK_LOGIN", status: "DISCONNECTED", tokenExpiresAt: null })).toBe("Sem acesso guardado");
  });
});
