// Avisos de "falta alguma coisa" em cada caixinha. Não impedem salvar,
// mas o fluxo só vai poder ser publicado (Etapa 6) sem nenhum aviso.
import type { EditorEdge, EditorNode } from "./types";

export type Problem = { nodeId: string | null; message: string };

const isHttps = (url: string | undefined) => /^https:\/\/\S+$/.test(url?.trim() ?? "");

export function lintFlow(nodes: EditorNode[], edges: EditorEdge[]): Problem[] {
  const problems: Problem[] = [];
  const add = (nodeId: string | null, message: string) => problems.push({ nodeId, message });
  const hasOutgoing = (id: string) => edges.some((edge) => edge.source === id);

  if (!nodes.some((node) => node.data.kind === "TRIGGER")) {
    add(null, "Adicione um gatilho pra dizer quando o fluxo começa");
  }

  for (const node of nodes) {
    const data = node.data;
    switch (data.kind) {
      case "TRIGGER": {
        const { type, keywords, match, payload } = data.config;
        if (type === "BUTTON_CLICK" && !payload?.trim()) add(node.id, "Informe o payload do botão");
        if (type !== "BUTTON_CLICK" && match !== "ANY" && keywords.length === 0) {
          add(node.id, "Adicione pelo menos 1 palavra-chave (ou escolha “qualquer mensagem”)");
        }
        if (!hasOutgoing(node.id)) add(node.id, "Ligue o gatilho à primeira caixinha");
        break;
      }
      case "MESSAGE":
      case "FOLLOW_GATE":
        if (!data.config.text.trim()) add(node.id, "Escreva a mensagem");
        break;
      case "QUESTION":
        if (!data.config.text.trim()) add(node.id, "Escreva a pergunta");
        if (data.config.buttons.length === 0) add(node.id, "Adicione pelo menos 1 botão");
        for (const button of data.config.buttons) {
          if (!button.title.trim()) add(node.id, "Tem botão sem texto");
          if (button.type === "web_url" && !isHttps(button.url)) {
            add(node.id, `O link do botão “${button.title || "sem nome"}” precisa começar com https://`);
          }
        }
        break;
      case "CONDITION":
        if (data.config.rule === "has_tag" && !data.config.tagId) add(node.id, "Escolha a etiqueta da condição");
        if (data.config.rule === "reply_contains" && !data.config.value?.trim()) {
          add(node.id, "Escreva o texto que a resposta deve conter");
        }
        break;
      case "ADD_TAG":
        if (!data.config.tagId) add(node.id, "Escolha a etiqueta");
        break;
      case "CAROUSEL":
        if (data.config.cards.length === 0) add(node.id, "Escolha pelo menos 1 card do catálogo");
        break;
      case "DELAY":
      case "NOTE":
        break;
    }
  }
  return problems;
}
