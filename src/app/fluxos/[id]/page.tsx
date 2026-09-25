import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/flow-editor/FlowEditor";
import { getCurrentAccount } from "@/lib/account";
import { fromDb } from "@/lib/flow/convert";
import { prisma } from "@/lib/prisma";

export default async function FlowEditorPage(props: PageProps<"/fluxos/[id]">) {
  const { id } = await props.params;
  const account = await getCurrentAccount();
  const flow = await prisma.flow.findFirst({
    where: { id, accountId: account.id },
    include: {
      nodes: { include: { carouselCards: true } },
      edges: true,
      triggers: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!flow) notFound();

  const [tags, catalog] = await Promise.all([
    prisma.tag.findMany({ where: { accountId: account.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.catalogItem.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, description: true, imageUrl: true, buttonTitle: true, buttonType: true },
    }),
  ]);

  return (
    <FlowEditor
      flow={{ id: flow.id, name: flow.name, folder: flow.folder, status: flow.status }}
      initial={fromDb(flow)}
      tags={tags}
      catalog={catalog}
    />
  );
}
