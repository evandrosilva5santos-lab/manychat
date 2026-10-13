import type { Metadata } from "next";
import { getCurrentAccount } from "@/lib/account";
import { listNotOpened } from "@/lib/funnel/not-opened";
import { graphClientForAccount } from "@/lib/meta/account-client";
import { NotOpenedClient, type NotOpenedRow } from "./NotOpenedClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Não abriram o conteúdo · instachat" };

const MAX_PERMALINKS = 20;

/** Links das publicações comentadas (melhor esforço: sem link, o botão some). */
async function permalinksFor(accountId: string, mediaIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (mediaIds.length === 0) return result;
  try {
    const client = await graphClientForAccount(accountId);
    const found = await Promise.all(mediaIds.slice(0, MAX_PERMALINKS).map(async (id) => [id, await client.getMediaPermalink(id)] as const));
    for (const [id, url] of found) if (url) result.set(id, url);
  } catch {
    // Perfil sem token utilizável: a lista aparece sem o botão "Ver publicação".
  }
  return result;
}

export default async function NotOpenedPage() {
  const account = await getCurrentAccount();
  if (!account) {
    return <NotOpenedClient rows={[]} username={null} error="Nenhum perfil ativo. Conecte ou escolha um perfil no topo da barra lateral." />;
  }

  let rows: NotOpenedRow[] = [];
  let error: string | null = null;
  try {
    const leads = await listNotOpened(account.id);
    const mediaIds = [...new Set(leads.map((lead) => lead.comment?.mediaId).filter((id): id is string => Boolean(id)))];
    const permalinks = await permalinksFor(account.id, mediaIds);
    rows = leads.map((lead) => ({
      contactId: lead.contactId,
      username: lead.username,
      name: lead.name,
      profilePicUrl: lead.profilePicUrl,
      stage: lead.stage,
      flowName: lead.flowName,
      since: lead.since.toISOString(),
      commentText: lead.comment?.text ?? null,
      postUrl: lead.comment?.mediaId ? permalinks.get(lead.comment.mediaId) ?? null : null,
    }));
  } catch (err) {
    console.error("[nao-abriram] Falha ao montar a lista:", err instanceof Error ? err.name : "erro");
    error = "Não foi possível carregar a lista agora. Recarregue a página.";
  }

  return <NotOpenedClient rows={rows} username={account.username} error={error} />;
}
