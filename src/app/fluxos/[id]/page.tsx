import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/flow-editor/FlowEditor";
import { SimpleBuilder } from "@/components/simple-builder/SimpleBuilder";
import { defaultRecipe, readRecipe } from "@/lib/flow/recipe";
import { getCurrentAccount } from "@/lib/account";
import { fromDb } from "@/lib/flow/convert";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FlowEditorPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  if (id === "novo") {
    if (searchParams?.mode === "ADVANCED") {
      return (
        <FlowEditor
          flow={{
            id: "novo",
            name: "Novo fluxo",
            folder: null,
            status: "DRAFT",
          }}
          initial={{
            viewport: { x: 0, y: 0, zoom: 1 },
            nodes: [],
            edges: [],
          }}
          tags={[]}
          catalog={[]}
        />
      );
    }

    return (
      <SimpleBuilder
        flow={{
          id: "novo",
          name: "Nova automação rápida",
          folder: null,
          status: "DRAFT",
        }}
        initial={defaultRecipe()}
      />
    );
  }

  const account = await getCurrentAccount();
  if (!account) notFound();

  const flow = await prisma.flow.findFirst({
    where: { id, accountId: account.id },
    include: {
      nodes: { include: { carouselCards: true } },
      edges: true,
      triggers: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!flow) {
    notFound();
  }

  const info = { id: flow.id, name: flow.name, folder: flow.folder, status: flow.status };
  if (flow.mode === "SIMPLE") return <SimpleBuilder flow={info} initial={readRecipe(flow.recipe)} />;

  const [tags, catalog] = await Promise.all([
    prisma.tag.findMany({ where: { accountId: account.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }).catch(() => []),
    prisma.catalogItem.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, description: true, imageUrl: true, buttonTitle: true, buttonType: true },
    }).catch(() => []),
  ]);

  return (
    <FlowEditor
      flow={info}
      initial={fromDb(flow)}
      tags={tags}
      catalog={catalog}
    />
  );
}
