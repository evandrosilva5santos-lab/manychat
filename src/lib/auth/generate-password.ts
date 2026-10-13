// Senha inicial sugerida (Super Admin e dono da conta repassam à pessoa). Roda no navegador e no servidor.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 12 caracteres sem letras ambíguas (l, I, O, 0, 1), gerados com o sorteio seguro do Web Crypto. */
export function generatePassword(length = 12): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
