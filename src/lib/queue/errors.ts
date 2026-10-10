/**
 * Classificação de falhas da Graph API para decidir retentar ou não.
 *
 * Retentável (rate limit / transitório): a Meta espera backoff e nova
 * tentativa — punir o lead ou marcar FAILED seria injusto.
 * Permanente (4xx definitivo): retentar não muda o resultado.
 */

/** Códigos de erro da Graph API que valem nova tentativa. */
const RETRYABLE_META_CODES = new Set([
  1, // unknown error (transitório na prática)
  2, // conexão/https
  4, // application request limit reached
  32, // too many requests
  368, // temporariamente bloqueado
  613, // calls-per-second excedido
  80004, // rate limit
  1200, // temporary issue
]);

const RETRYABLE_MESSAGE = /rate|limit|timeout|timed out|temporar|overload|too many|try again|network/i;

export type SendFailure = { code?: string; error?: string };

export function classifyGraphFailure(failure: SendFailure): "retryable" | "permanent" {
  const numeric = Number(failure.code);
  if (Number.isFinite(numeric) && RETRYABLE_META_CODES.has(numeric)) return "retryable";
  if (failure.error && RETRYABLE_MESSAGE.test(failure.error)) return "retryable";
  return "permanent";
}

/** Erro transitório: o evento volta pra fila com backoff. */
export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

/** Erro definitivo: registrado como FAILED, sem retentativa. */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}
