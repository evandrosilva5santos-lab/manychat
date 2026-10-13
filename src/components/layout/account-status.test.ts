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

import { describeValidity, expiringTokenDays, EXPIRY_WARNING_DAYS } from "./account-status";

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

describe("expiringTokenDays", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const base = { authProvider: "INSTAGRAM_LOGIN" as const, status: "CONNECTED" };

  it("avisa quando o token do login Instagram vence em menos de 7 dias", () => {
    expect(EXPIRY_WARNING_DAYS).toBe(7);
    expect(expiringTokenDays({ ...base, tokenExpiresAt: inDays(3) }, now)).toBe(3);
    expect(expiringTokenDays({ ...base, tokenExpiresAt: inDays(2.2) }, now)).toBe(3);
    expect(expiringTokenDays({ ...base, tokenExpiresAt: inDays(0.2) }, now)).toBe(1);
  });

  it("não avisa com 7 dias ou mais", () => {
    expect(expiringTokenDays({ ...base, tokenExpiresAt: inDays(7) }, now)).toBeNull();
    expect(expiringTokenDays({ ...base, tokenExpiresAt: inDays(30) }, now)).toBeNull();
  });

  it("login Facebook nunca avisa", () => {
    expect(expiringTokenDays({ authProvider: "FACEBOOK_LOGIN", status: "CONNECTED", tokenExpiresAt: inDays(1) }, now)).toBeNull();
  });

  it("só avisa em conta conectada e com data válida", () => {
    expect(expiringTokenDays({ ...base, status: "EXPIRED", tokenExpiresAt: inDays(1) }, now)).toBeNull();
    expect(expiringTokenDays({ ...base, status: "DISCONNECTED", tokenExpiresAt: inDays(1) }, now)).toBeNull();
    expect(expiringTokenDays({ ...base, tokenExpiresAt: null }, now)).toBeNull();
    expect(expiringTokenDays({ ...base, tokenExpiresAt: "lixo" }, now)).toBeNull();
  });

  it("data já vencida não vira aviso (o estado EXPIRED cuida disso)", () => {
    expect(expiringTokenDays({ ...base, tokenExpiresAt: inDays(-1) }, now)).toBeNull();
  });
});
