// Validação (zod) do que o editor salva. Roda no servidor antes de gravar no banco,
// então os limites do Instagram valem mesmo se alguém burlar a tela.
import { z } from "zod";
import { KeywordMatch, NodeType, TriggerType } from "@/generated/prisma/enums";
import { LIMITS, type EditorNode } from "./types";

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9:_-]+$/, "id inválido");

const text = z.string().max(LIMITS.text, `Máximo de ${LIMITS.text} caracteres`);

// Regras "duras": formato e limites máximos. Coisas incompletas (texto vazio,
// link faltando) não bloqueiam o salvamento — aparecem como aviso (ver lint.ts).
const buttonTitle = z
  .string()
  .trim()
  .max(LIMITS.buttonTitle, `Máximo de ${LIMITS.buttonTitle} caracteres no botão`);

export const dmButtonSchema = z.object({
  id,
  title: buttonTitle,
  type: z.enum(["postback", "web_url"]),
  url: z.string().trim().max(2000).optional(),
});

export const configSchemas = {
  MESSAGE: z.object({ text }),
  QUESTION: z.object({
    text,
    buttons: z
      .array(dmButtonSchema)
      .max(LIMITS.buttons, `O Instagram aceita no máximo ${LIMITS.buttons} botões por mensagem`),
  }),
  CONDITION: z.object({
    rule: z.enum(["follows", "has_tag", "reply_contains"]),
    tagId: id.optional(),
    value: z.string().max(200).optional(),
  }),
  DELAY: z.object({ seconds: z.number().int().min(1).max(60 * 60 * 24 * 7) }),
  ADD_TAG: z.object({ tagId: id.optional() }),
  CAROUSEL: z.object({
    cards: z
      .array(z.object({ id, catalogItemId: id }))
      .max(LIMITS.cards, `O Instagram aceita no máximo ${LIMITS.cards} cards por carrossel`)
      .refine(
        (cards) => new Set(cards.map((card) => card.catalogItemId)).size === cards.length,
        "O mesmo card aparece duas vezes no carrossel",
      ),
  }),
  FOLLOW_GATE: z.object({
    text,
    buttonTitle,
    notFollowingText: text,
  }),
  NOTE: z.object({ text: z.string().max(2000) }),
  TRIGGER: z.object({
    type: z.enum(Object.values(TriggerType) as [TriggerType, ...TriggerType[]]),
    keywords: z.array(z.string().trim().min(1).max(100)).max(LIMITS.keywords),
    match: z.enum(Object.values(KeywordMatch) as [KeywordMatch, ...KeywordMatch[]]),
    mediaId: z.string().max(100).optional(),
    payload: z.string().max(1000).optional(),
    publicReply: z.string().max(LIMITS.text).optional(),
  }),
} as const;

const name = z.string().max(80).nullable();
const position = z.object({ x: z.number().finite(), y: z.number().finite() });
const kinds = [...Object.values(NodeType), "TRIGGER"] as const;

const nodeSchema = z
  .object({
    id,
    type: z.enum(kinds),
    position,
    data: z.object({ kind: z.enum(kinds), name, config: z.unknown() }),
  })
  .transform((node, ctx) => {
    if (node.data.kind !== node.type) {
      ctx.addIssue({ code: "custom", path: ["data", "kind"], message: "Tipo não confere" });
      return z.NEVER;
    }
    const config = configSchemas[node.type].safeParse(node.data.config);
    if (!config.success) {
      for (const issue of config.error.issues) {
        ctx.addIssue({ code: "custom", path: ["data", "config", ...issue.path], message: issue.message });
      }
      return z.NEVER;
    }
    return { ...node, data: { ...node.data, config: config.data } } as EditorNode;
  });

export const snapshotSchema = z.object({
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().positive() }).nullable(),
  nodes: z.array(nodeSchema).max(500),
  edges: z
    .array(z.object({ id: z.string().max(200), source: id, sourceHandle: id.nullable(), target: id }))
    .max(2000),
});

/** Primeira mensagem de erro, pronta pra mostrar na tela. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? issue.message : "Dados inválidos";
}
