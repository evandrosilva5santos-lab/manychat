import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageKind } from "@/generated/prisma/enums";

export type ContactProfile = {
  accountId: string;
  igsid: string;
  username?: string | null;
  name?: string | null;
  profilePicUrl?: string | null;
  /** Somente timestamp autenticado de DM/postback; comentário não abre janela. */
  inboundAt?: Date;
};

export async function getOrCreateContact(profile: ContactProfile) {
  const now = new Date();
  const incoming = profile.inboundAt;
  const inboundAt = incoming && Number.isFinite(incoming.getTime()) && incoming <= now ? incoming : undefined;
  const contact = await prisma.contact.upsert({
    where: { accountId_igsid: { accountId: profile.accountId, igsid: profile.igsid } },
    create: {
      accountId: profile.accountId, igsid: profile.igsid, username: profile.username,
      name: profile.name, profilePicUrl: profile.profilePicUrl,
      lastInboundAt: inboundAt, lastInteractionAt: now,
    },
    update: {
      username: profile.username ?? undefined, name: profile.name ?? undefined,
      profilePicUrl: profile.profilePicUrl ?? undefined, lastInteractionAt: now,
    },
  });
  // Eventos atrasados não encurtam a janela e retentativas não a prolongam.
  if (inboundAt) {
    await prisma.contact.updateMany({
      where: { id: contact.id, accountId: profile.accountId, OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: inboundAt } }] },
      data: { lastInboundAt: inboundAt },
    });
    return prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
  }
  return contact;
}

type IncomingMessage = {
  accountId: string; contactId: string; text?: string; kind: MessageKind;
  payload?: Prisma.InputJsonValue; igMessageId?: string; mediaId?: string;
};

/** null indica evento já registrado. Não transforma falha de banco em sucesso. */
export async function recordIncomingMessage(params: IncomingMessage) {
  try {
    return await prisma.message.create({ data: { ...params, direction: "IN" } });
  } catch (error) {
    if (params.igMessageId && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return null;
    throw error;
  }
}

export async function recordOutgoingMessage(params: {
  accountId: string; contactId: string; text?: string; kind: MessageKind;
  payload?: Prisma.InputJsonValue; flowId?: string; nodeId?: string;
  runId?: string; error?: string; igMessageId?: string;
}) {
  return prisma.message.create({ data: { ...params, direction: "OUT" } });
}
