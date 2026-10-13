// Tipos do editor de fluxos: o que cada caixinha guarda e os limites da API do Instagram.
import type { KeywordMatch, NodeType, TriggerType } from "@/generated/prisma/enums";

/** Limites impostos pela Instagram Messaging API (ver docs/etapa-1-banco.md). */
export const LIMITS = {
  buttons: 3, // botões por mensagem (button template)
  cards: 10, // cards por carrossel (generic template)
  buttonTitle: 20, // rótulo do botão
  text: 1000, // bytes UTF-8 de uma DM
  buttonText: 640, // texto do template de botões
  keywords: 15, // palavras-chave por gatilho (mesmo limite do ManyChat)
  publicReplies: 10, // variações de resposta pública no comentário (sorteada a cada comentário)
} as const;

export type ButtonType = "postback" | "web_url";

/** Botão fixo da DM. Botões postback viram uma saída própria da caixinha. */
export type DmButton = { id: string; title: string; type: ButtonType; url?: string };

export type ConditionRule = "follows" | "has_tag" | "reply_contains" | "link_clicked";

/** Card do carrossel: `id` é a linha em CarouselCard (e o id da saída). */
export type CarouselCardRef = { id: string; catalogItemId: string };

/** Configuração de cada tipo de caixinha. */
export type NodeConfigMap = {
  MESSAGE: { text: string };
  /** reactToLastMessage: reage com ❤️ à última mensagem do lead antes de enviar (lembrete). */
  QUESTION: { text: string; buttons: DmButton[]; reactToLastMessage?: boolean };
  /** link_clicked: `nodeId` = caixinha cujo botão de link deve ter sido aberto. */
  CONDITION: { rule: ConditionRule; tagId?: string; value?: string; nodeId?: string };
  DELAY: { seconds: number };
  ADD_TAG: { tagId?: string };
  CAROUSEL: { cards: CarouselCardRef[] };
  /** text = 1º pedido · notFollowingText = tocou no botão e ainda não segue · finalText = 3ª vez em diante. */
  FOLLOW_GATE: { text: string; buttonTitle: string; notFollowingText: string; finalText?: string };
  NOTE: { text: string };
  TRIGGER: {
    type: TriggerType;
    keywords: string[];
    match: KeywordMatch;
    negativeKeywords?: string[];
    cooldownSeconds?: number;
    priority?: number;
    mediaId?: string;
    payload?: string;
    publicReplies: string[];
  };
};

/** Tudo que pode aparecer no canvas: os tipos de Node + o gatilho. */
export type EditorKind = NodeType | "TRIGGER";

export type EditorNodeData = {
  [K in EditorKind]: { kind: K; name: string | null; config: NodeConfigMap[K] };
}[EditorKind];

export type EditorNodeDataOf<K extends EditorKind> = Extract<EditorNodeData, { kind: K }>;

/** Caixinha como o React Flow enxerga (id, posição e dados). */
export type EditorNode = {
  id: string;
  type: EditorKind;
  position: { x: number; y: number };
  data: EditorNodeData;
};

/** Linha como o React Flow enxerga. */
export type EditorEdge = {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
};

export type Viewport = { x: number; y: number; zoom: number };

/** O que o editor manda pro servidor ao salvar. */
export type FlowSnapshot = {
  viewport: Viewport | null;
  nodes: EditorNode[];
  edges: EditorEdge[];
};

/** Prefixo dos ids de gatilho no canvas (não se misturam com os de Node). */
export const TRIGGER_PREFIX = "trigger:";

export const isTriggerId = (id: string) => id.startsWith(TRIGGER_PREFIX);
export const triggerNodeId = (triggerId: string) => `${TRIGGER_PREFIX}${triggerId}`;
export const triggerIdFrom = (nodeId: string) => nodeId.slice(TRIGGER_PREFIX.length);
