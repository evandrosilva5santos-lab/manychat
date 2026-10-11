// Defesa em profundidade: server actions são endpoints POST públicos, então cada
// uma confere a credencial de novo, mesmo atrás do proxy.
import { headers } from "next/headers";
import { evaluateBasicAuth, isAccessAllowed, readBasicAuthConfig } from "./basic";
import { getCurrentActor } from "@/lib/tenancy";

export class UnauthorizedError extends Error {
  constructor() {
    super("Acesso não autorizado.");
    this.name = "UnauthorizedError";
  }
}

export async function requireAuth(): Promise<void> {
  const requestHeaders = await headers();
  const result = evaluateBasicAuth(requestHeaders.get("authorization"), readBasicAuthConfig());
  if (isAccessAllowed(result)) return;
  if (await getCurrentActor()) return;
  throw new UnauthorizedError();
}

/** Versão para route handlers, que recebem o Request diretamente. */
export function isRequestAuthorized(request: Request): boolean {
  return isAccessAllowed(evaluateBasicAuth(request.headers.get("authorization"), readBasicAuthConfig()));
}
