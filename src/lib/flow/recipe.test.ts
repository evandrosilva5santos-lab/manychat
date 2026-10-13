import { describe, expect, it } from "vitest";
import { normalizeEdges } from "./convert";
import { compileRecipe, defaultRecipe, lintRecipe, readRecipe, recipeSchema, type Recipe } from "./recipe";
import { snapshotSchema } from "./schema";

const FLOW = "cmflow0000000000000000000";

function recipe(patch: (r: Recipe) => void = () => {}): Recipe {
  const r = defaultRecipe();
  r.trigger.keywords = ["casamento"];
  r.link.url = "https://wa.me/5551999999999";
  patch(r);
  return r;
}

const types = (r: Recipe) => compileRecipe(FLOW, r).nodes.map((node) => node.type);
const short = (id: string | null) => (id ?? "-").replace(`${FLOW}-`, "");
const pairs = (r: Recipe) =>
  compileRecipe(FLOW, r).edges.map((edge) => `${short(edge.source)}:${short(edge.sourceHandle)}>${short(edge.target)}`);

describe("compileRecipe", () => {
  it("com 'pedir pra seguir': boas-vindas → segue? → link / pedir pra seguir → link", () => {
    expect(types(recipe())).toEqual(["TRIGGER", "QUESTION", "QUESTION", "CONDITION", "FOLLOW_GATE"]);
    expect(pairs(recipe())).toEqual([
      "trigger:t:->welcome",
      "welcome:welcome-btn>follows",
      "follows:yes>link",
      "follows:no>gate",
      "gate:unlock>link",
    ]);
  });

  it("sem 'pedir pra seguir': o botão da boas-vindas vai direto pro link", () => {
    const r = recipe((r) => (r.followGate.enabled = false));
    expect(types(r)).toEqual(["TRIGGER", "QUESTION", "QUESTION"]);
    expect(pairs(r)).toContain("welcome:welcome-btn>link");
  });

  it("com lembrete: link → espera → abriu o link? → não → lembrete", () => {
    const r = recipe((r) => (r.reminder.enabled = true));
    expect(pairs(r)).toEqual(
      expect.arrayContaining(["link:->wait", "wait:->clicked", "clicked:no>reminder"]),
    );
    const clicked = compileRecipe(FLOW, r).nodes.find((node) => node.id === `${FLOW}-clicked`);
    expect(clicked?.data.config).toEqual({ rule: "link_clicked", nodeId: `${FLOW}-link` });
  });

  it("gera sempre os mesmos ids", () => {
    const ids = (r: Recipe) => compileRecipe(FLOW, r).nodes.map((node) => node.id);
    const changed = recipe((r) => (r.welcome.text = "outro texto"));
    expect(ids(recipe())).toEqual(ids(changed));
  });

  it("o resultado passa na validação do servidor e nenhuma linha é descartada", () => {
    const snapshot = compileRecipe(FLOW, recipe((r) => (r.reminder.enabled = true)));
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(normalizeEdges(snapshot.nodes, snapshot.edges, () => undefined)).toHaveLength(snapshot.edges.length);
  });

  it("respostas públicas desligadas não vão pro gatilho", () => {
    const r = recipe((r) => (r.trigger.publicReplies.enabled = false));
    const trigger = compileRecipe(FLOW, r).nodes[0];
    expect(trigger.data.kind === "TRIGGER" && trigger.data.config.publicReplies).toEqual([]);
  });
});

describe("limites da receita", () => {
  it("recusa 16 palavras-chave", () => {
    const r = recipe((r) => (r.trigger.keywords = Array.from({ length: 16 }, (_, i) => `p${i}`)));
    expect(recipeSchema.safeParse(r).success).toBe(false);
  });

  it("recusa 11 respostas públicas (limite de 10)", () => {
    const r = recipe((r) => (r.trigger.publicReplies.variations = Array.from({ length: 11 }, () => "oi")));
    expect(recipeSchema.safeParse(r).success).toBe(false);
  });

  it("recusa botão com 21 caracteres", () => {
    const r = recipe((r) => (r.link.buttonTitle = "X".repeat(21)));
    expect(recipeSchema.safeParse(r).success).toBe(false);
  });

  it("avisa link sem https e lembrete maior que 23h", () => {
    const r = recipe((r) => {
      r.link.url = "wa.me/555";
      r.reminder.enabled = true;
      r.reminder.delaySeconds = 48 * 3600;
    });
    const sections = lintRecipe(r).map((problem) => problem.section);
    expect(sections).toContain("link");
    expect(sections).toContain("reminder");
    expect(lintRecipe(recipe())).toEqual([]);
  });

  it("aceita até 3 botões na DM e compila todos", () => {
    const r = recipe((r) => {
      r.link.buttons = [
        { title: "LINK 1", url: "https://example.com/1" },
        { title: "LINK 2", url: "https://example.com/2" },
        { title: "LINK 3", url: "https://example.com/3" },
      ];
    });
    expect(recipeSchema.safeParse(r).success).toBe(true);
    const snapshot = compileRecipe(FLOW, r);
    const linkNode = snapshot.nodes.find((n) => n.id === `${FLOW}-link`);
    expect(linkNode?.data.kind === "QUESTION" && linkNode.data.config.buttons).toHaveLength(3);
  });

  it("recusa mais de 3 botões na DM (limite da Meta)", () => {
    const r = recipe((r) => {
      r.link.buttons = [
        { title: "LINK 1", url: "https://example.com/1" },
        { title: "LINK 2", url: "https://example.com/2" },
        { title: "LINK 3", url: "https://example.com/3" },
        { title: "LINK 4", url: "https://example.com/4" },
      ];
    });
    expect(recipeSchema.safeParse(r).success).toBe(false);
  });

  it("receita estragada no banco volta pro padrão", () => {
    expect(readRecipe("lixo")).toEqual(defaultRecipe());
    expect(readRecipe({ welcome: { text: "Oi" } }).welcome.text).toBe("Oi");
  });
});

describe("trigger persistence and Meta limits", () => {
  it("preserves ANY, negatives, cooldown and priority through the save plan", async () => {
    const { toSavePlan } = await import("./convert");
    const r = recipe((r) => Object.assign(r.trigger, { matchType: "any", keywords: [], negativeKeywords: ["não"], cooldownSeconds: 60, priority: 3 }));
    expect(lintRecipe(r)).toEqual([]);
    const parsed = snapshotSchema.parse(compileRecipe(FLOW, recipeSchema.parse(r)));
    expect(toSavePlan(parsed, () => undefined).triggers[0]).toMatchObject({ match: "ANY", negativeKeywords: ["não"], cooldownSeconds: 60, priority: 3 });
  });
  it("rejects a specific post without media and never compiles it as global", () => {
    const r = recipe((r) => { r.trigger.scope = "specific"; r.trigger.mediaId = ""; });
    expect(recipeSchema.safeParse(r).success).toBe(false);
    expect(lintRecipe(r).some((p) => p.section === "trigger")).toBe(true);
    expect(() => compileRecipe(FLOW, r)).toThrow();
  });
  it("rejects delays beyond 23h and template texts beyond 640", () => {
    expect(recipeSchema.safeParse(recipe((r) => { r.reminder.delaySeconds = 23 * 3600; })).success).toBe(true);
    expect(recipeSchema.safeParse(recipe((r) => { r.reminder.delaySeconds = 23 * 3600 + 1; })).success).toBe(false);
    expect(recipeSchema.safeParse(recipe((r) => { r.link.text = "x".repeat(641); })).success).toBe(false);
  });
});

describe("recipeSchema × dados reais do post escolhido", () => {
  const withPost = (caption: string, url = "https://scontent.cdninstagram.com/v/t51.2885-15/foto.jpg") => {
    const base = defaultRecipe();
    return { ...base, trigger: { ...base.trigger, scope: "specific" as const, mediaId: "17900000000000001", mediaUrl: url, mediaCaption: caption } };
  };

  it("aceita legenda longa até o limite do Instagram (2.200) — antes, acima de 1.000 nada salvava", () => {
    expect(recipeSchema.safeParse(withPost("a".repeat(1500))).success).toBe(true);
    expect(recipeSchema.safeParse(withPost("a".repeat(2200))).success).toBe(true);
    expect(recipeSchema.safeParse(withPost("a".repeat(2201))).success).toBe(false);
  });

  it("aceita URL de CDN maior que 2.000 caracteres", () => {
    expect(recipeSchema.safeParse(withPost("legenda", `https://scontent.cdninstagram.com/${"x".repeat(2500)}`)).success).toBe(true);
  });
});

describe("portão de seguidor com sequência de mensagens", () => {
  it("compila pedido, 'ainda não segue' e mensagem final no FOLLOW_GATE", () => {
    const base = defaultRecipe();
    const recipe = { ...base, followGate: { ...base.followGate, text: "1º", retryText: "2º", finalText: "3º" } };
    const gate = compileRecipe("cflow00000000000000000000", recipe).nodes.find((node) => node.type === "FOLLOW_GATE");
    expect(gate?.data.config).toMatchObject({ text: "1º", notFollowingText: "2º", finalText: "3º" });
  });

  it("receita antiga sem os textos novos ganha os padrões ao ser lida", () => {
    const old = { ...defaultRecipe(), followGate: { enabled: true, text: "Segue a gente", buttonTitle: "JÁ SEGUI" } };
    const read = readRecipe(old);
    expect(read.followGate.text).toBe("Segue a gente");
    expect(read.followGate.retryText.length).toBeGreaterThan(0);
    expect(read.followGate.finalText.length).toBeGreaterThan(0);
  });
});

describe("respostas públicas no comentário", () => {
  const withReplies = (variations: string[]) => {
    const base = defaultRecipe();
    return { ...base, trigger: { ...base.trigger, publicReplies: { enabled: true, variations } } };
  };

  it("aceita até 10 respostas e recusa a 11ª", () => {
    expect(recipeSchema.safeParse(withReplies(Array.from({ length: 10 }, (_, i) => `Resposta ${i}`))).success).toBe(true);
    expect(recipeSchema.safeParse(withReplies(Array.from({ length: 11 }, (_, i) => `Resposta ${i}`))).success).toBe(false);
  });

  it("campo ainda vazio não trava o salvamento e não vai para o gatilho", () => {
    const recipe = withReplies(["Te mandei no direct!", "", "Olha tua DM 👀"]);
    expect(recipeSchema.safeParse(recipe).success).toBe(true);
    const trigger = compileRecipe("cflow00000000000000000000", recipe).nodes.find((node) => node.type === "TRIGGER");
    expect((trigger?.data.config as { publicReplies: string[] }).publicReplies).toEqual(["Te mandei no direct!", "Olha tua DM 👀"]);
  });
});
