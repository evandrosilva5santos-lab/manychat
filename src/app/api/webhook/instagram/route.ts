import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/account";
import { defaultGraphClient } from "@/lib/meta/graph";
import {
  parseInstagramWebhookPayload,
  verifyMetaHmacSignature,
  verifyWebhookChallenge,
} from "@/lib/meta/webhook";
import { getOrCreateContact, recordIncomingMessage, recordOutgoingMessage } from "@/lib/engine/contacts";
import { findMatchingTrigger } from "@/lib/engine/matcher";
import { executeFlow, resumeFlowOnClick } from "@/lib/engine/runner";

/**
 * GET /api/webhook/instagram
 * Desafio de verificação do Webhook pela Meta.
 */
export async function GET(request: NextRequest) {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || "fluxo_webhook_token";
  const challenge = verifyWebhookChallenge(request.nextUrl.searchParams, verifyToken);

  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Verificação falhou. Token inválido.", { status: 403 });
}

/**
 * POST /api/webhook/instagram
 * Receptor de eventos oficiais do Instagram (comentários, DMs, cliques).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET || "";

  // 1. Validação de Assinatura HMAC SHA-256
  const isValidSignature = verifyMetaHmacSignature(rawBody, signature, appSecret);
  if (!isValidSignature) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // 2. Extração dos eventos padronizados
  const events = parseInstagramWebhookPayload(body);
  const account = await getCurrentAccount();

  // 3. Processamento assíncrono dos eventos
  for (const event of events) {
    try {
      // Busca ou cria o contato que disparou o evento
      const contact = await getOrCreateContact({
        accountId: account.id,
        igsid: event.userIgsid,
        username: "username" in event ? event.username : undefined,
      });

      // CASO A: Comentário em post ou Reel
      if (event.kind === "comment") {
        await recordIncomingMessage({
          accountId: account.id,
          contactId: contact.id,
          text: event.text,
          kind: "COMMENT",
          mediaId: event.mediaId,
          igMessageId: event.commentId,
        });

        const match = await findMatchingTrigger(account.id, event);
        if (match) {
          // Se tiver resposta pública configurada, envia no comentário
          if (match.publicReply) {
            const replyRes = await defaultGraphClient.replyToComment(
              event.commentId,
              match.publicReply
            );
            await recordOutgoingMessage({
              accountId: account.id,
              contactId: contact.id,
              text: match.publicReply,
              kind: "COMMENT_REPLY",
              flowId: match.flow.id,
              error: replyRes.error,
            });
          }

          // Dispara a DM e inicia a execução do fluxo
          await executeFlow({
            accountId: account.id,
            contact,
            flowId: match.flow.id,
            startNodeId: match.startNodeId,
            triggerId: match.trigger.id,
            inboundText: event.text,
          });
        }
      }

      // CASO B: Mensagem de texto no Direct (DM)
      else if (event.kind === "message") {
        await recordIncomingMessage({
          accountId: account.id,
          contactId: contact.id,
          text: event.text,
          kind: "TEXT",
          igMessageId: event.messageId,
        });

        const match = await findMatchingTrigger(account.id, event);
        if (match) {
          await executeFlow({
            accountId: account.id,
            contact,
            flowId: match.flow.id,
            startNodeId: match.startNodeId,
            triggerId: match.trigger.id,
            inboundText: event.text,
          });
        }
      }

      // CASO C: Clique em Botão Fixo (Postback)
      else if (event.kind === "postback") {
        await recordIncomingMessage({
          accountId: account.id,
          contactId: contact.id,
          text: event.title,
          kind: "POSTBACK",
          payload: { payload: event.payload },
        });

        // 1. Botão do Follow Gate (gate:nodeId)
        if (event.payload.startsWith("gate:")) {
          const nodeId = event.payload.replace("gate:", "");
          await resumeFlowOnClick({
            accountId: account.id,
            contact,
            nodeId,
            payload: event.payload,
          });
        }
        // 2. Botão de Pergunta (node:nodeId_btn_btnId)
        else if (event.payload.startsWith("node:")) {
          const match = event.payload.match(/^node:([^_]+)(?:_btn_(.+))?$/);
          if (match) {
            const [, nodeId, buttonId] = match;
            await resumeFlowOnClick({
              accountId: account.id,
              contact,
              nodeId,
              buttonId,
              payload: event.payload,
            });
          }
        }
        // 3. Gatilho independente de clique
        else {
          const match = await findMatchingTrigger(account.id, event);
          if (match) {
            await executeFlow({
              accountId: account.id,
              contact,
              flowId: match.flow.id,
              startNodeId: match.startNodeId,
              triggerId: match.trigger.id,
            });
          }
        }
      }
    } catch (err) {
      console.error("Erro ao processar evento do Instagram:", err);
    }
  }

  // A Meta exige resposta 200 OK imediata
  return NextResponse.json({ status: "ok", processed: events.length });
}
