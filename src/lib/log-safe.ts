/**
 * Rótulo curto e seguro de um erro para logs: código (ex.: Prisma P2002) ou nome.
 * Nunca devolve `message`, que pode conter texto de consulta, URLs ou dados pessoais.
 */
export function errorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
    const name = (err as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "UnknownError";
}
