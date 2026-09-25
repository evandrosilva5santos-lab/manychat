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

  it("recusa 6 respostas públicas", () => {
    const r = recipe((r) => (r.trigger.publicReplies.variations = Array.from({ length: 6 }, () => "oi")));
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

  it("receita estragada no banco volta pro padrão", () => {
    expect(readRecipe("lixo")).toEqual(defaultRecipe());
    expect(readRecipe({ welcome: { text: "Oi" } }).welcome.text).toBe("Oi");
  });
});
