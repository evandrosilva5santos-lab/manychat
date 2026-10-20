// Validação das entradas do Autoposter (Server Actions são endpoints públicos).
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { CAPTION_MAX, DATE_FORMATS, FORMATS, MAX_MEDIA, TIMEZONES, type MediaType } from "./constants";
import { isYmd } from "./dates";
import { isAcceptableMediaUrl, isVideoUrl } from "./media";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

export const scheduleSchema = z
  .object({
    date: z.string().refine(isYmd, "Data inválida."),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
  })
  .nullable();

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao projeto.").max(80, "Nome muito longo."),
  timezone: z.enum(TIMEZONES.map((zone) => zone.id) as [string, ...string[]]),
  dateFormat: z.enum(DATE_FORMATS),
  accountIds: z.array(idSchema).max(20),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const publishRulesSchema = z.object({
  publishOnlyIfApproved: z.boolean(),
  retryOnFailure: z.boolean(),
});

export const postInputSchema = z
  .object({
    projectId: idSchema,
    targets: z
      .array(z.object({ accountId: idSchema, format: z.enum(FORMATS) }))
      .min(1, "Escolha pelo menos uma rede e um formato.")
      .max(20),
    title: optionalText(120),
    caption: z.string().max(CAPTION_MAX, `A legenda passa de ${CAPTION_MAX} caracteres.`),
    firstComment: optionalText(CAPTION_MAX),
    mediaUrls: z
      .array(z.string().refine(isAcceptableMediaUrl, "Link de mídia inválido."))
      .min(1, "Adicione pelo menos uma imagem ou vídeo.")
      .max(MAX_MEDIA, `No máximo ${MAX_MEDIA} mídias.`),
    schedule: scheduleSchema,
    sendToReview: z.boolean(),
    reviewGroupId: idSchema.nullish(),
    newReviewGroupName: optionalText(80),
    publishOnlyIfApproved: z.boolean(),
    categoryId: idSchema.nullish(),
  })
  .superRefine((input, ctx) => {
    const formats = new Set(input.targets.map((target) => target.format));
    const videos = input.mediaUrls.filter(isVideoUrl).length;
    const issue = (message: string) => ctx.addIssue({ code: "custom", message, path: ["mediaUrls"] });
    if (formats.has("reels") && (input.mediaUrls.length !== 1 || videos !== 1)) issue("Reels precisa de exatamente um vídeo.");
    if (formats.has("story") && input.mediaUrls.length !== 1) issue("Story precisa de exatamente uma imagem ou vídeo.");
    if (input.sendToReview && !input.reviewGroupId && !input.newReviewGroupName) {
      ctx.addIssue({ code: "custom", message: "Escolha ou crie um grupo de aprovação.", path: ["reviewGroupId"] });
    }
  });
export type PostInput = z.infer<typeof postInputSchema>;

export function mediaTypeFor(urls: string[]): MediaType {
  if (urls.length > 1) return "CAROUSEL";
  return urls[0] && isVideoUrl(urls[0]) ? "VIDEO" : "IMAGE";
}

export const reviewerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
});

/** Revisão do cliente por post: arte e legenda separadas; a legenda pode ser reescrita. */
export const decisionsSchema = z
  .array(
    z.object({
      postId: idSchema,
      media: z.enum(["approved", "needs_adjustment"]),
      mediaComment: optionalText(1000),
      caption: z.enum(["approved", "needs_adjustment", "edited"]),
      captionComment: optionalText(1000),
      editedCaption: z.string().max(CAPTION_MAX, `A legenda passa de ${CAPTION_MAX} caracteres.`).nullish(),
    }),
  )
  .min(1, "Revise pelo menos um post.")
  .max(200)
  .superRefine((items, ctx) => {
    items.forEach((item, index) => {
      if (item.media === "needs_adjustment" && !item.mediaComment) {
        ctx.addIssue({ code: "custom", message: "Explique o ajuste que precisa ser feito na arte.", path: [index, "mediaComment"] });
      }
      if (item.caption === "needs_adjustment" && !item.captionComment) {
        ctx.addIssue({ code: "custom", message: "Explique o ajuste que precisa ser feito na legenda.", path: [index, "captionComment"] });
      }
      if (item.caption === "edited" && !item.editedCaption?.trim()) {
        ctx.addIssue({ code: "custom", message: "A legenda editada não pode ficar vazia.", path: [index, "editedCaption"] });
      }
    });
  });

export const nameSchema = z.string().trim().min(1, "Informe um nome.").max(80);
export const hashtagsSchema = z
  .string()
  .trim()
  .min(1, "Informe as hashtags.")
  .max(2000)
  .transform((value) =>
    value
      .split(/[,\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .join(" "),
  );
export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida.");
