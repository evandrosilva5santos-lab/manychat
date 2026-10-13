// Limite de tentativas em memória. Na Vercel cada instância tem o seu mapa, então
// é uma barreira contra força bruta simples, não uma garantia global.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;

const failures = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  failures.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
