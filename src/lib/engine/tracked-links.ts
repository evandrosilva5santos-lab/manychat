import { prisma } from "@/lib/prisma";
import { generateLinkCode, isSafeHttpsUrl } from "@/lib/links/tracked";

export function safeDestination(value: string): URL | null {
  try {
    const url = new URL(value);
    return isSafeHttpsUrl(value) ? url : null;
  } catch { return null; }
}

export async function trackedUrl(accountId: string, contactId: string, nodeId: string, destination: string): Promise<string> {
  const url = safeDestination(destination);
  if (!url) throw new Error("O destino do botão precisa ser uma URL HTTPS válida");
  const origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.startinc.com.br";
  const [contact, node] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, accountId }, select: { id: true } }),
    prisma.node.findFirst({ where: { id: nodeId, flow: { accountId } }, select: { id: true, flowId: true } }),
  ]);
  if (!contact || !node) throw new Error("Contato ou nó fora da conta");

  const existing = await prisma.trackedLink.findFirst({
    where: { accountId, contactId, nodeId, url: url.href },
    select: { code: true },
  });

  if (existing) {
    return new URL(`/api/l/${existing.code}`, origin).href;
  }

  const code = generateLinkCode();
  const link = await prisma.trackedLink.create({
    data: {
      accountId,
      contactId,
      nodeId,
      flowId: node.flowId,
      url: url.href,
      code,
    },
  });
  return new URL(`/api/l/${link.code}`, origin).href;
}

export async function hasClickedLink(accountId: string, contactId: string, nodeId: string) {
  return Boolean(await prisma.trackedLink.findFirst({
    where: { accountId, contactId, nodeId, clicks: { gt: 0 } }, select: { id: true },
  }));
}
