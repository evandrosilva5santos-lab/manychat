import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/flow-editor/FlowEditor";
import { SimpleBuilder } from "@/components/simple-builder/SimpleBuilder";
import { readRecipe } from "@/lib/flow/recipe";
import { getCurrentAccount } from "@/lib/account";
import { fromDb } from "@/lib/flow/convert";
import { prisma } from "@/lib/prisma";

export default async function FlowEditorPage(props: PageProps<"/fluxos/[id]">) {
  const { id } = await props.params;
  const demoRecipe = {
    trigger: {
      scope: "any" as const,
      mediaId: "18042938491823901",
      mediaUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
      mediaCaption: "💍 O grande dia está chegando! As inscrições para a cerimônia do Casamento dos Sonhos 2026 na Moving estão abertas. Comente CASAMENTO para receber as informações e o link de inscrição no direct!",
      keywords: ["casamento", "quero casar"],
      publicReplies: {
        enabled: true,
        variations: [
          "Que bom que você vai casar na Moving! 💍 Te mandei no direct",
          "Aaaah, que alegria! 💍 Vai ser lindo! Olha o direct",
          "Que demais! 💍✨ Vem saber como participar, te chamei no direct",
        ],
      },
    },
    welcome: {
      text: "AAAAH! 💍✨\nQue bom saber que você quer casar na Moving!\n\nVou te passar todas as informações de como participar do casamento. 👇",
      buttonTitle: "QUERO PARTICIPAR",
    },
    followGate: {
      enabled: true,
      text: "Você ainda não está seguindo a Moving! 👀\n\nSiga o nosso perfil para receber as informações sobre o casamento de 2026. 💍✨",
      buttonTitle: "JÁ SEGUI",
    },
    link: {
      text: "AAAAH! 💍🥹\nEntão você também sonha em viver esse momento com a Moving!\n\nQuer saber como funciona a inscrição para o casamento? Vou te encaminhar para o WhatsApp da equipe. 👇",
      buttonTitle: "QUERO ME INSCREVER",
      url: "https://wa.me/5551994044194?text=Oi%21%20Vim%20pelo%20post%20do%20casamento%20da%20Moving%20e%20quero%20saber%20como%20me%20inscrever%20no%20casamento%20de%202026.",
    },
    reminder: {
      enabled: true,
      delaySeconds: 3600,
      text: "Seu acesso está esperando por você. 👀 Clique no link abaixo e entre no grupo.",
      buttonTitle: "QUERO ME INSCREVER",
    },
  };

  if (id === "demo-casamento") {
    return (
      <SimpleBuilder
        flow={{
          id: "demo-casamento",
          name: "[2026] Casamento por DM automático",
          folder: "Moving 2026",
          status: "LIVE",
        }}
        initial={demoRecipe}
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
    // Fallback gracioso se o banco ainda não estiver conectado no .env
    return (
      <SimpleBuilder
        flow={{
          id,
          name: "[2026] Casamento por DM automático",
          folder: "Moving 2026",
          status: "LIVE",
        }}
        initial={demoRecipe}
      />
    );
  }

  if (!flow) notFound();

  const info = { id: flow.id, name: flow.name, folder: flow.folder, status: flow.status };
  if (flow.mode === "SIMPLE") return <SimpleBuilder flow={info} initial={readRecipe(flow.recipe)} />;

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
      flow={info}
      initial={fromDb(flow)}
      tags={tags}
      catalog={catalog}
    />
  );
}
