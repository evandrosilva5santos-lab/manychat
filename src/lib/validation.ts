// Esquemas Zod compartilhados pelas server actions (entradas vindas do navegador).
import { z } from "zod";
import { isSafeHttpsUrl } from "@/lib/links/tracked";

const MAX_ID_LENGTH = 128;
const MAX_URL_LENGTH = 2000;

export const idSchema = z.string().trim().min(1, "Identificador ausente.").max(MAX_ID_LENGTH, "Identificador inválido.");

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, "Link muito longo.")
  .refine(isSafeHttpsUrl, "Use um link completo que comece com https://");

/**
 * Link de botão salvo em rascunho: pode ficar vazio ou incompleto ("https://"),
 * porque o lint cobra o link completo antes de publicar. Qualquer outro esquema
 * (javascript:, data:, http:) é recusado já no salvamento.
 */
export const draftHttpsUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, "Link muito longo.")
  .refine((url) => url === "" || url.startsWith("https://"), "O link precisa começar com https://");

/** Primeira mensagem de erro do Zod, pronta para mostrar ao usuário. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** Valida IDs recebidos do navegador; devolve a mensagem do primeiro inválido. */
export function invalidIdMessage(...values: unknown[]): string | null {
  for (const value of values) {
    const result = idSchema.safeParse(value);
    if (!result.success) return firstIssueMessage(result.error);
  }
  return null;
}
