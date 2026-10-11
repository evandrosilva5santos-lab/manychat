import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./token";

describe("Token Security (AES-256-GCM)", () => {
  it("criptografa e descriptografa com sucesso um token arbitrário", () => {
    const rawToken = "IGAA_token_secreto_de_teste_123456789";
    const encrypted = encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.length).toBeGreaterThan(30);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it("produz saídas criptografadas diferentes para o mesmo texto (IV aleatório)", () => {
    const raw = "mesmo_token";
    const enc1 = encryptToken(raw);
    const enc2 = encryptToken(raw);

    expect(enc1).not.toBe(enc2);
    expect(decryptToken(enc1)).toBe(raw);
    expect(decryptToken(enc2)).toBe(raw);
  });

  it("rejeita payload adulterado ou corrompido", () => {
    expect(() => decryptToken("invalido")).toThrow();
  });
});
