import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/security/token";
import { MetaTokenError, refreshInstagramLongLivedToken } from "./oauth";

// Modelo de auto-renovação de token (para os tokens "nunca expirarem").
//
// Dois tipos de token convivem:
//  - Token de Página do Facebook: `tokenExpiresAt = null` → NÃO expira.
//    É o alvo do fluxo Facebook (gerado a partir de um token de usuário de
//    longa duração). Nada a renovar aqui.
//  - Token do Instagram Login (60 dias): `tokenExpiresAt` preenchido. Este
//    cron renova quando falta pouco, usando `ig_refresh_token`, e grava o
//    token novo criptografado. Assim, na prática, ele nunca vence.
//
// Falha permanente (ex.: code 190) → conta marcada EXPIRED + alerta, para o
// dono reconectar. Falha de uma conta nunca derruba as outras.

const DAY_MS = 86_400_000;
const RENEW_WHEN_DAYS_LEFT = 10; // renova se faltar 10 dias ou menos
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000; // a Meta só renova token com +24h de vida
const LONG_LIVED_FALLBACK_SECONDS = (60 * DAY_MS) / 1000;

type Outcome = "skippedNonExpiring" | "stillValid" | "tooYoung" | "renewed" | "transient" | "decryptSkipped" | "failed";

export type TokenRenewalSummary = {
  checked: number;
  skippedNonExpiring: number;
  stillValid: number;
  tooYoung: number;
  renewed: number;
  /** Erro passageiro (rede/limite): conta segue CONNECTED, tenta no próximo ciclo. */
  transient: number;
  /** Token ilegível (chave trocada): pulado, SEM expirar a conta. */
  decryptSkipped: number;
  /** Falha permanente (token revogado): conta marcada EXPIRED + alerta. */
  failed: number;
  details: { accountId: string; outcome: Outcome }[];
};

type AccountRow = {
  id: string;
  igUserId: string;
  accessTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  updatedAt: Date;
};

function alert(accountId: string, message: string, detail?: string) {
  // Log estruturado (o item 6 troca por Sentry). Nunca loga o token.
  console.error(`[token-renewal] ${message}`, { accountId, detail });
}

async function markExpired(accountId: string) {
  await prisma.instagramAccount.update({
    where: { id: accountId },
    data: { status: "EXPIRED", tokenStatus: "EXPIRED" },
  });
}

async function renewOne(acc: AccountRow, now: Date): Promise<Outcome> {
  // Token de Página (sem validade) nunca expira — nada a fazer.
  if (!acc.tokenExpiresAt) return "skippedNonExpiring";

  const msLeft = acc.tokenExpiresAt.getTime() - now.getTime();
  if (msLeft > RENEW_WHEN_DAYS_LEFT * DAY_MS) return "stillValid";

  // A Meta recusa renovar token recém-emitido (<24h). Tenta no próximo ciclo.
  if (now.getTime() - acc.updatedAt.getTime() < MIN_TOKEN_AGE_MS) return "tooYoung";

  if (!acc.accessTokenEnc) {
    alert(acc.id, "Conta sem token salvo para renovar");
    await markExpired(acc.id);
    return "failed";
  }

  let plain: string;
  try {
    plain = decryptToken(acc.accessTokenEnc);
  } catch (err) {
    // NUNCA expira a conta por falha de leitura: uma chave errada no ambiente
    // do cron derrubaria TODAS as contas de uma vez. Só alerta e pula.
    alert(acc.id, "Token ilegível (TOKEN_ENCRYPTION_KEY trocada/ausente?)", (err as Error).message);
    return "decryptSkipped";
  }

  try {
    const { accessToken, expiresIn } = await refreshInstagramLongLivedToken(plain);
    await prisma.instagramAccount.update({
      where: { id: acc.id },
      data: {
        accessTokenEnc: encryptToken(accessToken),
        tokenExpiresAt: new Date(now.getTime() + (expiresIn || LONG_LIVED_FALLBACK_SECONDS) * 1000),
        tokenStatus: "ACTIVE",
      },
    });
    return "renewed";
  } catch (err) {
    // Passageiro (timeout, rede, limite, 5xx): mantém CONNECTED e tenta amanhã.
    if (err instanceof MetaTokenError && !err.isPermanent) {
      alert(acc.id, "Renovação adiada (erro passageiro)", err.message);
      return "transient";
    }
    // Permanente (token revogado/expirado, code 190): o dono precisa reconectar.
    alert(acc.id, "Token revogado/expirado — reconectar", (err as Error).message);
    await markExpired(acc.id);
    return "failed";
  }
}

/**
 * Renova os tokens perto de vencer de todas as contas conectadas.
 * Chamado por `GET /api/cron/refresh-tokens` (diariamente).
 */
export async function renewExpiringTokens(now: Date = new Date()): Promise<TokenRenewalSummary> {
  const accounts = (await prisma.instagramAccount.findMany({
    where: { status: "CONNECTED" },
    select: { id: true, igUserId: true, accessTokenEnc: true, tokenExpiresAt: true, updatedAt: true },
  })) as AccountRow[];

  const summary: TokenRenewalSummary = {
    checked: 0,
    skippedNonExpiring: 0,
    stillValid: 0,
    tooYoung: 0,
    renewed: 0,
    transient: 0,
    decryptSkipped: 0,
    failed: 0,
    details: [],
  };

  for (const acc of accounts) {
    summary.checked++;
    let outcome: Outcome;
    try {
      outcome = await renewOne(acc, now);
    } catch (err) {
      // Erro inesperado (ex.: banco) numa conta não pode abortar as demais.
      alert(acc.id, "Erro inesperado ao renovar", (err as Error).message);
      outcome = "failed";
    }
    summary[outcome]++;
    summary.details.push({ accountId: acc.id, outcome });
  }

  return summary;
}
