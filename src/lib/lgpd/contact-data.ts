// Direitos do titular (LGPD art. 18): acesso/portabilidade (exportar) e
// eliminação (excluir) dos dados de UM contato, sempre dentro da conta informada.
// Portado do item 8; a exclusão de perfil inteiro continua em account-lifecycle.
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type ContactExport = {
  formato: "instachat-titular/v1";
  geradoEm: string;
  aviso: string;
  contato: {
    igsid: string;
    username: string | null;
    nome: string | null;
    fotoPerfilUrl: string | null;
    segueAConta: boolean | null;
    optedOut: boolean;
    optedOutEm: string | null;
    ultimaMensagemRecebidaEm: string | null;
    ultimaInteracaoEm: string | null;
    criadoEm: string;
    entrouPorFluxo: string | null;
  };
  etiquetas: string[];
  mensagens: Array<{
    direcao: string;
    tipo: string;
    texto: string | null;
    conteudo: unknown;
    midiaId: string | null;
    erro: string | null;
    em: string;
  }>;
  execucoesDeFluxo: Array<{ fluxo: string; status: string; inicio: string; fim: string | null }>;
  linksRastreados: Array<{ url: string; cliques: number; primeiroClique: string | null; ultimoClique: string | null }>;
};

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

/** Tudo o que o instachat guarda sobre o contato, em JSON legível. null = não existe nesta conta. */
export async function exportContactData(accountId: string, contactId: string): Promise<ContactExport | null> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId },
    include: {
      sourceFlow: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { direction: true, kind: true, text: true, payload: true, mediaId: true, error: true, createdAt: true },
      },
      runs: {
        orderBy: { startedAt: "asc" },
        select: { status: true, startedAt: true, finishedAt: true, flow: { select: { name: true } } },
      },
      trackedLinks: { select: { url: true, clicks: true, firstClickedAt: true, lastClickedAt: true } },
    },
  });
  if (!contact) return null;

  return {
    formato: "instachat-titular/v1",
    geradoEm: new Date().toISOString(),
    aviso:
      "Dados tratados pelo instachat em nome da empresa dona do perfil do Instagram (controladora). " +
      "Mensagens do Instagram também ficam guardadas pela Meta, fora do instachat.",
    contato: {
      igsid: contact.igsid,
      username: contact.username,
      nome: contact.name,
      fotoPerfilUrl: contact.profilePicUrl,
      segueAConta: contact.followsAccount,
      optedOut: contact.optedOut,
      optedOutEm: iso(contact.optedOutAt),
      ultimaMensagemRecebidaEm: iso(contact.lastInboundAt),
      ultimaInteracaoEm: iso(contact.lastInteractionAt),
      criadoEm: contact.createdAt.toISOString(),
      entrouPorFluxo: contact.sourceFlow?.name ?? null,
    },
    etiquetas: contact.tags.map((link) => link.tag.name),
    mensagens: contact.messages.map((message) => ({
      direcao: message.direction,
      tipo: message.kind,
      texto: message.text,
      conteudo: message.payload,
      midiaId: message.mediaId,
      erro: message.error,
      em: message.createdAt.toISOString(),
    })),
    execucoesDeFluxo: contact.runs.map((run) => ({
      fluxo: run.flow.name,
      status: run.status,
      inicio: run.startedAt.toISOString(),
      fim: iso(run.finishedAt),
    })),
    linksRastreados: contact.trackedLinks.map((link) => ({
      url: link.url,
      cliques: link.clicks,
      primeiroClique: iso(link.firstClickedAt),
      ultimoClique: iso(link.lastClickedAt),
    })),
  };
}

/**
 * Exclui o contato e tudo ligado a ele: mensagens, etiquetas e execuções saem
 * por cascata; links rastreados perdem o vínculo; eventos do webhook com o
 * IGSID também saem. A auditoria vai para o log com o IGSID em hash — nunca
 * pela tabela de exclusão de perfil, para não arriscar apagar o perfil inteiro.
 */
export async function deleteContactData(accountId: string, contactId: string): Promise<boolean> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId },
    select: { id: true, igsid: true },
  });
  if (!contact) return false;

  await prisma.$transaction([
    prisma.webhookEvent.deleteMany({
      where: { accountId, payload: { path: ["userIgsid"], equals: contact.igsid } },
    }),
    prisma.contact.deleteMany({ where: { id: contact.id, accountId } }),
  ]);
  const subject = createHash("sha256").update(contact.igsid).digest("hex").slice(0, 16);
  console.info(`[titular] contato excluído conta=${accountId} titular=${subject}`);
  return true;
}
