import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { InstagramGraphClient } from "./graph";
import { decryptToken } from "@/lib/security/token";

export async function graphClientForAccount(accountId: string): Promise<InstagramGraphClient> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { igUserId: true, status: true, accessTokenEnc: true },
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
  return new InstagramGraphClient(token, async () => {
    await prisma.instagramAccount.update({ where: { id: accountId }, data: { status: "EXPIRED" } });
  });
}
