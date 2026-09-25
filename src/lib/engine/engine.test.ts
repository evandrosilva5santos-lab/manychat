import { describe, expect, it } from "vitest";
import {
  verifyWebhookChallenge,
  verifyMetaHmacSignature,
  parseInstagramWebhookPayload,
} from "@/lib/meta/webhook";
import { matchesKeyword } from "./matcher";
import { InstagramGraphClient } from "@/lib/meta/graph";
import { dmButtonSchema, configSchemas } from "@/lib/flow/schema";
import { outputHandles } from "@/lib/flow/nodes";
import { check24hWindow } from "@/lib/meta/window";

describe("Motor de Automação — Etapa 3", () => {
  describe("Validação do Webhook (GET Handshake)", () => {
    it("deve aceitar o token correto e retornar o hub.challenge", () => {
      const params = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": "meu_token_secreto",
        "hub.challenge": "11582012",
      });

      const challenge = verifyWebhookChallenge(params, "meu_token_secreto");
      expect(challenge).toBe("11582012");
    });

    it("deve rejeitar quando o token estiver errado", () => {
      const params = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": "token_errado",
        "hub.challenge": "11582012",
      });

      const challenge = verifyWebhookChallenge(params, "meu_token_secreto");
      expect(challenge).toBeNull();
    });
  });

  describe("Validação de Assinatura HMAC SHA-256", () => {
    it("deve validar assinatura correta calculada com o app secret", () => {
      const secret = "segredo_meta_123";
      const rawBody = JSON.stringify({ object: "instagram", entry: [] });

      // Calcula HMAC esperado
      const crypto = require("crypto");
      const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      const isValid = verifyMetaHmacSignature(rawBody, `sha256=${hmac}`, secret);
      expect(isValid).toBe(true);
    });

    it("deve rejeitar assinatura forjada ou payload adulterado", () => {
      const secret = "segredo_meta_123";
      const rawBody = "conteudo original";
      const signature = "sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      const isValid = verifyMetaHmacSignature(rawBody, signature, secret);
      expect(isValid).toBe(false);
    });
  });

  describe("Parser de Eventos da Meta", () => {
    it("deve extrair evento de comentário corretamente", () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "ACCOUNT_123",
            changes: [
              {
                field: "comments",
                value: {
                  id: "COMMENT_999",
                  text: "EU QUERO",
                  from: { id: "USER_456", username: "maria_noiva" },
                  media: { id: "POST_777" },
                },
              },
            ],
          },
        ],
      };

      const events = parseInstagramWebhookPayload(payload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "comment",
        commentId: "COMMENT_999",
        text: "EU QUERO",
        userIgsid: "USER_456",
        username: "maria_noiva",
        mediaId: "POST_777",
      });
    });

    it("deve extrair mensagem direta (DM)", () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "ACCOUNT_123",
            messaging: [
              {
                sender: { id: "USER_456" },
                recipient: { id: "ACCOUNT_123" },
                message: { mid: "mid.1234", text: "Olá! Como funciona?" },
              },
            ],
          },
        ],
      };

      const events = parseInstagramWebhookPayload(payload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "message",
        userIgsid: "USER_456",
        text: "Olá! Como funciona?",
        messageId: "mid.1234",
      });
    });

    it("deve extrair clique em botão fixo (Postback)", () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "ACCOUNT_123",
            messaging: [
              {
                sender: { id: "USER_456" },
                postback: {
                  title: "DESBLOQUEAR",
                  payload: "node:cly123_btn_1",
                },
              },
            ],
          },
        ],
      };

      const events = parseInstagramWebhookPayload(payload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "postback",
        userIgsid: "USER_456",
        title: "DESBLOQUEAR",
        payload: "node:cly123_btn_1",
      });
    });
  });

  describe("Casamento de Palavras-Chave (Matcher)", () => {
    it("deve reconhecer palavras com CONTAINS mesmo com diferenças de maiúsculas/espaços", () => {
      const matches = matchesKeyword(
        "Olá, gostaria de saber o Casamento de 2026!",
        ["casamento", "noiva"],
        "CONTAINS"
      );
      expect(matches).toBe(true);
    });

    it("deve rejeitar se a palavra não estiver no texto", () => {
      const matches = matchesKeyword("Bom dia!", ["casamento"], "CONTAINS");
      expect(matches).toBe(false);
    });

    it("deve exigir texto exato quando a regra for EXACT", () => {
      expect(matchesKeyword("Casamento", ["casamento"], "EXACT")).toBe(true);
      expect(matchesKeyword("Quero meu casamento", ["casamento"], "EXACT")).toBe(false);
    });

    it("deve sempre aprovar quando a regra for ANY", () => {
      expect(matchesKeyword("Qualquer coisa aleatória", [], "ANY")).toBe(true);
    });
  });

  describe("Cliente da Graph API (Mock Mode)", () => {
    const client = new InstagramGraphClient(null);

    it("deve simular envio de texto com sucesso", async () => {
      const res = await client.sendTextMessage("USER_123", "Olá! Mensagem de teste");
      expect(res.success).toBe(true);
      expect(res.mock).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it("deve limitar botões a no máximo 3 e truncar títulos a 20 chars em maiúsculas", async () => {
      const res = await client.sendButtonMessage("USER_123", "Escolha uma opção:", [
        { title: "quero me inscrever agora", type: "postback" },
        { title: "falar com atendente", type: "postback" },
        { title: "ver catálogo de fotos", type: "web_url", url: "https://movingfestival.com.br" },
        { title: "quarto botão que deve ser ignorado", type: "postback" },
      ]);

      expect(res.success).toBe(true);
      expect(res.mock).toBe(true);
    });

    it("deve simular resposta pública a comentário", async () => {
      const res = await client.replyToComment("COMMENT_123", "Te mandei no direct! 🚀");
      expect(res.success).toBe(true);
      expect(res.mock).toBe(true);
    });
  });

  describe("Etapa 4 — Os Botões Fixos (Button Template)", () => {
    it("deve validar formato do botão fixo e limitar o título a 20 caracteres", () => {
      // Botão válido com postback
      const valid = dmButtonSchema.safeParse({
        id: "btn_1",
        title: "QUERO ME INSCREVER",
        type: "postback",
      });
      expect(valid.success).toBe(true);

      // Botão inválido (mais de 20 caracteres)
      const invalidTitle = dmButtonSchema.safeParse({
        id: "btn_2",
        title: "ESTE TITULO TEM MAIS DE 20 CARACTERES E DEVE FALHAR",
        type: "postback",
      });
      expect(invalidTitle.success).toBe(false);

      // Limite máximo de 3 botões por mensagem
      const questionCheck = configSchemas.QUESTION.safeParse({
        text: "Escolha uma opção:",
        buttons: [
          { id: "b1", title: "BOTAO 1", type: "postback" },
          { id: "b2", title: "BOTAO 2", type: "postback" },
          { id: "b3", title: "BOTAO 3", type: "postback" },
          { id: "b4", title: "BOTAO 4 QUE ESTOURA", type: "postback" },
        ],
      });
      expect(questionCheck.success).toBe(false);
    });

    it("deve gerar saídas (handles) individuais no Canvas para cada botão do tipo postback", () => {
      const questionData = {
        kind: "QUESTION" as const,
        name: null,
        config: {
          text: "Qual seu plano?",
          buttons: [
            { id: "btn_noiva", title: "SOU NOIVA", type: "postback" as const },
            { id: "btn_fornecedor", title: "FORNECEDOR", type: "postback" as const },
            { id: "btn_site", title: "VER SITE", type: "web_url" as const, url: "https://movingfestival.com.br" },
          ],
        },
      };

      const handles = outputHandles(questionData as any, () => undefined);

      // Deve ter exatamente 2 saídas para os dois botões postback (o web_url não tem saída pois sai do Instagram)
      expect(handles).toHaveLength(2);
      expect(handles[0]).toEqual({ id: "btn_noiva", label: "SOU NOIVA" });
      expect(handles[1]).toEqual({ id: "btn_fornecedor", label: "FORNECEDOR" });
    });
  });

  describe("Etapa 5 — O Carrossel e Catálogo de Cards (Generic Template)", () => {
    it("deve enviar carrossel formatado como Generic Template da Meta", async () => {
      const client = new InstagramGraphClient();
      const elements = [
        {
          title: "Pacote Casamento Moving 2026",
          subtitle: "Cerimônia completa ao pôr do sol",
          imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552",
          buttonTitle: "QUERO PARTICIPAR",
          buttonType: "postback" as const,
          payload: "card:card_1",
        },
        {
          title: "Fotos da Decoração",
          subtitle: "Veja os arranjos exclusivos",
          imageUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc",
          buttonTitle: "VER FOTOS",
          buttonType: "web_url" as const,
          url: "https://movingfestival.com.br",
        },
      ];

      const res = await client.sendCarouselMessage("IGSID_TEST", elements);
      expect(res.success).toBe(true);
      expect(res.mock).toBe(true);
      expect(res.messageId).toContain("mock_mid_carousel_");
    });

    it("deve rejeitar carrossel vazio sem elementos", async () => {
      const client = new InstagramGraphClient();
      const res = await client.sendCarouselMessage("IGSID_TEST", []);
      expect(res.success).toBe(false);
      expect(res.error).toContain("precisa ter pelo menos 1 card");
    });

    it("deve gerar saídas no nó CAROUSEL somente para cards com botão POSTBACK", () => {
      const mockCatalog: Record<string, { title: string; buttonType: "URL" | "POSTBACK" }> = {
        item_1: { title: "Pacote VIP", buttonType: "POSTBACK" },
        item_2: { title: "Link WhatsApp", buttonType: "URL" },
        item_3: { title: "Pacote Standard", buttonType: "POSTBACK" },
      };

      const carouselNodeData = {
        kind: "CAROUSEL" as const,
        name: null,
        config: {
          cards: [
            { id: "c1", catalogItemId: "item_1" },
            { id: "c2", catalogItemId: "item_2" },
            { id: "c3", catalogItemId: "item_3" },
          ],
        },
      };

      const handles = outputHandles(carouselNodeData as any, (id) => mockCatalog[id] as any);

      // Apenas item_1 e item_3 têm POSTBACK, gerando 2 saídas
      expect(handles).toHaveLength(2);
      expect(handles[0]).toEqual({ id: "c1", label: "Pacote VIP" });
      expect(handles[1]).toEqual({ id: "c3", label: "Pacote Standard" });
    });
  });

  describe("Etapa 6 — Painel de Contatos e Histórico de Conversas (Live Inbox)", () => {
    it("deve calcular a janela de 24 horas da Meta corretamente", () => {
      // 1. Mensagem recebida há 2 horas (janela ativa com ~22h restantes)
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      const activeWindow = check24hWindow(twoHoursAgo);
      expect(activeWindow.is24hActive).toBe(true);
      expect(activeWindow.remainingHours).toBeGreaterThanOrEqual(21);
      expect(activeWindow.remainingHours).toBeLessThanOrEqual(23);

      // 2. Mensagem recebida há 25 horas (janela expirada)
      const expiredTime = new Date(Date.now() - 25 * 3600 * 1000);
      const expiredWindow = check24hWindow(expiredTime);
      expect(expiredWindow.is24hActive).toBe(false);
      expect(expiredWindow.remainingHours).toBe(0);

      // 3. Sem mensagem anterior
      const nullWindow = check24hWindow(null);
      expect(nullWindow.is24hActive).toBe(false);
      expect(nullWindow.remainingHours).toBe(0);
    });

    it("deve filtrar comentários e mensagens de autoria da própria conta (anti-auto-comentário)", () => {
      const webhookPayload = {
        object: "instagram",
        entry: [
          {
            id: "ACCOUNT_123",
            changes: [
              {
                field: "comments",
                value: {
                  id: "COMMENT_OWNER",
                  text: "Meu próprio comentário respondendo seguidor",
                  from: { id: "ACCOUNT_123", username: "startinc" }, // Mesmo ID da conta
                  media: { id: "POST_1" },
                },
              },
              {
                field: "comments",
                value: {
                  id: "COMMENT_LEAD",
                  text: "EU QUERO",
                  from: { id: "LEAD_456", username: "maria_lead" }, // Lead real
                  media: { id: "POST_1" },
                },
              },
            ],
            messaging: [
              {
                sender: { id: "ACCOUNT_123" }, // Mensagem enviada pelo dono
                message: { mid: "mid_self", text: "Mensagem enviada por mim" },
              },
              {
                sender: { id: "LEAD_456" }, // Mensagem enviada pelo lead
                message: { mid: "mid_lead", text: "Olá, quero saber mais" },
              },
            ],
          },
        ],
      };

      const events = parseInstagramWebhookPayload(webhookPayload);

      // Deve ignorar o comentário do dono e a mensagem do dono, retornando apenas os 2 eventos do lead
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        kind: "comment",
        commentId: "COMMENT_LEAD",
        userIgsid: "LEAD_456",
      });
      expect(events[1]).toMatchObject({
        kind: "message",
        messageId: "mid_lead",
        userIgsid: "LEAD_456",
      });
    });
  });
});


