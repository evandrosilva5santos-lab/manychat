/** Normaliza o texto digitado: sem espaços nas pontas, sem um "@" inicial e sem diferença de maiúsculas. */
export function normalizeConfirmation(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return (trimmed.startsWith("@") ? trimmed.slice(1) : trimmed).toLowerCase();
}

/** Confere a confirmação digitada com o nome esperado. Nome esperado vazio nunca confere. */
export function matchesConfirmation(typed: string | null | undefined, expected: string | null | undefined): boolean {
  const target = normalizeConfirmation(expected);
  return target.length > 0 && normalizeConfirmation(typed) === target;
}
