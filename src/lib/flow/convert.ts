// Tradução entre o banco (Node, Edge, Trigger, CarouselCard) e o React Flow.
// Funções puras: sem banco e sem React, pra dar pra testar sozinhas.
import type { KeywordMatch, NodeType, TriggerType } from "@/generated/prisma/enums";
import { configSchemas } from "./schema";
import { defaultConfig, hasInput, outputHandles, type CatalogLookup } from "./nodes";
import {
  isTriggerId,
  triggerIdFrom,
  triggerNodeId,
  type EditorEdge,
  type EditorKind,
  type EditorNode,
  type EditorNodeData,
  type FlowSnapshot,
  type NodeConfigMap,
  type Viewport,
} from "./types";

// ── Formato do banco (só os campos que usamos) ───────────────────────────────

export type DbNode = {
  id: string;
  type: NodeType;
  name: string | null;
  positionX: number;
  positionY: number;
  data: unknown;
  carouselCards?: { id: string; catalogItemId: string; position: number }[];
};

export type DbEdge = { id: string; sourceNodeId: string; sourceHandle: string | null; targetNodeId: string };

export type DbTrigger = {
  id: string;
  type: TriggerType;
  keywords: string[];
  match: KeywordMatch;
  mediaId: string | null;
  payload: string | null;
  publicReply: string | null;
  startNodeId: string | null;
  positionX: number;
  positionY: number;
};

export type DbFlow = { viewport: unknown; nodes: DbNode[]; edges: DbEdge[]; triggers: DbTrigger[] };

/** Lê a config guardada no banco; se estiver estragada, usa a padrão do tipo. */
function readConfig<K extends EditorKind>(kind: K, raw: unknown): NodeConfigMap[K] {
  const parsed = configSchemas[kind].safeParse({ ...defaultConfig(kind), ...(raw as object) });
  return (parsed.success ? parsed.data : defaultConfig(kind)) as NodeConfigMap[K];
}

function readViewport(raw: unknown): Viewport | null {
  const v = raw as Partial<Viewport> | null;
  if (v && typeof v.x === "number" && typeof v.y === "number" && typeof v.zoom === "number") {
    return { x: v.x, y: v.y, zoom: v.zoom };
  }
  return null;
}

const undef = <T>(value: T | null) => value ?? undefined;

/** Banco → editor. */
export function fromDb(flow: DbFlow): FlowSnapshot {
  const nodes: EditorNode[] = [];
  const edges: EditorEdge[] = [];

  for (const trigger of flow.triggers) {
    const id = triggerNodeId(trigger.id);
    nodes.push({
      id,
      type: "TRIGGER",
      position: { x: trigger.positionX, y: trigger.positionY },
      data: {
        kind: "TRIGGER",
        name: null,
        config: readConfig("TRIGGER", {
          type: trigger.type,
          keywords: trigger.keywords,
          match: trigger.match,
          mediaId: undef(trigger.mediaId),
          payload: undef(trigger.payload),
          publicReply: undef(trigger.publicReply),
        }),
      },
    });
    if (trigger.startNodeId) {
      edges.push({ id: `e-${id}`, source: id, sourceHandle: null, target: trigger.startNodeId });
    }
  }

  for (const node of flow.nodes) {
    const raw =
      node.type === "CAROUSEL"
        ? {
            cards: [...(node.carouselCards ?? [])]
              .sort((a, b) => a.position - b.position)
              .map(({ id, catalogItemId }) => ({ id, catalogItemId })),
          }
        : node.data;
    nodes.push({
      id: node.id,
      type: node.type,
      position: { x: node.positionX, y: node.positionY },
      data: { kind: node.type, name: node.name, config: readConfig(node.type, raw) } as EditorNodeData,
    });
  }

  for (const edge of flow.edges) {
    edges.push({
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: edge.sourceHandle,
      target: edge.targetNodeId,
    });
  }

  return { viewport: readViewport(flow.viewport), nodes, edges: normalizeEdges(nodes, edges, () => undefined, true) };
}

/**
 * Limpa as linhas: tira as que apontam pra caixinha ou saída que não existe
 * e deixa só uma linha por saída (a última ganha).
 * `trustCarousel` aceita qualquer saída de card (quando ainda não temos o catálogo).
 */
export function normalizeEdges(
  nodes: EditorNode[],
  edges: EditorEdge[],
  catalog: CatalogLookup,
  trustCarousel = false,
): EditorEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const bySlot = new Map<string, EditorEdge>();

  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target || !hasInput(target.type) || edge.source === edge.target) continue;

    const handles =
      trustCarousel && source.data.kind === "CAROUSEL"
        ? source.data.config.cards.map((card) => card.id)
        : outputHandles(source.data, catalog).map((handle) => handle.id);
    if (!handles.includes(edge.sourceHandle)) continue;

    bySlot.set(`${edge.source}\u0000${edge.sourceHandle ?? ""}`, edge);
  }
  return [...bySlot.values()];
}

// ── Editor → banco ───────────────────────────────────────────────────────────

export type SavePlan = {
  viewport: Viewport | null;
  nodes: {
    id: string;
    type: NodeType;
    name: string | null;
    positionX: number;
    positionY: number;
    data: object;
  }[];
  carouselCards: { id: string; nodeId: string; catalogItemId: string; position: number }[];
  edges: { sourceNodeId: string; sourceHandle: string | null; targetNodeId: string }[];
  triggers: (Omit<DbTrigger, "mediaId" | "payload" | "publicReply"> & {
    mediaId: string | null;
    payload: string | null;
    publicReply: string | null;
  })[];
};

const orNull = (value: string | undefined) => (value && value.trim() ? value.trim() : null);

/** Editor → o que gravar em cada tabela. */
export function toSavePlan(snapshot: FlowSnapshot, catalog: CatalogLookup): SavePlan {
  const edges = normalizeEdges(snapshot.nodes, snapshot.edges, catalog);
  const plan: SavePlan = { viewport: snapshot.viewport, nodes: [], carouselCards: [], edges: [], triggers: [] };

  for (const node of snapshot.nodes) {
    const data = node.data;
    if (data.kind === "TRIGGER") {
      const start = edges.find((edge) => edge.source === node.id);
      plan.triggers.push({
        id: triggerIdFrom(node.id),
        type: data.config.type,
        keywords: data.config.keywords,
        match: data.config.match,
        mediaId: orNull(data.config.mediaId),
        payload: orNull(data.config.payload),
        publicReply: orNull(data.config.publicReply),
        startNodeId: start?.target ?? null,
        positionX: node.position.x,
        positionY: node.position.y,
      });
      continue;
    }

    // Os cards do carrossel moram na tabela CarouselCard, não no JSON.
    const json: object = data.kind === "CAROUSEL" ? {} : data.config;
    if (data.kind === "CAROUSEL") {
      data.config.cards.forEach((card, position) =>
        plan.carouselCards.push({ id: card.id, nodeId: node.id, catalogItemId: card.catalogItemId, position }),
      );
    }
    plan.nodes.push({
      id: node.id,
      type: data.kind,
      name: data.name && data.name.trim() ? data.name.trim() : null,
      positionX: node.position.x,
      positionY: node.position.y,
      data: json,
    });
  }

  for (const edge of edges) {
    if (isTriggerId(edge.source)) continue; // vira Trigger.startNodeId
    plan.edges.push({ sourceNodeId: edge.source, sourceHandle: edge.sourceHandle, targetNodeId: edge.target });
  }
  return plan;
}
