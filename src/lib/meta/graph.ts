/**
 * Cliente da Instagram Messaging API (Meta Graph API v21.0).
 *
 * Explicação em docs/etapa-3-motor.md
 *
 * Se IG_ACCESS_TOKEN estiver configurado no .env, faz chamadas reais à Meta.
 * Em ambiente de teste sem token, disponibiliza mocks para testes unitários.
 * Fora do ambiente de teste, sem token retorna { success: false, code: "NO_TOKEN" }.
 */

export type SendMessageResult = {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  code?: string;
  error?: string;
  mock?: boolean;
};

export type ButtonItem = {
  title: string;
  type: "postback" | "web_url";
  payload?: string;
  url?: string;
};

export type CarouselElement = {
  title: string;
  subtitle?: string;
  imageUrl: string;
  buttonTitle: string;
  buttonType: "postback" | "web_url";
  payload?: string;
  url?: string;
};

export type InstagramMediaItem = {
  id: string;
  caption?: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
  likeCount?: number;
  commentsCount?: number;
};

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export class InstagramGraphClient {
  private accessToken: string | null;

  constructor(accessToken?: string | null) {
    this.accessToken = accessToken !== undefined ? accessToken : null;
  }

  private getToken(): string | null {
    return this.accessToken ?? process.env.IG_ACCESS_TOKEN ?? null;
  }

  /**
   * Envia uma mensagem direta de texto simples no Direct.
   */
  async sendTextMessage(toIgsid: string, text: string): Promise<SendMessageResult> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          messageId: `test_mid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          recipientId: toIgsid,
          mock: true,
        };
      }
      return {
        success: false,
        code: "NO_TOKEN",
        error: "Token de acesso do Instagram não configurado.",
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: toIgsid },
          message: { text: text.slice(0, 1000) }, // Limite do Instagram: 1000 chars
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || "Erro desconhecido na Graph API",
        };
      }

      return {
        success: true,
        messageId: data.message_id,
        recipientId: data.recipient_id,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Envia mensagem no Direct com Botões Fixos (button template).
   *
   * Regras da Meta:
   * - No máximo 3 botões
   * - Cada botão com até 20 caracteres
   */
  async sendButtonMessage(
    toIgsid: string,
    text: string,
    buttons: ButtonItem[]
  ): Promise<SendMessageResult> {
    const validButtons = buttons.slice(0, 3).map((b) => {
      const title = b.title.slice(0, 20).toUpperCase();
      if (b.type === "web_url" && b.url) {
        return { type: "web_url", title, url: b.url };
      }
      return { type: "postback", title, payload: b.payload || `btn_${title}` };
    });

    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          messageId: `test_mid_btn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          recipientId: toIgsid,
          mock: true,
        };
      }
      return {
        success: false,
        code: "NO_TOKEN",
        error: "Token de acesso do Instagram não configurado.",
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: toIgsid },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text: text.slice(0, 640),
                buttons: validButtons,
              },
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || "Erro desconhecido ao enviar button template",
        };
      }

      return {
        success: true,
        messageId: data.message_id,
        recipientId: data.recipient_id,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Envia um Carrossel no Direct (generic template).
   *
   * Regras da Meta:
   * - No máximo 10 cards (elementos)
   * - Cada card tem imagem, título e 1 botão
   */
  async sendCarouselMessage(
    toIgsid: string,
    elements: CarouselElement[]
  ): Promise<SendMessageResult> {
    if (!elements || elements.length === 0) {
      return {
        success: false,
        error: "Carrossel precisa ter pelo menos 1 card (máximo 10)",
      };
    }

    const validElements = elements.slice(0, 10).map((elem) => {
      const title = elem.title.slice(0, 80);
      const subtitle = elem.subtitle ? elem.subtitle.slice(0, 80) : undefined;
      const btnTitle = elem.buttonTitle.slice(0, 20).toUpperCase();

      const button =
        elem.buttonType === "web_url" && elem.url
          ? { type: "web_url", title: btnTitle, url: elem.url }
          : { type: "postback", title: btnTitle, payload: elem.payload || `card_${btnTitle}` };

      return {
        title,
        ...(subtitle ? { subtitle } : {}),
        image_url: elem.imageUrl,
        buttons: [button],
      };
    });

    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          messageId: `test_mid_carousel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          recipientId: toIgsid,
          mock: true,
        };
      }
      return {
        success: false,
        code: "NO_TOKEN",
        error: "Token de acesso do Instagram não configurado.",
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: toIgsid },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements: validElements,
              },
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || "Erro desconhecido ao enviar generic template (carrossel)",
        };
      }

      return {
        success: true,
        messageId: data.message_id,
        recipientId: data.recipient_id,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Responde publicamente a um comentário num post ou Reel.
   */
  async replyToComment(commentId: string, text: string): Promise<{ success: boolean; id?: string; code?: string; error?: string; mock?: boolean }> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          id: `mock_reply_${Date.now()}`,
          mock: true,
        };
      }
      return {
        success: false,
        code: "NO_TOKEN",
        error: "Token de acesso do Instagram não configurado.",
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/${commentId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || "Erro ao responder comentário público",
        };
      }

      return { success: true, id: data.id };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Consulta se o usuário segue a conta (Follow-check da Meta).
   *
   * Tri-estado: "unknown" significa "não sabemos" (Meta fora do ar, sem
   * token, resposta inválida) — o chamador NÃO deve punir o lead nem
   * cachar "não segue" nesse caso. Só uma resposta limpa da Meta vira
   * "yes" ou "no".
   */
  async checkUserFollows(userIgsid: string): Promise<"yes" | "no" | "unknown"> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return "yes"; // No modo de teste sem token, simula que segue
      }
      return "unknown";
    }

    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${userIgsid}?fields=is_user_follow_business`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) return "unknown";
      const data = await response.json();
      if (typeof data?.is_user_follow_business !== "boolean") return "unknown";
      return data.is_user_follow_business ? "yes" : "no";
    } catch {
      return "unknown";
    }
  }

  /**
   * Busca dados do perfil do lead (username, nome, foto).
   */
  async getUserProfile(userIgsid: string): Promise<{ username?: string; name?: string; profilePicUrl?: string | null }> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          username: "lead_demo",
          name: "Lead Demo",
          profilePicUrl: null,
        };
      }
      return {};
    }

    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${userIgsid}?fields=name,username,profile_pic`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) return {};
      const data = await response.json();
      return {
        username: data.username,
        name: data.name,
        profilePicUrl: data.profile_pic,
      };
    } catch {
      return {};
    }
  }

  /**
   * Valida a conexão atual fazendo uma chamada de teste na Graph API da Meta.
   */
  async validateConnection(): Promise<{
    valid: boolean;
    igUserId?: string;
    username?: string;
    name?: string;
    error?: string;
    mock?: boolean;
  }> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          valid: true,
          igUserId: "demo-ig-user",
          username: "instagram_business",
          name: "Instagram Business",
          mock: true,
        };
      }
      return {
        valid: false,
        error: "Nenhum token configurado no ambiente.",
      };
    }

    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/me?fields=id,name,instagram_business_account{id,username,name}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        return {
          valid: false,
          error: data?.error?.message || "Token da Meta inválido ou expirado.",
        };
      }

      const igAccount = data.instagram_business_account;
      if (!igAccount) {
        return {
          valid: false,
          error:
            "A página do Facebook não tem uma conta profissional do Instagram vinculada.",
        };
      }

      return {
        valid: true,
        igUserId: igAccount.id,
        username: igAccount.username,
        name: igAccount.name,
      };
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err) };
    }
  }

  /**
   * Renova o token de acesso de 60 dias (Long-Lived Token).
   */
  async renewToken(): Promise<{
    success: boolean;
    accessToken?: string;
    expiresIn?: number;
    error?: string;
  }> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          accessToken: "mock_refreshed_token_60d",
          expiresIn: 5184000, // 60 dias em segundos
        };
      }
      return {
        success: false,
        error: "Nenhum token configurado para renovar.",
      };
    }

    try {
      const url = new URL("https://graph.instagram.com/refresh_access_token");
      url.searchParams.set("grant_type", "ig_refresh_token");
      url.searchParams.set("access_token", token);

      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || "Falha ao renovar token de 60 dias.",
        };
      }

      return {
        success: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Alias de compatibilidade para renewToken.
   */
  async refreshLongLivedToken() {
    return this.renewToken();
  }

  /**
   * Inscreve a conta nos webhooks da Meta (comments e messages) via API.
   * Equivalente ao POST /{igUserId}/subscribed_apps da documentação oficial.
   */
  async subscribeWebhooks(igUserId: string): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return { success: true };
      }
      return {
        success: false,
        error: "Token de acesso do Instagram não configurado.",
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/${igUserId}/subscribed_apps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscribed_fields: ["comments", "messages"],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || "Falha ao inscrever campos do webhook na Meta.",
        };
      }
      return { success: Boolean(data.success) };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Busca as últimas mídias (posts/reels) da conta conectada
   */
  async getUserMedia(igUserId?: string, limit = 25): Promise<{
    success: boolean;
    data: InstagramMediaItem[];
    code?: string;
    mock?: boolean;
    error?: string;
  }> {
    const token = this.getToken();
    if (!token) {
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          mock: true,
          data: [
            {
              id: "mock_media_1",
              caption: "Lançamento da nova integração! Comente EU QUERO para receber o link.",
              mediaType: "IMAGE",
              mediaUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
              permalink: "https://www.instagram.com/p/mock1/",
              timestamp: new Date().toISOString(),
              likeCount: 154,
              commentsCount: 23,
            },
            {
              id: "mock_media_2",
              caption: "3 dicas para crescer no Instagram.",
              mediaType: "VIDEO",
              thumbnailUrl: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80",
              permalink: "https://www.instagram.com/reel/mock2/",
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              likeCount: 890,
              commentsCount: 112,
            },
            {
              id: "mock_media_3",
              caption: "Carrossel de novidades",
              mediaType: "CAROUSEL_ALBUM",
              mediaUrl: "https://images.unsplash.com/photo-1611162618071-b39a2ec055ce?w=800&q=80",
              permalink: "https://www.instagram.com/p/mock3/",
              timestamp: new Date(Date.now() - 172800000).toISOString(),
              likeCount: 45,
              commentsCount: 5,
            },
          ],
        };
      }
      return {
        success: false,
        code: "NO_TOKEN",
        data: [],
        error: "Token de acesso do Instagram não configurado.",
      };
    }

    const targetUserId = igUserId ?? "me";

    try {
      const qs = new URLSearchParams({
        fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
        limit: limit.toString(),
      });

      const response = await fetch(`${GRAPH_API_BASE}/${targetUserId}/media?${qs.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: [],
          error: data?.error?.message || "Erro ao buscar mídias do Instagram",
        };
      }

      const mediaItems: InstagramMediaItem[] = (data.data || []).map((item: any) => ({
        id: item.id,
        caption: item.caption,
        mediaType: item.media_type,
        mediaUrl: item.media_url,
        thumbnailUrl: item.thumbnail_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
        likeCount: item.like_count,
        commentsCount: item.comments_count,
      }));

      return {
        success: true,
        data: mediaItems,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || String(err),
      };
    }
  }
}

export const defaultGraphClient = new InstagramGraphClient();
