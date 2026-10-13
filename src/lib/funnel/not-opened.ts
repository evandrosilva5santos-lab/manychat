// "Não abriram o conteúdo": leads para uma curtida MANUAL (feita por uma pessoa).
// O instachat nunca curte sozinho — a API não permite e curtida automática
// infringe os Termos do Instagram.
import { prisma } from "@/lib/prisma";

/** Etiqueta que tira o contato da lista depois que alguém curtiu à mão. */
export const LIKED_TAG_NAME = "Curtida feita";
const WINDOW_DAYS = 7;
const MAX_LINKS = 500;
const MAX_ITEMS = 100;

export type NotOpenedStage = "link" | "gate";

export type NotOpenedLead = {
  contactId: string;
  username: string | null;
  name: string | null;
  profilePicUrl: string | null;
  stage: NotOpenedStage;
  flowName: string | null;
  since: Date;
  comment: { text: string | null; mediaId: string | null; at: Date } | null;
};

type Candidate = { contactId: string; flowId: string | null; stage: NotOpenedStage; since: Date };

/** Recebeu o link e nenhum link daquela automação foi clicado (lembretes incluídos). */
async function unopenedLinks(accountId: string, cutoff: Date): Promise<Candidate[]> {
  const links = await prisma.trackedLink.findMany({
    where: { accountId, contactId: { not: null }, createdAt: { gte: cutoff } },
    select: { contactId: true, flowId: true, clicks: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_LINKS,
  });
  const groups = new Map<string, Candidate & { clicked: boolean }>();
  for (const link of links) {
    if (!link.contactId) continue;
    const key = `${link.contactId}:${link.flowId ?? ""}`;
    const group = groups.get(key) ?? { contactId: link.contactId, flowId: link.flowId, stage: "link" as const, since: link.createdAt, clicked: false };
    group.clicked ||= link.clicks > 0;
    if (link.createdAt < group.since) group.since = link.createdAt;
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => !group.clicked).map(({ clicked: _clicked, ...candidate }) => candidate);
}

/** Parou no portão de seguidor: execução esperando o "JÁ SEGUI". */
async function stuckAtGate(accountId: string, cutoff: Date): Promise<Candidate[]> {
  const runs = await prisma.flowRun.findMany({
    where: { status: "WAITING_CLICK", startedAt: { gte: cutoff }, flow: { accountId } },
    select: { contactId: true, flowId: true, currentNodeId: true, startedAt: true },
    take: MAX_LINKS,
  });
  const nodeIds = [...new Set(runs.map((run) => run.currentNodeId).filter((id): id is string => Boolean(id)))];
  if (nodeIds.length === 0) return [];
  const gates = new Set(
    (await prisma.node.findMany({ where: { id: { in: nodeIds }, type: "FOLLOW_GATE" }, select: { id: true } })).map((node) => node.id),
  );
  return runs
    .filter((run) => run.currentNodeId && gates.has(run.currentNodeId))
    .map((run) => ({ contactId: run.contactId, flowId: run.flowId, stage: "gate" as const, since: run.startedAt }));
}

export async function listNotOpened(accountId: string, now = new Date()): Promise<NotOpenedLead[]> {
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [links, gates] = await Promise.all([unopenedLinks(accountId, cutoff), stuckAtGate(accountId, cutoff)]);

  // Um item por contato: o mais recente.
  const byContact = new Map<string, Candidate>();
  for (const candidate of [...links, ...gates]) {
    const current = byContact.get(candidate.contactId);
    if (!current || candidate.since > current.since) byContact.set(candidate.contactId, candidate);
  }
  if (byContact.size === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: [...byContact.keys()] },
      accountId,
      optedOut: false,
      tags: { none: { tag: { name: LIKED_TAG_NAME } } },
    },
    select: {
      id: true,
      username: true,
      name: true,
      profilePicUrl: true,
      messages: {
        where: { direction: "IN", kind: "COMMENT" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { text: true, mediaId: true, createdAt: true },
      },
    },
  });
  const flowIds = [...new Set([...byContact.values()].map((c) => c.flowId).filter((id): id is string => Boolean(id)))];
  const flows = new Map(
    (await prisma.flow.findMany({ where: { id: { in: flowIds }, accountId }, select: { id: true, name: true } })).map((flow) => [flow.id, flow.name]),
  );

  return contacts
    .map((contact): NotOpenedLead => {
      const candidate = byContact.get(contact.id)!;
      const comment = contact.messages[0];
      return {
        contactId: contact.id,
        username: contact.username,
        name: contact.name,
        profilePicUrl: contact.profilePicUrl,
        stage: candidate.stage,
        flowName: candidate.flowId ? flows.get(candidate.flowId) ?? null : null,
        since: candidate.since,
        comment: comment ? { text: comment.text, mediaId: comment.mediaId, at: comment.createdAt } : null,
      };
    })
    .sort((a, b) => b.since.getTime() - a.since.getTime())
    .slice(0, MAX_ITEMS);
}

/** Marca a curtida manual: aplica a etiqueta (criando-a se preciso). */
export async function markLiked(accountId: string, contactId: string): Promise<boolean> {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, accountId }, select: { id: true } });
  if (!contact) return false;
  const tag = await prisma.tag.upsert({
    where: { accountId_name: { accountId, name: LIKED_TAG_NAME } },
    update: {},
    create: { accountId, name: LIKED_TAG_NAME },
  });
  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId, tagId: tag.id } },
    update: {},
    create: { contactId, tagId: tag.id },
  });
  return true;
}
