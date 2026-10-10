import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/flow-editor/FlowEditor";
import { SimpleBuilder } from "@/components/simple-builder/SimpleBuilder";
import { defaultRecipe, readRecipe } from "@/lib/flow/recipe";
import { getCurrentAccount } from "@/lib/account";
import { fromDb } from "@/lib/flow/convert";
import { prisma } from "@/lib/prisma";
import { getStoredFlow } from "@/lib/storage/store";

export default async function FlowEditorPage(props: PageProps<"/fluxos/[id]">) {
  const { id } = await props.params;

  if (id === "novo") {
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

  let flow: any = null;
  let account: any = null;

  try {
    account = await getCurrentAccount();
    flow = await prisma.flow.findFirst({
      where: { id, accountId: account.id },
      include: {
        nodes: { include: { carouselCards: true } },
        edges: true,
        triggers: { orderBy: { createdAt: "asc" } },
      },
    });
  } catch (error) {
    // Falha de banco remoto tratada via store local
  }

  if (!flow) {
    const stored = await getStoredFlow(id);
    if (stored) {
      const info = { id: stored.id, name: stored.name, folder: stored.folder, status: stored.status };
      if (stored.mode === "SIMPLE") {
        return <SimpleBuilder flow={info} initial={stored.recipe ? readRecipe(stored.recipe) : defaultRecipe()} />;
      }
      return (
        <FlowEditor
          flow={info}
          initial={{
            viewport: stored.viewport ?? { x: 0, y: 0, zoom: 1 },
            nodes: stored.nodes ?? [],
            edges: stored.edges ?? [],
          }}
          tags={[]}
          catalog={[]}
        />
      );
    }
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
