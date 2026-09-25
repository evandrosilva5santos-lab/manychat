// O que cada tipo de caixinha é: nome na tela, categoria de cor, config inicial e saídas.
import type { CardButtonType } from "@/generated/prisma/enums";
import type { EditorKind, EditorNodeData, NodeConfigMap } from "./types";

/** Categoria de cor do design system (tokens node-*). */
export type NodeCategory = "trigger" | "message" | "condition" | "delay" | "action" | "note";

export const KIND_META: Record<EditorKind, { label: string; category: NodeCategory; hint: string }> = {
  TRIGGER: { label: "Gatilho", category: "trigger", hint: "O que faz o fluxo começar" },
  MESSAGE: { label: "Mensagem", category: "message", hint: "Mandar um texto" },
  QUESTION: { label: "Pergunta com botões", category: "message", hint: "Até 3 botões fixos" },
  CAROUSEL: { label: "Carrossel", category: "message", hint: "Cards do catálogo" },
  FOLLOW_GATE: { label: "Confirme que segue", category: "message", hint: "Botão DESBLOQUEAR" },
  CONDITION: { label: "Condição", category: "condition", hint: "Caminho sim / não" },
  DELAY: { label: "Espera", category: "delay", hint: "Aguardar um tempo" },
  ADD_TAG: { label: "Etiqueta", category: "action", hint: "Colocar etiqueta no contato" },
  NOTE: { label: "Anotação", category: "note", hint: "Lembrete no canvas" },
};

/** Ordem da paleta. */
export const PALETTE: EditorKind[] = [
  "TRIGGER",
  "MESSAGE",
  "QUESTION",
  "CAROUSEL",
  "FOLLOW_GATE",
  "CONDITION",
  "DELAY",
  "ADD_TAG",
  "NOTE",
];

export const newId = () => crypto.randomUUID();

export function defaultConfig<K extends EditorKind>(kind: K): NodeConfigMap[K] {
  const defaults: { [P in EditorKind]: () => NodeConfigMap[P] } = {
    TRIGGER: () => ({ type: "COMMENT_KEYWORD", keywords: [], match: "CONTAINS", publicReplies: [] }),
    MESSAGE: () => ({ text: "" }),
    QUESTION: () => ({
      text: "",
      buttons: [{ id: newId(), title: "QUERO", type: "postback" }],
    }),
    CAROUSEL: () => ({ cards: [] }),
    FOLLOW_GATE: () => ({
      text: "Antes de liberar, confirma que você já segue o perfil 👀",
      buttonTitle: "DESBLOQUEAR",
      notFollowingText: "Ainda não te encontrei entre os seguidores. Segue e toca em DESBLOQUEAR de novo.",
    }),
    CONDITION: () => ({ rule: "follows" }),
    DELAY: () => ({ seconds: 600 }),
    ADD_TAG: () => ({}),
    NOTE: () => ({ text: "" }),
  };
  return defaults[kind]() as NodeConfigMap[K];
}

export function newNodeData(kind: EditorKind): EditorNodeData {
  return { kind, name: null, config: defaultConfig(kind) } as EditorNodeData;
}

export type OutputHandle = { id: string | null; label: string };

/** Como o card do catálogo leva adiante: link externo não tem saída no fluxo. */
export type CatalogLookup = (catalogItemId: string) => { buttonType: CardButtonType; title: string } | undefined;

/**
 * Saídas de uma caixinha. Cada uma pode ter no máximo uma linha.
 * `id: null` = saída única.
 */
export function outputHandles(data: EditorNodeData, catalog: CatalogLookup): OutputHandle[] {
  switch (data.kind) {
    case "TRIGGER":
    case "MESSAGE":
    case "DELAY":
    case "ADD_TAG":
      return [{ id: null, label: "Próximo passo" }];
    case "QUESTION": {
      const postbacks = data.config.buttons.filter((button) => button.type === "postback");
      // Só botões de link: a mensagem segue direto pro próximo passo depois de enviada.
      if (postbacks.length === 0) return [{ id: null, label: "Depois de enviar" }];
      return postbacks.map((button) => ({ id: button.id, label: button.title || "Botão" }));
    }
    case "CONDITION":
      return [
        { id: "yes", label: "Sim" },
        { id: "no", label: "Não" },
      ];
    case "FOLLOW_GATE":
      return [{ id: "unlock", label: data.config.buttonTitle || "DESBLOQUEAR" }];
    case "CAROUSEL":
      return data.config.cards
        .filter((card) => catalog(card.catalogItemId)?.buttonType === "POSTBACK")
        .map((card) => ({ id: card.id, label: catalog(card.catalogItemId)?.title ?? "Card" }));
    case "NOTE":
      return [];
  }
}

/** Caixinhas que recebem linha chegando (gatilho e anotação não). */
export const hasInput = (kind: EditorKind) => kind !== "TRIGGER" && kind !== "NOTE";

/** "10 minutos", "2 horas", "1 dia". */
export function formatDelay(seconds: number): string {
  const units: [number, string, string][] = [
    [86400, "dia", "dias"],
    [3600, "hora", "horas"],
    [60, "minuto", "minutos"],
    [1, "segundo", "segundos"],
  ];
  for (const [size, one, many] of units) {
    if (seconds >= size && seconds % size === 0) {
      const count = seconds / size;
      return `${count} ${count === 1 ? one : many}`;
    }
  }
  return `${seconds} segundos`;
}
