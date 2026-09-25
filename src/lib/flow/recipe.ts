// Builder simples ("automação rápida"): uma receita pronta de
// comentário → DM → botão → confirme que segue → link → lembrete.
// A receita é compilada em caixinhas normais (Node/Edge/Trigger), então o motor
// só precisa saber rodar caixinhas, e o builder avançado mostra o mesmo fluxo.
import { z } from "zod";
import { LIMITS, triggerNodeId, type EditorEdge, type EditorNode, type FlowSnapshot } from "./types";

export type Recipe = {
  trigger: {
    scope: "any" | "specific" | "next"; // qualquer publicação, uma específica ou a próxima
    matchType?: "keywords" | "any"; // palavra específica ou qualquer palavra
    mediaId: string;
    mediaUrl?: string;
    mediaCaption?: string;
    keywords: string[];
    publicReplies: { enabled: boolean; variations: string[] };
  };
  welcome: { enabled?: boolean; text: string; buttonTitle: string };
  followGate: { enabled: boolean; text: string; buttonTitle: string };
  link: { text: string; buttonTitle: string; url: string };
  reminder: { enabled: boolean; delaySeconds: number; text: string; buttonTitle: string };
};

const text = z.string().max(LIMITS.text, `Máximo de ${LIMITS.text} caracteres`);
const buttonTitle = z.string().trim().max(LIMITS.buttonTitle, `Máximo de ${LIMITS.buttonTitle} caracteres no botão`);

export const recipeSchema = z.object({
  trigger: z.object({
    scope: z.enum(["any", "specific", "next"]),
    matchType: z.enum(["keywords", "any"]).optional(),
    mediaId: z.string().trim().max(100),
    mediaUrl: z.string().trim().max(2000).optional(),
    mediaCaption: z.string().trim().max(1000).optional(),
    keywords: z
      .array(z.string().trim().min(1).max(100))
      .max(LIMITS.keywords, `No máximo ${LIMITS.keywords} palavras-chave`),
    publicReplies: z.object({
      enabled: z.boolean(),
      variations: z
        .array(text)
        .max(LIMITS.publicReplies, `No máximo ${LIMITS.publicReplies} respostas públicas`),
    }),
  }),
  welcome: z.object({
    enabled: z.boolean().optional().default(true),
    text,
    buttonTitle,
  }),
  followGate: z.object({ enabled: z.boolean(), text, buttonTitle }),
  link: z.object({ text, buttonTitle, url: z.string().trim().max(2000) }),
  reminder: z.object({
    enabled: z.boolean(),
    delaySeconds: z.number().int().min(60).max(60 * 60 * 24 * 7),
    text,
    buttonTitle,
  }),
}) satisfies z.ZodType<Recipe>;

export function defaultRecipe(): Recipe {
  return {
    trigger: {
      scope: "any",
      matchType: "keywords",
      mediaId: "",
      mediaUrl: "",
      mediaCaption: "",
      keywords: [],
      publicReplies: { enabled: true, variations: ["Te mandei no direct! 📩"] },
    },
    welcome: {
      enabled: true,
      text: "Oi! Que bom que você comentou 😊\n\nToca no botão aqui embaixo que eu te passo tudo.",
      buttonTitle: "QUERO SABER",
    },
    followGate: {
      enabled: true,
      text: "Você ainda não está seguindo o perfil 👀\n\nSegue a gente e toca no botão de novo pra receber.",
      buttonTitle: "JÁ SEGUI",
    },
    link: {
      text: "Aqui está! Toca no botão pra acessar 👇",
      buttonTitle: "ACESSAR",
      url: "",
    },
    reminder: {
      enabled: false,
      delaySeconds: 60 * 60,
      text: "Seu acesso está esperando por você 👀 Toca no botão abaixo.",
      buttonTitle: "ACESSAR",
    },
  };
}

/** Lê a receita guardada no banco; o que faltar vem do padrão. */
export function readRecipe(raw: unknown): Recipe {
  const base = defaultRecipe();
  const value = (raw ?? {}) as Partial<Recipe>;
  const merged = {
    trigger: {
      ...base.trigger,
      ...value.trigger,
      publicReplies: { ...base.trigger.publicReplies, ...value.trigger?.publicReplies },
    },
    welcome: { ...base.welcome, ...value.welcome },
    followGate: { ...base.followGate, ...value.followGate },
    link: { ...base.link, ...value.link },
    reminder: { ...base.reminder, ...value.reminder },
  };
  const parsed = recipeSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

/** Ids fixos por fluxo: editar a receita não troca os ids das caixinhas. */
export function recipeIds(flowId: string) {
  return {
    trigger: triggerNodeId(`${flowId}-t`),
    welcome: `${flowId}-welcome`,
    welcomeButton: `${flowId}-welcome-btn`,
    follows: `${flowId}-follows`,
    gate: `${flowId}-gate`,
    link: `${flowId}-link`,
    linkButton: `${flowId}-link-btn`,
    wait: `${flowId}-wait`,
    clicked: `${flowId}-clicked`,
    reminder: `${flowId}-reminder`,
    reminderButton: `${flowId}-reminder-btn`,
  };
}

/**
 * Receita → caixinhas.
 *
 *   GATILHO → BOAS-VINDAS [botão] → SEGUE? ─sim→ LINK
 *                                          └não→ "SIGA O PERFIL" [JÁ SEGUI] → LINK
 *   LINK → ESPERA → ABRIU O LINK? ─não→ LEMBRETE [mesmo link]
 */
export function compileRecipe(flowId: string, recipe: Recipe): FlowSnapshot {
  const id = recipeIds(flowId);
  const nodes: EditorNode[] = [];
  const edges: EditorEdge[] = [];
  const link = (source: string, sourceHandle: string | null, target: string) =>
    edges.push({ id: `${source}>${sourceHandle ?? ""}`, source, sourceHandle, target });
  const col = (n: number) => n * 320;

  nodes.push({
    id: id.trigger,
    type: "TRIGGER",
    position: { x: col(0), y: 0 },
    data: {
      kind: "TRIGGER",
      name: null,
      config: {
        type: "COMMENT_KEYWORD",
        keywords: recipe.trigger.keywords,
        match: "CONTAINS",
        mediaId: recipe.trigger.scope === "specific" ? recipe.trigger.mediaId : undefined,
        publicReplies: recipe.trigger.publicReplies.enabled
          ? recipe.trigger.publicReplies.variations.filter((reply) => reply.trim())
          : [],
      },
    },
  });

  const welcomeEnabled = recipe.welcome.enabled !== false;

  if (welcomeEnabled) {
    nodes.push({
      id: id.welcome,
      type: "QUESTION",
      position: { x: col(1), y: 0 },
      data: {
        kind: "QUESTION",
        name: "Mensagem de boas-vindas",
        config: {
          text: recipe.welcome.text,
          buttons: [{ id: id.welcomeButton, title: recipe.welcome.buttonTitle, type: "postback" }],
        },
      },
    });
    link(id.trigger, null, id.welcome);
  }

  const linkButton = (buttonId: string, title: string) => ({
    id: buttonId,
    title,
    type: "web_url" as const,
    url: recipe.link.url,
  });
  nodes.push({
    id: id.link,
    type: "QUESTION",
    position: { x: col(recipe.followGate.enabled ? 4 : 2), y: 0 },
    data: {
      kind: "QUESTION",
      name: "DM com o link",
      config: { text: recipe.link.text, buttons: [linkButton(id.linkButton, recipe.link.buttonTitle)] },
    },
  });

  if (recipe.followGate.enabled) {
    nodes.push({
      id: id.follows,
      type: "CONDITION",
      position: { x: col(welcomeEnabled ? 2 : 1), y: 0 },
      data: { kind: "CONDITION", name: "Segue o perfil?", config: { rule: "follows" } },
    });
    nodes.push({
      id: id.gate,
      type: "FOLLOW_GATE",
      position: { x: col(welcomeEnabled ? 3 : 2), y: 200 },
      data: {
        kind: "FOLLOW_GATE",
        name: "Pedir pra seguir",
        config: {
          text: recipe.followGate.text,
          buttonTitle: recipe.followGate.buttonTitle,
          notFollowingText: recipe.followGate.text,
        },
      },
    });
    if (welcomeEnabled) {
      link(id.welcome, id.welcomeButton, id.follows);
    } else {
      link(id.trigger, null, id.follows);
    }
    link(id.follows, "yes", id.link);
    link(id.follows, "no", id.gate);
    link(id.gate, "unlock", id.link);
  } else {
    if (welcomeEnabled) {
      link(id.welcome, id.welcomeButton, id.link);
    } else {
      link(id.trigger, null, id.link);
    }
  }

  if (recipe.reminder.enabled) {
    const x = recipe.followGate.enabled ? 5 : 3;
    nodes.push({
      id: id.wait,
      type: "DELAY",
      position: { x: col(x), y: 0 },
      data: { kind: "DELAY", name: null, config: { seconds: recipe.reminder.delaySeconds } },
    });
    nodes.push({
      id: id.clicked,
      type: "CONDITION",
      position: { x: col(x + 1), y: 0 },
      data: { kind: "CONDITION", name: "Abriu o link?", config: { rule: "link_clicked", nodeId: id.link } },
    });
    nodes.push({
      id: id.reminder,
      type: "QUESTION",
      position: { x: col(x + 2), y: 160 },
      data: {
        kind: "QUESTION",
        name: "Lembrete",
        config: {
          text: recipe.reminder.text,
          buttons: [linkButton(id.reminderButton, recipe.reminder.buttonTitle)],
        },
      },
    });
    link(id.link, null, id.wait);
    link(id.wait, null, id.clicked);
    link(id.clicked, "no", id.reminder);
  }

  return { viewport: null, nodes, edges };
}

export type RecipeSection = "trigger" | "welcome" | "followGate" | "link" | "reminder";
export type RecipeProblem = { section: RecipeSection; message: string };

const isHttps = (url: string) => /^https:\/\/\S+$/.test(url.trim());

/** Avisos do que falta preencher, por seção da tela. */
export function lintRecipe(recipe: Recipe): RecipeProblem[] {
  const problems: RecipeProblem[] = [];
  const add = (section: RecipeSection, message: string) => problems.push({ section, message });

  if (recipe.trigger.keywords.length === 0) add("trigger", "Adicione pelo menos 1 palavra-chave");
  if (recipe.trigger.scope === "specific" && !recipe.trigger.mediaId.trim()) {
    add("trigger", "Informe o ID da publicação (ou escolha qualquer publicação)");
  }
  if (recipe.trigger.publicReplies.enabled && !recipe.trigger.publicReplies.variations.some((reply) => reply.trim())) {
    add("trigger", "Escreva pelo menos 1 resposta pública (ou desligue a opção)");
  }
  if (!recipe.welcome.text.trim()) add("welcome", "Escreva a mensagem de boas-vindas");
  if (!recipe.welcome.buttonTitle.trim()) add("welcome", "Dê um texto ao botão da boas-vindas");
  if (recipe.followGate.enabled) {
    if (!recipe.followGate.text.trim()) add("followGate", "Escreva a mensagem pedindo pra seguir");
    if (!recipe.followGate.buttonTitle.trim()) add("followGate", "Dê um texto ao botão de tentar de novo");
  }
  if (!recipe.link.text.trim()) add("link", "Escreva a mensagem do link");
  if (!recipe.link.buttonTitle.trim()) add("link", "Dê um texto ao botão do link");
  if (!isHttps(recipe.link.url)) add("link", "O link precisa começar com https://");
  if (recipe.reminder.enabled) {
    if (!recipe.reminder.text.trim()) add("reminder", "Escreva o lembrete");
    if (!recipe.reminder.buttonTitle.trim()) add("reminder", "Dê um texto ao botão do lembrete");
    if (recipe.reminder.delaySeconds > 23 * 3600) {
      add("reminder", "O Instagram só deixa mandar DM até 24h depois da última mensagem do contato — use no máximo 23 horas");
    }
  }
  return problems;
}
