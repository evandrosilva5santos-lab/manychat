// Senhas de clientes (ADR-008). scrypt do Node: sem dependência nova.
// Formato guardado: `scrypt$<salt base64url>$<hash base64url>`.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/** Hash usado quando o e-mail não existe, para a resposta levar o mesmo tempo. */
const DUMMY_HASH = `scrypt$${Buffer.alloc(SALT_BYTES).toString("base64url")}$${Buffer.alloc(KEY_LENGTH).toString("base64url")}`;

/** Mensagem de erro para a senha escolhida, ou `null` se ela serve. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > MAX_PASSWORD_LENGTH) return "A senha é longa demais.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Compara em tempo constante. Hash ausente ou malformado nunca confere. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, saltB64, hashB64] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64 || password.length > MAX_PASSWORD_LENGTH) return false;
  const expected = Buffer.from(hashB64, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), KEY_LENGTH);
  return timingSafeEqual(actual, expected) && stored !== null && stored !== undefined;
}
