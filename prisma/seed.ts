// Dados de exemplo: o fluxo "Captação story Astrix" desenhado em design/Fluxo.dc.html.
// Rode com: npx prisma db seed
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { appDatabaseUrl } from "../src/lib/db-url";
import { toSavePlan } from "../src/lib/flow/convert";
import { compileRecipe, type Recipe } from "../src/lib/flow/recipe";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: appDatabaseUrl() }),
});

async function main() {
  const account = await prisma.instagramAccount.upsert({
    where: { igUserId: "demo-ig-user" },
    update: {},
    create: { igUserId: "demo-ig-user", username: "startinc", name: "Start Inc." },
  });

  const leadQuente = await prisma.tag.upsert({
    where: { accountId_name: { accountId: account.id, name: "lead-quente" } },
    update: {},
    create: { accountId: account.id, name: "lead-quente" },
  });

  const cards = await Promise.all(
    [
      { title: "Negócio", description: "Pra quem tem empresa.", buttonTitle: "ESCOLHER" },
      { title: "Profissão", description: "Pra quem quer crescer na carreira.", buttonTitle: "ESCOLHER" },
      { title: "Outros", description: "Pra todo o resto.", buttonTitle: "ESCOLHER" },
    ].map((card) =>
      prisma.catalogItem.create({
        data: {
          ...card,
          accountId: account.id,
          imageUrl: "https://placehold.co/1080x1080",
          buttonType: "POSTBACK",
        },
      }),
    ),
  );

  const flow = await prisma.flow.create({
    data: {
      accountId: account.id,
      name: "Captação story Astrix",
      folder: "[CAPT] Lança nível 1",
      status: "STOPPED",
      mode: "ADVANCED",
    },
  });

  const gate = await prisma.node.create({
    data: {
      flowId: flow.id,
      type: "FOLLOW_GATE",
      name: "Mensagem #1",
      positionX: 320,
      positionY: 120,
      data: {
        text: "Antes de liberar, confirma que você já segue o perfil 👀",
        buttonTitle: "DESBLOQUEAR",
        notFollowingText: "Ainda não te encontrei entre os seguidores. Segue e toca em DESBLOQUEAR de novo 😉",
      },
    },
  });
  const condition = await prisma.node.create({
    data: {
      flowId: flow.id,
      type: "CONDITION",
      name: "Segue o perfil?",
      positionX: 640,
      positionY: 120,
      data: { rule: "follows" },
    },
  });
  const carousel = await prisma.node.create({
    data: {
      flowId: flow.id,
      type: "CAROUSEL",
      positionX: 960,
      positionY: 40,
      carouselCards: {
        create: cards.map((card, position) => ({ catalogItemId: card.id, position })),
      },
    },
    include: { carouselCards: true },
  });
  const tag = await prisma.node.create({
    data: {
      flowId: flow.id,
      type: "ADD_TAG",
      positionX: 1280,
      positionY: 40,
      data: { tagId: leadQuente.id },
    },
  });
  const delay = await prisma.node.create({
    data: {
      flowId: flow.id,
      type: "DELAY",
      positionX: 960,
      positionY: 480,
      data: { seconds: 600 },
    },
  });

  await prisma.edge.createMany({
    data: [
      { flowId: flow.id, sourceNodeId: gate.id, sourceHandle: "unlock", targetNodeId: condition.id },
      { flowId: flow.id, sourceNodeId: condition.id, sourceHandle: "yes", targetNodeId: carousel.id },
      { flowId: flow.id, sourceNodeId: condition.id, sourceHandle: "no", targetNodeId: delay.id },
      { flowId: flow.id, sourceNodeId: delay.id, targetNodeId: gate.id },
      // cada card do carrossel é uma saída própria
      ...carousel.carouselCards.map((card) => ({
        flowId: flow.id,
        sourceNodeId: carousel.id,
        sourceHandle: card.id,
        targetNodeId: tag.id,
      })),
    ],
  });

  await prisma.trigger.create({
    data: {
      flowId: flow.id,
      type: "STORY_REPLY",
      keywords: ["eu quero"],
      match: "CONTAINS",
      startNodeId: gate.id,
      positionX: 0,
      positionY: 120,
    },
  });

  // ── Automação rápida (builder simples), com os textos do exemplo do ManyChat ──
  const recipe: Recipe = {
    trigger: {
      scope: "any",
      mediaId: "",
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
      buttonTitle: "QUERO PARTICIPAR", // "QUERO SABER COMO PARTICIPAR" passa do limite de 20 caracteres
    },
    followGate: {
      enabled: true,
      text: "Você ainda não está seguindo a Moving! 👀\n\nSiga o nosso perfil para receber as informações sobre o casamento de 2026. 💍✨",
      buttonTitle: "JÁ SEGUI",
    },
    link: {
      text: "AAAAH! 💍🥹\nEntão você também sonha em viver esse momento com a Moving!\n\nQuer saber como funciona a inscrição para o casamento? Vou te encaminhar para o WhatsApp da equipe. 👇",
      buttonTitle: "QUERO ME INSCREVER",
      url: "https://wa.me/5551999999999?text=Oi!%20Quero%20saber%20como%20me%20inscrever%20no%20casamento%20de%202026.",
    },
    reminder: {
      enabled: true,
      delaySeconds: 60 * 60,
      text: "Seu acesso está esperando por você. 👀 Clique no link abaixo e entre no grupo.",
      buttonTitle: "QUERO ME INSCREVER",
    },
  };
  const simple = await prisma.flow.create({
    data: {
      accountId: account.id,
      name: "[2026] Casamento por DM automático",
      folder: "Moving 2026",
      mode: "SIMPLE",
      recipe,
    },
  });
  const plan = toSavePlan(compileRecipe(simple.id, recipe), () => undefined);
  await prisma.node.createMany({ data: plan.nodes.map((node) => ({ ...node, flowId: simple.id })) });
  await prisma.edge.createMany({ data: plan.edges.map((edge) => ({ ...edge, flowId: simple.id })) });
  await prisma.trigger.createMany({ data: plan.triggers.map((trigger) => ({ ...trigger, flowId: simple.id })) });

  console.log(`Seed pronto: fluxo "${flow.name}" (avançado) e "${simple.name}" (automação rápida).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
