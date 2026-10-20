import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { InstagramGraphClient } from "./graph";
import { decryptToken } from "@/lib/security/token";

type ResolvedToken = {
  token: string;
  igUserId: string;
  provider: "instagram" | "facebook";
  markExpired: () => Promise<void>;
};

/** Token em claro de uma conta conectada, para chamadas fora do InstagramGraphClient. */
export async function resolveAccountToken(accountId: string): Promise<ResolvedToken> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { igUserId: true, status: true, accessTokenEnc: true, authProvider: true },
  });
  if (!account || account.status !== "CONNECTED") throw new Error("Conta do Instagram indisponível ou desconectada.");

  let token: string | undefined;
  if (account.accessTokenEnc) {
    try {
      token = decryptToken(account.accessTokenEnc);
    } catch (err) {
      console.error("[account-client] Erro ao descriptografar token:", err);
    }
  }

  if (!token && process.env.IG_ACCESS_TOKENS_JSON) {
    try {
      const tokens = z.record(z.string(), z.string().min(1)).parse(JSON.parse(process.env.IG_ACCESS_TOKENS_JSON));
      token = Object.hasOwn(tokens, account.igUserId) ? tokens[account.igUserId] : undefined;
    } catch { throw new Error("Configuração de tokens por conta inválida."); }
  }
  if (!token && process.env.IG_USER_ID === account.igUserId) token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("Token não configurado para esta conta do Instagram.");
  return {
    token,
    igUserId: account.igUserId,
    provider: account.authProvider === "FACEBOOK_LOGIN" ? "facebook" : "instagram",
    markExpired: async () => {
      await prisma.instagramAccount.updateMany({
        where: { id: accountId, status: "CONNECTED" },
        data: { status: "EXPIRED", tokenStatus: "EXPIRED" },
      });
    },
  };
}

export async function graphClientForAccount(accountId: string): Promise<InstagramGraphClient> {
  const resolved = await resolveAccountToken(accountId);
  return new InstagramGraphClient(resolved.token, { onExpired: resolved.markExpired, provider: resolved.provider });
}
