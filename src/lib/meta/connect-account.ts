import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/security/token";
import {
  exchangeCodeForShortLivedToken,
  exchangeFacebookCodeForToken,
  exchangeForLongLivedFacebookUserToken,
  exchangeForLongLivedToken,
  fetchFacebookPagesAndInstagram,
  fetchInstagramProfile,
  subscribeAccountWebhooks,
} from "./oauth";

// Conclusão do OAuth: cada login tem seu próprio caminho, sem fallback cruzado.
// O workspace vem do `state` assinado no início do login (sessão ou convite).

/** Erro de negócio com mensagem segura para mostrar a quem está conectando. */
export class ConnectUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectUserError";
  }
}

const LONG_LIVED_FALLBACK_SECONDS = 60 * 86_400;
const NO_LINKED_INSTAGRAM =
  "Nenhuma conta profissional do Instagram vinculada a uma Página do Facebook foi autorizada. " +
  "Na tela da Meta, marque a Página e a conta do Instagram ligada a ela.";

type ConnectedAccount = {
  igUserId: string;
  username: string;
  name: string | null;
  profilePicUrl: string | null;
  accessToken: string;
  tokenExpiresAt: Date | null;
  authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  fbPageId: string | null;
};

/** Confere TODAS as contas antes de gravar: ou entram todas, ou nenhuma. */
async function findExistingIds(workspaceId: string, accounts: ConnectedAccount[]): Promise<(string | null)[]> {
  const existing = await Promise.all(
    accounts.map((acc) =>
      prisma.instagramAccount.findUnique({ where: { igUserId: acc.igUserId }, select: { id: true, workspaceId: true } })
    )
  );
  if (existing.some((row) => row && row.workspaceId !== workspaceId)) {
    throw new ConnectUserError("Esta conta do Instagram já está vinculada a outro cliente.");
  }
  return existing.map((row) => row?.id ?? null);
}

async function saveConnectedAccounts(workspaceId: string, accounts: ConnectedAccount[]): Promise<string[]> {
  const existingIds = await findExistingIds(workspaceId, accounts);
  const writes = accounts.map((acc, index) => {
    const data = {
      username: acc.username,
      name: acc.name,
      profilePicUrl: acc.profilePicUrl,
      accessTokenEnc: encryptToken(acc.accessToken),
      tokenExpiresAt: acc.tokenExpiresAt,
      authProvider: acc.authProvider,
      fbPageId: acc.fbPageId,
      status: "CONNECTED" as const,
      tokenStatus: "ACTIVE" as const,
    };
    const id = existingIds[index];
    return id
      ? prisma.instagramAccount.update({ where: { id }, data })
      : prisma.instagramAccount.create({ data: { ...data, workspaceId, igUserId: acc.igUserId } });
  });
  await prisma.$transaction(writes);
  return accounts.map((acc) => acc.username);
}

/** Instagram Login: token de 60 dias (renovado pelo cron), host graph.instagram.com. */
export async function connectViaInstagram(code: string, redirectUri: string, workspaceId: string): Promise<string[]> {
  const { accessToken: shortLived } = await exchangeCodeForShortLivedToken(code, redirectUri);
  const { accessToken, expiresIn } = await exchangeForLongLivedToken(shortLived);
  const profile = await fetchInstagramProfile(accessToken);
  if (!(await subscribeAccountWebhooks(accessToken))) {
    console.warn("[oauth] Falha ao inscrever webhooks da conta do Instagram", profile.igUserId);
  }
  return saveConnectedAccounts(workspaceId, [
    {
      igUserId: profile.igUserId,
      username: profile.username,
      name: profile.name ?? null,
      profilePicUrl: profile.profilePicUrl ?? null,
      accessToken,
      tokenExpiresAt: new Date(Date.now() + (expiresIn || LONG_LIVED_FALLBACK_SECONDS) * 1000),
      authProvider: "INSTAGRAM_LOGIN",
      fbPageId: null,
    },
  ]);
}

/** Facebook Login: conecta todas as contas do Instagram das Páginas autorizadas (token de Página não expira). */
export async function connectViaFacebook(code: string, redirectUri: string, workspaceId: string): Promise<string[]> {
  const { accessToken: shortLivedUser } = await exchangeFacebookCodeForToken(code, redirectUri);
  // O token de Página derivado de um token de usuário de longa duração não expira.
  const { accessToken: longLivedUser } = await exchangeForLongLivedFacebookUserToken(shortLivedUser);
  const pages = await fetchFacebookPagesAndInstagram(longLivedUser);
  if (pages.length === 0) throw new ConnectUserError(NO_LINKED_INSTAGRAM);
  return saveConnectedAccounts(
    workspaceId,
    pages.map((page) => ({
      igUserId: page.igUserId,
      username: page.username,
      name: page.name ?? page.pageName ?? null,
      profilePicUrl: page.profilePicUrl ?? null,
      accessToken: page.pageAccessToken,
      tokenExpiresAt: null,
      authProvider: "FACEBOOK_LOGIN",
      fbPageId: page.pageId,
    }))
  );
}
