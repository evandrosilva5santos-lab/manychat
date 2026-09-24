// Dados de exemplo: o fluxo "Captação story Astrix" desenhado em design/Fluxo.dc.html.
// Rode com: npx prisma db seed
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
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
      positionY: 280,
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
    },
  });

  console.log(`Seed pronto: fluxo "${flow.name}" com 5 caixinhas e 3 cards do catálogo.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
