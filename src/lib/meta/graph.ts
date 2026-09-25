/**
 * Cliente da Instagram Messaging API (Meta Graph API v21.0).
 *
 * Explicação em docs/etapa-3-motor.md
 *
 * Se IG_ACCESS_TOKEN estiver configurado no .env, faz chamadas reais à Meta.
 * Se não estiver configurado (ou em ambiente de teste), roda em modo MOCK inteligente,
 * permitindo testar toda a lógica do sistema sem precisar de chaves reais de imediato.
 */

export type SendMessageResult = {
  success: boolean;
  messageId?: string;
  recipientId?: string;
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

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export class InstagramGraphClient {
  private accessToken: string | null;

  constructor(accessToken?: string | null) {
    this.accessToken = accessToken ?? process.env.IG_ACCESS_TOKEN ?? null;
  }

  /**
   * Envia uma mensagem direta de texto simples no Direct.
   */
  async sendTextMessage(toIgsid: string, text: string): Promise<SendMessageResult> {
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        success: true,
        messageId: `mock_mid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        recipientId: toIgsid,
        mock: true,
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
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

    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        success: true,
        messageId: `mock_mid_btn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        recipientId: toIgsid,
        mock: true,
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: toIgsid },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text: text.slice(0, 1000),
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
   * Envia um Carrossel no Direct (Meta Generic Template).
   * Suporta de 1 a 10 cards deslizantes com imagem (1:1), título, subtítulo e botão fixo.
   */
  async sendCarouselMessage(
    toIgsid: string,
    elements: CarouselElement[]
  ): Promise<SendMessageResult> {
    if (!elements || elements.length === 0) {
      return { success: false, error: "O carrossel precisa ter pelo menos 1 card." };
    }

    const validElements = elements.slice(0, 10).map((elem, idx) => {
      const title = elem.title.slice(0, 80);
      const subtitle = elem.subtitle ? elem.subtitle.slice(0, 80) : undefined;
      const buttonTitle = elem.buttonTitle.slice(0, 20).toUpperCase();

      const button =
        elem.buttonType === "web_url" && elem.url
          ? {
              type: "web_url" as const,
              title: buttonTitle,
              url: elem.url,
            }
          : {
              type: "postback" as const,
              title: buttonTitle,
              payload: elem.payload || `card_${idx}`,
            };

      return {
        title,
        ...(subtitle ? { subtitle } : {}),
        image_url: elem.imageUrl,
        buttons: [button],
      };
    });

    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        success: true,
        messageId: `mock_mid_carousel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        recipientId: toIgsid,
        mock: true,
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
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
  async replyToComment(commentId: string, text: string): Promise<{ success: boolean; id?: string; error?: string; mock?: boolean }> {
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        success: true,
        id: `mock_reply_${Date.now()}`,
        mock: true,
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/${commentId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
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
   */
  async checkUserFollows(userIgsid: string): Promise<boolean> {
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return true; // No modo de teste, simula que segue
    }

    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${userIgsid}?fields=is_user_follow_business`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      if (!response.ok) return false;
      const data = await response.json();
      return Boolean(data?.is_user_follow_business);
    } catch {
      return false;
    }
  }

  /**
   * Busca dados do perfil do lead (username, nome, foto).
   */
  async getUserProfile(userIgsid: string): Promise<{ username?: string; name?: string; profilePicUrl?: string | null }> {
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        username: "lead_demo",
        name: "Lead Demo",
        profilePicUrl: null,
      };
    }

    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${userIgsid}?fields=name,username,profile_pic`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
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
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        valid: true,
        igUserId: "demo-ig-user",
        username: "movingfestival",
        name: "Moving Festival",
        mock: true,
      };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/me?fields=id,name,username`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          valid: false,
          error: data?.error?.message || "Token da Meta inválido ou expirado.",
        };
      }
      return {
        valid: true,
        igUserId: data.id,
        username: data.username,
        name: data.name,
      };
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err) };
    }
  }

  /**
   * Inscreve a conta nos webhooks da Meta (comments e messages) via API.
   * Equivalente ao POST /{igUserId}/subscribed_apps da documentação oficial.
   */
  async subscribeWebhooks(igUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return { success: true };
    }

    try {
      const response = await fetch(`${GRAPH_API_BASE}/${igUserId}/subscribed_apps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
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
   * Renova o token de longa duração de 60 dias (ig_refresh_token).
   */
  async refreshLongLivedToken(): Promise<{
    success: boolean;
    accessToken?: string;
    expiresIn?: number;
    error?: string;
  }> {
    if (!this.accessToken || process.env.NODE_ENV === "test") {
      return {
        success: true,
        accessToken: "mock_refreshed_token_60d",
        expiresIn: 5184000, // 60 dias em segundos
      };
    }

    try {
      const url = new URL("https://graph.instagram.com/refresh_access_token");
      url.searchParams.set("grant_type", "ig_refresh_token");
      url.searchParams.set("access_token", this.accessToken);

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
}

export const defaultGraphClient = new InstagramGraphClient();
