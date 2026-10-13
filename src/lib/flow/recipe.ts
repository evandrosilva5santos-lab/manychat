// Builder simples ("automação rápida"): uma receita pronta de
// comentário → DM → botão → confirme que segue → link → lembrete.
// A receita é compilada em caixinhas normais (Node/Edge/Trigger), então o motor
// só precisa saber rodar caixinhas, e o builder avançado mostra o mesmo fluxo.
import { z } from "zod";
import { buttonTextSchema } from "./schema";
import { LIMITS, triggerNodeId, type EditorEdge, type EditorNode, type FlowSnapshot } from "./types";
import { UserFacingError } from "@/lib/user-error";

export type RecipeButton = {
  id?: string;
  title: string;
  url: string;
};

export type Recipe = {
  trigger: {
    scope: "any" | "specific" | "next"; // qualquer publicação, uma específica ou a próxima
    matchType?: "keywords" | "any"; // palavra específica ou qualquer palavra
    matchCondition?: "CONTAINS" | "EXACT";
    negativeKeywords?: string[];
    cooldownSeconds?: number;
    priority?: number;
    mediaId: string;
    mediaUrl?: string;
    mediaCaption?: string;
    keywords: string[];
    publicReplies: { enabled: boolean; variations: string[] };
  };
  welcome: { enabled?: boolean; text: string; buttonTitle: string };
  /** text = 1º pedido · retryText = tocou e ainda não segue · finalText = insistiu de novo (3ª vez em diante). */
  followGate: { enabled: boolean; text: string; buttonTitle: string; retryText: string; finalText: string };
  link: {
    text: string;
    buttonTitle: string;
    url: string;
    buttons?: RecipeButton[];
  };
  /**
   * Lembretes para quem não abriu o link: o 1º depois de `delaySeconds` (com ❤️ opcional na
   * última mensagem do lead) e o 2º em `second.delaySeconds` — ambos contados do envio do link.
   */
  reminder: {
    enabled: boolean;
    delaySeconds: number;
    text: string;
    buttonTitle: string;
    react: boolean;
    second: { enabled: boolean; delaySeconds: number; text: string };
  };
};

const text = buttonTextSchema;
/** A Meta só deixa mandar DM até 24 h depois da última mensagem do contato. */
const MAX_REMINDER_DELAY = 60 * 60 * 23;
/** Limite de legenda do Instagram. */
export const MAX_MEDIA_CAPTION = 2200;
const MAX_MEDIA_URL = 4096;
const buttonTitle = z.string().trim().max(LIMITS.buttonTitle, `Máximo de ${LIMITS.buttonTitle} caracteres no botão`);

export const recipeButtonSchema = z.object({
  id: z.string().optional(),
  title: buttonTitle,
  url: z.string().trim().max(2000),
});

export const recipeSchema = z.object({
  trigger: z.object({
    scope: z.enum(["any", "specific", "next"]),
    matchType: z.enum(["keywords", "any"]).optional(),
    matchCondition: z.enum(["CONTAINS", "EXACT"]).optional(),
    negativeKeywords: z.array(z.string().trim().min(1).max(100)).max(15).optional(),
    cooldownSeconds: z.number().int().min(0).max(2147483647).optional(),
    priority: z.number().int().min(-2147483648).max(2147483647).optional(),
    mediaId: z.string().trim().max(100),
    // Só para mostrar o post no construtor. Limites do próprio Instagram:
    // legenda de até 2.200 caracteres e URLs de CDN que passam de 2.000.
    mediaUrl: z.string().trim().max(MAX_MEDIA_URL).optional(),
    mediaCaption: z.string().trim().max(MAX_MEDIA_CAPTION).optional(),
    keywords: z
      .array(z.string().trim().min(1).max(100))
      .max(LIMITS.keywords, `No máximo ${LIMITS.keywords} palavras-chave`),
    publicReplies: z.object({
      enabled: z.boolean(),
      variations: z
        .array(text)
        .max(LIMITS.publicReplies, `No máximo ${LIMITS.publicReplies} respostas públicas`),
    }),
  }).refine((trigger) => trigger.scope !== "specific" || Boolean(trigger.mediaId), { path: ["mediaId"], message: "Informe o ID da publicação específica" }),
  welcome: z.object({
    enabled: z.boolean().optional().default(true),
    text,
    buttonTitle,
  }),
  followGate: z.object({ enabled: z.boolean(), text, buttonTitle, retryText: text, finalText: text }),
  link: z.object({
    text,
    buttonTitle,
    url: z.string().trim().max(2000),
    buttons: z.array(recipeButtonSchema).max(3, "No máximo 3 botões na DM (limite da Meta)").optional(),
  }),
  reminder: z.object({
    enabled: z.boolean(),
    delaySeconds: z.number().int().min(60).max(MAX_REMINDER_DELAY),
    text,
    buttonTitle,
    react: z.boolean(),
    second: z.object({
      enabled: z.boolean(),
      delaySeconds: z.number().int().min(60).max(MAX_REMINDER_DELAY),
      text,
    }),
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
      retryText: "Hmm, ainda não apareceu aqui que você segue 🤔\n\nConfere se tocou em Seguir no perfil e toca no botão de novo.",
      finalText:
        "Ainda não consegui confirmar 😕 Às vezes o Instagram demora uns minutinhos pra atualizar.\n\nSegue o perfil, espera um pouquinho e toca no botão de novo.",
    },
    link: {
      text: "Aqui está! Toca no botão pra acessar 👇",
      buttonTitle: "ACESSAR",
      url: "",
    },
    reminder: {
      enabled: false,
      delaySeconds: 10 * 60,
      text: "Seu acesso está esperando por você 👀 Toca no botão abaixo.",
      buttonTitle: "ACESSAR",
      react: true,
      second: {
        enabled: true,
        delaySeconds: 2 * 60 * 60,
        text: "Passando pra lembrar: teu material ainda está aqui 🎁 Toca no botão pra acessar.",
      },
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
    link: {
      ...base.link,
      ...value.link,
      buttons:
        value.link?.buttons && value.link.buttons.length > 0
          ? value.link.buttons
          : value.link?.buttonTitle || value.link?.url
          ? [
              {
                title: value.link.buttonTitle || base.link.buttonTitle,
                url: value.link.url || base.link.url,
              },
            ]
          : undefined,
    },
    reminder: {
      ...base.reminder,
      ...value.reminder,
      second: { ...base.reminder.second, ...value.reminder?.second },
    },
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
    wait2: `${flowId}-wait2`,
    clicked2: `${flowId}-clicked2`,
    reminder2: `${flowId}-reminder2`,
    reminder2Button: `${flowId}-reminder2-btn`,
  };
}

/**
 * Receita → caixinhas.
 *
 *   GATILHO → BOAS-VINDAS [botão] → SEGUE? ─sim→ LINK
 *                                          └não→ "SIGA O PERFIL" [JÁ SEGUI] → LINK
 *   LINK → ESPERA → ABRIU O LINK? ─não→ LEMBRETE [mesmo link]
 */
/** Respostas públicas prontas, na ordem em que o construtor sugere ao adicionar um campo. */
export const PUBLIC_REPLY_SUGGESTIONS = [
  "Te mandei no direct! 📩",
  "Corre lá no direct que já te enviei 👀",
  "Acabei de te mandar uma mensagem! 💌",
  "Olha teu direct, já está lá ✨",
  "Enviado! Confere tua DM 📲",
  "Te chamei no privado 😉",
  "Já mandei tudo no direct, aproveita! 🚀",
  "Chegou no teu direct, dá uma olhadinha 👇",
  "Mandei por mensagem pra você! 🙌",
  "Respondi no direct, confere lá 💬",
] as const;

/** Primeira sugestão que ainda não está na lista (ignora maiúsculas e espaços); "" se todas já foram usadas. */
export function nextPublicReplySuggestion(current: readonly string[]): string {
  const used = new Set(current.map((reply) => reply.trim().toLowerCase()));
  return PUBLIC_REPLY_SUGGESTIONS.find((suggestion) => !used.has(suggestion.toLowerCase())) ?? "";
}

export function compileRecipe(flowId: string, recipe: Recipe): FlowSnapshot {
  if (recipe.trigger.scope === "specific" && !recipe.trigger.mediaId.trim()) {
    throw new UserFacingError("Informe o ID da publicação específica");
  }
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
        match: recipe.trigger.matchType === "any" ? "ANY" : recipe.trigger.matchCondition || "CONTAINS",
        negativeKeywords: recipe.trigger.negativeKeywords ?? [],
        cooldownSeconds: recipe.trigger.cooldownSeconds ?? 0,
        priority: recipe.trigger.priority ?? 0,
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

  const rawButtons =
    recipe.link.buttons && recipe.link.buttons.length > 0
      ? recipe.link.buttons
      : [{ id: id.linkButton, title: recipe.link.buttonTitle, url: recipe.link.url }];

  const linkButtons = rawButtons.slice(0, 3).map((btn, idx) => ({
    id: btn.id || (idx === 0 ? id.linkButton : `${id.linkButton}-${idx}`),
    title: btn.title,
    type: "web_url" as const,
    url: btn.url,
  }));

  nodes.push({
    id: id.link,
    type: "QUESTION",
    position: { x: col(recipe.followGate.enabled ? 4 : 2), y: 0 },
    data: {
      kind: "QUESTION",
      name: "DM com o link",
      config: { text: recipe.link.text, buttons: linkButtons },
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
          notFollowingText: recipe.followGate.retryText || recipe.followGate.text,
          finalText: recipe.followGate.finalText || recipe.followGate.retryText || recipe.followGate.text,
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
    const reminderUrl = linkButtons[0]?.url || recipe.link.url;
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
          buttons: [{ id: id.reminderButton, title: recipe.reminder.buttonTitle, type: "web_url", url: reminderUrl }],
          ...(recipe.reminder.react ? { reactToLastMessage: true } : {}),
        },
      },
    });
    link(id.link, null, id.wait);
    link(id.wait, null, id.clicked);
    link(id.clicked, "no", id.reminder);

    const second = recipe.reminder.second;
    if (second.enabled) {
      // Os dois prazos contam do envio do link: a 2ª espera é só o que falta.
      const remaining = Math.max(60, second.delaySeconds - recipe.reminder.delaySeconds);
      nodes.push({
        id: id.wait2,
        type: "DELAY",
        position: { x: col(x + 3), y: 160 },
        data: { kind: "DELAY", name: null, config: { seconds: remaining } },
      });
      nodes.push({
        id: id.clicked2,
        type: "CONDITION",
        position: { x: col(x + 4), y: 160 },
        data: { kind: "CONDITION", name: "Abriu o link?", config: { rule: "link_clicked", nodeId: id.link } },
      });
      nodes.push({
        id: id.reminder2,
        type: "QUESTION",
        position: { x: col(x + 5), y: 320 },
        data: {
          kind: "QUESTION",
          name: "2º lembrete",
          config: {
            text: second.text,
            buttons: [{ id: id.reminder2Button, title: recipe.reminder.buttonTitle, type: "web_url", url: reminderUrl }],
          },
        },
      });
      link(id.reminder, null, id.wait2);
      link(id.wait2, null, id.clicked2);
      link(id.clicked2, "no", id.reminder2);
    }
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

  if (recipe.trigger.matchType !== "any" && recipe.trigger.keywords.length === 0) add("trigger", "Adicione pelo menos 1 palavra-chave");
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

  const buttonsToValidate =
    recipe.link.buttons && recipe.link.buttons.length > 0
      ? recipe.link.buttons
      : [{ title: recipe.link.buttonTitle, url: recipe.link.url }];

  for (const [idx, btn] of buttonsToValidate.entries()) {
    const label = buttonsToValidate.length > 1 ? ` (${idx + 1}º botão)` : "";
    if (!btn.title.trim()) add("link", `Dê um texto ao botão do link${label}`);
    if (!isHttps(btn.url)) add("link", `O link precisa começar com https://${label}`);
  }

  if (recipe.reminder.enabled) {
    if (!recipe.reminder.text.trim()) add("reminder", "Escreva o lembrete");
    if (!recipe.reminder.buttonTitle.trim()) add("reminder", "Dê um texto ao botão do lembrete");
    if (recipe.reminder.second.enabled) {
      if (!recipe.reminder.second.text.trim()) add("reminder", "Escreva o 2º lembrete");
      if (recipe.reminder.second.delaySeconds <= recipe.reminder.delaySeconds) {
        add("reminder", "O 2º lembrete precisa sair depois do 1º");
      }
    }
    if (recipe.reminder.delaySeconds > 23 * 3600) {
      add("reminder", "O Instagram só deixa mandar DM até 24h depois da última mensagem do contato — use no máximo 23 horas");
    }
  }
  return problems;
}
