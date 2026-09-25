import { describe, expect, it } from "vitest";
import { fromDb, normalizeEdges, toSavePlan, type DbFlow } from "./convert";
import { lintFlow } from "./lint";
import { outputHandles, type CatalogLookup } from "./nodes";
import { snapshotSchema } from "./schema";
import type { EditorNode, FlowSnapshot } from "./types";

const catalog: CatalogLookup = (id) =>
  ({
    "cat-post": { buttonType: "POSTBACK", title: "Negócio" },
    "cat-url": { buttonType: "URL", title: "Site" },
  })[id] as ReturnType<CatalogLookup>;

const dbFlow: DbFlow = {
  viewport: { x: 10, y: 20, zoom: 0.8 },
  triggers: [
    {
      id: "t1",
      type: "STORY_REPLY",
      keywords: ["eu quero"],
      match: "CONTAINS",
      mediaId: null,
      payload: null,
      publicReplies: ["Te mandei no direct!"],
      startNodeId: "gate",
      positionX: 0,
      positionY: 0,
    },
  ],
  nodes: [
    {
      id: "gate",
      type: "FOLLOW_GATE",
      name: "Mensagem #1",
      positionX: 300,
      positionY: 0,
      data: { text: "Segue?", buttonTitle: "DESBLOQUEAR", notFollowingText: "Segue aí" },
    },
    { id: "cond", type: "CONDITION", name: null, positionX: 600, positionY: 0, data: { rule: "follows" } },
    {
      id: "car",
      type: "CAROUSEL",
      name: null,
      positionX: 900,
      positionY: 0,
      data: {},
      carouselCards: [
        { id: "cc2", catalogItemId: "cat-url", position: 1 },
        { id: "cc1", catalogItemId: "cat-post", position: 0 },
      ],
    },
    { id: "tag", type: "ADD_TAG", name: null, positionX: 1200, positionY: 0, data: { tagId: "tag-1" } },
    { id: "broken", type: "DELAY", name: null, positionX: 0, positionY: 300, data: "lixo" },
  ],
  edges: [
    { id: "e1", sourceNodeId: "gate", sourceHandle: "unlock", targetNodeId: "cond" },
    { id: "e2", sourceNodeId: "cond", sourceHandle: "yes", targetNodeId: "car" },
    { id: "e3", sourceNodeId: "car", sourceHandle: "cc1", targetNodeId: "tag" },
    { id: "e4", sourceNodeId: "cond", sourceHandle: "nao-existe", targetNodeId: "tag" },
  ],
};

describe("fromDb", () => {
  const snapshot = fromDb(dbFlow);

  it("transforma o gatilho em caixinha e o startNodeId em linha", () => {
    const trigger = snapshot.nodes.find((node) => node.type === "TRIGGER");
    expect(trigger?.id).toBe("trigger:t1");
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({ source: "trigger:t1", sourceHandle: null, target: "gate" }),
    );
  });

  it("traz os cards do carrossel na ordem certa", () => {
    const carousel = snapshot.nodes.find((node) => node.id === "car");
    expect(carousel?.data.kind === "CAROUSEL" && carousel.data.config.cards.map((c) => c.id)).toEqual([
      "cc1",
      "cc2",
    ]);
  });

  it("usa a config padrão quando o JSON do banco está estragado", () => {
    const broken = snapshot.nodes.find((node) => node.id === "broken");
    expect(broken?.data.config).toEqual({ seconds: 600 });
  });

  it("descarta linha que sai de uma saída inexistente", () => {
    expect(snapshot.edges.find((edge) => edge.sourceHandle === "nao-existe")).toBeUndefined();
  });

  it("ida e volta preserva caixinhas, linhas e gatilho", () => {
    const plan = toSavePlan(snapshot, catalog);
    expect(plan.nodes.map((node) => node.id).sort()).toEqual(["broken", "car", "cond", "gate", "tag"]);
    expect(plan.edges).toHaveLength(3);
    expect(plan.triggers[0]).toMatchObject({ id: "t1", startNodeId: "gate", keywords: ["eu quero"] });
    expect(plan.carouselCards).toEqual([
      { id: "cc1", nodeId: "car", catalogItemId: "cat-post", position: 0 },
      { id: "cc2", nodeId: "car", catalogItemId: "cat-url", position: 1 },
    ]);
    expect(plan.nodes.find((node) => node.id === "car")?.data).toEqual({});
    expect(plan.viewport).toEqual({ x: 10, y: 20, zoom: 0.8 });
  });
});

describe("saídas", () => {
  it("card com link externo não tem saída no fluxo", () => {
    const carousel = fromDb(dbFlow).nodes.find((node) => node.id === "car")!;
    expect(outputHandles(carousel.data, catalog).map((handle) => handle.id)).toEqual(["cc1"]);
  });

  it("cada saída fica com uma linha só (a última ganha)", () => {
    const nodes = fromDb(dbFlow).nodes;
    const edges = normalizeEdges(
      nodes,
      [
        { id: "a", source: "cond", sourceHandle: "yes", target: "car" },
        { id: "b", source: "cond", sourceHandle: "yes", target: "tag" },
      ],
      catalog,
    );
    expect(edges).toEqual([{ id: "b", source: "cond", sourceHandle: "yes", target: "tag" }]);
  });

  it("não aceita linha chegando no gatilho", () => {
    const nodes = fromDb(dbFlow).nodes;
    expect(normalizeEdges(nodes, [{ id: "x", source: "tag", sourceHandle: null, target: "trigger:t1" }], catalog)).toEqual(
      [],
    );
  });
});

function question(buttons: number, title = "OK"): EditorNode {
  return {
    id: "q",
    type: "QUESTION",
    position: { x: 0, y: 0 },
    data: {
      kind: "QUESTION",
      name: null,
      config: {
        text: "Oi",
        buttons: Array.from({ length: buttons }, (_, i) => ({ id: `b${i}`, title, type: "postback" as const })),
      },
    },
  };
}

const snap = (nodes: EditorNode[]): FlowSnapshot => ({ viewport: null, nodes, edges: [] });

describe("limites do Instagram no servidor", () => {
  it("aceita 3 botões", () => {
    expect(snapshotSchema.safeParse(snap([question(3)])).success).toBe(true);
  });

  it("recusa 4 botões", () => {
    const result = snapshotSchema.safeParse(snap([question(4)]));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/no máximo 3 botões/);
  });

  it("recusa rótulo de botão com mais de 20 caracteres", () => {
    expect(snapshotSchema.safeParse(snap([question(1, "X".repeat(21))])).success).toBe(false);
  });

  it("recusa 11 cards e card repetido", () => {
    const carousel = (cards: { id: string; catalogItemId: string }[]): EditorNode => ({
      id: "c",
      type: "CAROUSEL",
      position: { x: 0, y: 0 },
      data: { kind: "CAROUSEL", name: null, config: { cards } },
    });
    const eleven = Array.from({ length: 11 }, (_, i) => ({ id: `c${i}`, catalogItemId: `cat${i}` }));
    expect(snapshotSchema.safeParse(snap([carousel(eleven)])).success).toBe(false);
    expect(snapshotSchema.safeParse(snap([carousel(eleven.slice(0, 10))])).success).toBe(true);
    const repeated = [
      { id: "a", catalogItemId: "same" },
      { id: "b", catalogItemId: "same" },
    ];
    expect(snapshotSchema.safeParse(snap([carousel(repeated)])).success).toBe(false);
  });

  it("recusa tipo trocado entre type e data.kind", () => {
    const node = { ...question(1), type: "MESSAGE" } as unknown as EditorNode;
    expect(snapshotSchema.safeParse(snap([node])).success).toBe(false);
  });
});

describe("avisos", () => {
  it("aponta link sem https e fluxo sem gatilho", () => {
    const node = question(1);
    if (node.data.kind === "QUESTION") node.data.config.buttons[0] = { id: "b", title: "SITE", type: "web_url", url: "site.com" };
    const messages = lintFlow([node], []).map((problem) => problem.message);
    expect(messages).toContain("Adicione um gatilho pra dizer quando o fluxo começa");
    expect(messages.some((message) => message.includes("https://"))).toBe(true);
  });
});
