import { z } from "zod";

// Pinned supported version; upgrade only after confirming the Meta changelog.
export const GRAPH_API_VERSION = "v21.0";
// Instagram Login fala com graph.instagram.com; token de Página (Facebook Login) só com graph.facebook.com.
export type GraphProvider = "instagram" | "facebook";
export const graphBaseFor = (provider: GraphProvider = "instagram") => `https://graph.${provider}.com/${GRAPH_API_VERSION}`;
export const GRAPH_API_BASE = graphBaseFor("instagram");
export type GraphResult = { success: boolean; id?: string; code?: number; subcode?: number; retryable: boolean; error?: string; mock?: boolean };
export type SendMessageResult = GraphResult & { messageId?: string; recipientId?: string };
export type SendContext = { commentId?: string };
export type ButtonItem = { title: string; type: "postback" | "web_url"; payload?: string; url?: string };
export type CarouselElement = { title: string; subtitle?: string; imageUrl: string; buttonTitle: string; buttonType: "postback" | "web_url"; payload?: string; url?: string };
export type InstagramMediaItem = { id: string; caption?: string; mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"; mediaUrl?: string; thumbnailUrl?: string; permalink?: string; timestamp?: string; likeCount?: number; commentsCount?: number };
const failure = (error: string, retryable = false): GraphResult => ({ success: false, retryable, error });
const identifier = z.string().regex(/^[A-Za-z0-9_-]+$/);
const webUrl = z.string().url().refine(value => ["http:", "https:"].includes(new URL(value).protocol));
const button = z.discriminatedUnion("type", [
  z.object({ type: z.literal("postback"), title: z.string().min(1).max(20), payload: z.string().min(1).max(1000) }),
  z.object({ type: z.literal("web_url"), title: z.string().min(1).max(20), url: webUrl }),
]);
const messageResponse = z.object({ message_id: z.string().min(1), recipient_id: z.string().optional() });
const metaError = z.object({ error: z.object({ code: z.number().optional(), error_subcode: z.number().optional(), is_transient: z.boolean().optional() }) });
export class GraphApiError extends Error {
  constructor(public readonly result: GraphResult) { super(result.error ?? "Falha na API do Instagram."); this.name = "GraphApiError"; }
}

export class InstagramGraphClient {
  private readonly accessToken: string | null;
  private readonly onExpired?: () => Promise<void>;
  private readonly isMock: boolean;
  private readonly provider: GraphProvider;
  constructor(
    accessToken?: string | null,
    optionsOrExpired?: (() => Promise<void>) | { onExpired?: () => Promise<void>; mock?: boolean; provider?: GraphProvider },
    mock?: boolean
  ) {
    this.accessToken = accessToken === undefined ? process.env.IG_ACCESS_TOKEN ?? null : accessToken;
    const isMockFromOpts = typeof optionsOrExpired === "object" ? optionsOrExpired?.mock : mock;
    this.isMock = Boolean(isMockFromOpts || accessToken === "mock");
    this.onExpired = typeof optionsOrExpired === "function" ? optionsOrExpired : optionsOrExpired?.onExpired;
    this.provider = (typeof optionsOrExpired === "object" ? optionsOrExpired?.provider : undefined) ?? "instagram";
  }
  private async request<T>(path: string, schema: z.ZodType<T>, body?: unknown, query?: Record<string, string>, refresh = false): Promise<GraphResult & { value?: T }> {
    if (!this.accessToken) return failure("Token do Instagram não configurado para esta conta.");
    try {
      const url = new URL(refresh ? "https://graph.instagram.com/refresh_access_token" : `${graphBaseFor(this.provider)}/${path}`);
      for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
      // Token refresh is the sole unversioned endpoint and requires its token parameter.
      if (refresh) url.searchParams.set("access_token", this.accessToken);
      const response = await fetch(url.toString(), {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error",
      });
      let data: unknown;
      try { data = await response.json(); } catch { return failure("Resposta inválida da API do Instagram.", response.status === 429 || response.status >= 500); }
      const parsedError = metaError.safeParse(data);
      if (!response.ok || parsedError.success) {
        const { code, error_subcode: subcode, is_transient } = parsedError.success ? parsedError.data.error : { code: undefined, error_subcode: undefined, is_transient: false };
        let error = "A API do Instagram recusou a operação.";
        if (code === 190) {
          error = "Token expirado. Reconecte a conta do Instagram.";
          try { await this.onExpired?.(); } catch { error = "Token expirado; não foi possível atualizar o estado da conta."; }
        } else if ([10, 2018278, 2534022].includes(code ?? 0) || [2018278, 2534022].includes(subcode ?? 0)) error = "Envio fora da janela permitida ou sem permissão de mensagens.";
        const retryable = code !== 190 && (Boolean(is_transient) || [4, 613, 32].includes(code ?? 0) || response.status === 429 || response.status >= 500);
        return { success: false, code, subcode, retryable, error };
      }
      const parsed = schema.safeParse(data);
      return parsed.success ? { success: true, retryable: false, value: parsed.data } : failure("Resposta inválida da API do Instagram.");
    } catch { return failure("Falha de conexão ou tempo limite da API do Instagram.", true); }
  }
  private async send(to: string, message: unknown, context?: SendContext): Promise<SendMessageResult> {
    if (!identifier.safeParse(context?.commentId ?? to).success) return failure("Destinatário inválido.");
    const result = await this.request("me/messages", messageResponse, { recipient: context?.commentId ? { comment_id: context.commentId } : { id: to }, message });
    const { value, ...status } = result;
    return { ...status, ...(value ? { id: value.message_id, messageId: value.message_id, recipientId: value.recipient_id } : {}) };
  }
  async sendTextMessage(to: string, text: string, context?: SendContext): Promise<SendMessageResult> {
    if (!text.trim() || new TextEncoder().encode(text).length > 1000) return failure("Mensagem deve conter de 1 a 1000 bytes.");
    if (this.isMock) {
      const mid = `mock_mid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return { success: true, retryable: false, id: mid, messageId: mid, recipientId: to, mock: true };
    }
    return this.send(to, { text }, context);
  }
  async sendButtonMessage(to: string, text: string, buttons: ButtonItem[], context?: SendContext): Promise<SendMessageResult> {
    if (this.isMock) {
      const sanitized = buttons.slice(0, 3).map(b => ({
        ...b,
        title: b.title.slice(0, 20).toUpperCase(),
      }));
      const mid = `mock_mid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return { success: true, retryable: false, id: mid, messageId: mid, recipientId: to, mock: true };
    }
    const parsed = z.array(button).min(1).max(3).safeParse(buttons);
    if (!text.trim() || text.length > 640 || !parsed.success) return failure("Template exige texto de até 640 caracteres e 1 a 3 botões válidos de até 20 caracteres.");
    return this.send(to, { attachment: { type: "template", payload: { template_type: "button", text, buttons: parsed.data } } }, context);
  }
  async sendCarouselMessage(to: string, elements: CarouselElement[], context?: SendContext): Promise<SendMessageResult> {
    if (!elements || elements.length === 0) {
      return failure("Carrossel precisa ter pelo menos 1 card (de 1 a 10).");
    }
    if (this.isMock) {
      const mid = `mock_mid_carousel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return { success: true, retryable: false, id: mid, messageId: mid, recipientId: to, mock: true };
    }
    const parsed = z.array(z.object({ title: z.string().min(1).max(80), subtitle: z.string().max(80).optional(), imageUrl: webUrl, buttonTitle: z.string(), buttonType: z.enum(["postback", "web_url"]), payload: z.string().optional(), url: z.string().optional() })).min(1).max(10).safeParse(elements);
    if (!parsed.success) return failure("Carrossel exige de 1 a 10 cards válidos e precisa ter pelo menos 1 card.");
    const cards = [];
    for (const element of parsed.data) {
      const parsedButton = button.safeParse({ title: element.buttonTitle, type: element.buttonType, payload: element.payload, url: element.url });
      if (!parsedButton.success) return failure("Botão inválido no carrossel.");
      cards.push({ title: element.title, subtitle: element.subtitle, image_url: element.imageUrl, buttons: [parsedButton.data] });
    }
    return this.send(to, { attachment: { type: "template", payload: { template_type: "generic", elements: cards } } }, context);
  }
  async replyToComment(commentId: string, text: string): Promise<GraphResult> {
    if (!identifier.safeParse(commentId).success || !text.trim()) return failure("Comentário ou texto inválido.");
    if (this.isMock) {
      const id = `mock_reply_${Date.now()}`;
      return { success: true, retryable: false, id, mock: true };
    }
    const { value, ...result } = await this.request(`${commentId}/replies`, z.object({ id: z.string().min(1) }), { message: text });
    return { ...result, id: value?.id };
  }
  async checkUserFollows(userIgsid: string): Promise<boolean> {
    if (!identifier.safeParse(userIgsid).success) throw new GraphApiError(failure("Identificador inválido."));
    const result = await this.request(userIgsid, z.object({ is_user_follow_business: z.boolean() }), undefined, { fields: "is_user_follow_business" });
    if (!result.value) throw new GraphApiError(result);
    return result.value.is_user_follow_business;
  }
  async getUserProfile(userIgsid: string): Promise<{ username?: string; name?: string; profilePicUrl?: string | null }> {
    if (!identifier.safeParse(userIgsid).success) throw new GraphApiError(failure("Identificador inválido."));
    const result = await this.request(userIgsid, z.object({ username: z.string().optional(), name: z.string().optional(), profile_pic: z.string().nullable().optional() }), undefined, { fields: "name,username,profile_pic" });
    if (!result.value) throw new GraphApiError(result);
    return { username: result.value.username, name: result.value.name, profilePicUrl: result.value.profile_pic };
  }
  async validateConnection() {
    if (this.provider === "facebook") {
      // Token de Página: `me` é a Página; a identidade vem da conta do Instagram vinculada.
      const { value, ...result } = await this.request("me", z.object({ instagram_business_account: z.object({ id: z.string().min(1), username: z.string().min(1), name: z.string().optional() }) }), undefined, { fields: "instagram_business_account{id,username,name}" });
      const ig = value?.instagram_business_account;
      return { ...result, valid: result.success, igUserId: ig?.id, username: ig?.username, name: ig?.name };
    }
    const { value, ...result } = await this.request("me", z.object({ user_id: z.string().min(1), username: z.string().min(1), name: z.string().optional() }), undefined, { fields: "user_id,username,name" });
    return { ...result, valid: result.success, igUserId: value?.user_id, username: value?.username, name: value?.name };
  }
  async subscribeWebhooks(_igUserId?: string): Promise<GraphResult> {
    const subscribed_fields = this.provider === "facebook" ? ["messages", "messaging_postbacks", "feed"] : ["comments", "messages", "messaging_postbacks"];
    const result = await this.request("me/subscribed_apps", z.object({ success: z.literal(true) }), { subscribed_fields });
    return { success: result.success, retryable: result.retryable, code: result.code, subcode: result.subcode, error: result.error };
  }
  async refreshLongLivedToken() {
    if (this.provider === "facebook") return { ...failure("Token de Página do Facebook não precisa de renovação."), accessToken: undefined, expiresIn: undefined };
    const { value, ...result } = await this.request("", z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }), undefined, { grant_type: "ig_refresh_token" }, true);
    return { ...result, accessToken: value?.access_token, expiresIn: value?.expires_in };
  }
  async getUserMedia(igUserId = "me", limit = 25): Promise<GraphResult & { data: InstagramMediaItem[] }> {
    if (!identifier.safeParse(igUserId).success || !Number.isInteger(limit) || limit < 1 || limit > 100) return { ...failure("Conta ou limite de mídias inválido."), data: [] };
    const schema = z.object({ data: z.array(z.object({ id: z.string(), caption: z.string().optional(), media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]), media_url: z.string().optional(), thumbnail_url: z.string().optional(), permalink: z.string().optional(), timestamp: z.string().optional(), like_count: z.number().optional(), comments_count: z.number().optional() })) });
    const { value, ...result } = await this.request(`${igUserId}/media`, schema, undefined, { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: String(limit) });
    return { ...result, data: value?.data.map(item => ({ id: item.id, caption: item.caption, mediaType: item.media_type, mediaUrl: item.media_url, thumbnailUrl: item.thumbnail_url, permalink: item.permalink, timestamp: item.timestamp, likeCount: item.like_count, commentsCount: item.comments_count })) ?? [] };
  }
}
export const defaultGraphClient = new InstagramGraphClient();
