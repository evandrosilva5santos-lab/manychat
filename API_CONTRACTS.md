# API_CONTRACTS — Contratos de Integração & Webhooks (Fluxo)

> **Documento de Contratos de API**  
> **Protocolos:** REST, Webhooks Meta Graph API v21.0, Server Actions  

---

## 1. Webhooks da Meta (Instagram Messaging API)

### 1.1 Verificação de Webhook (Desafio Inicial da Meta)
* **Método:** `GET /api/webhook/instagram`
* **Query Params:**
  - `hub.mode`: `"subscribe"`
  - `hub.verify_token`: String configurada em `META_VERIFY_TOKEN`
  - `hub.challenge`: Número/String gerado pela Meta
* **Resposta Esperada:**
  - `200 OK` com o valor de `hub.challenge` em texto puro.

---

### 1.2 Recepção de Eventos (Comentários, DMs e Cliques)
* **Método:** `POST /api/webhook/instagram`
* **Headers:**
  - `x-hub-signature-256`: `sha256={HMAC}` gerado com `META_APP_SECRET`.
* **Payload de Comentário:**
```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "IG_ACCOUNT_ID",
      "time": 1727200000,
      "changes": [
        {
          "field": "comments",
          "value": {
            "id": "COMMENT_ID",
            "text": "Eu quero o guia",
            "from": { "id": "IGSID_DO_LEAD", "username": "lead_insta" },
            "media": { "id": "POST_ID" }
          }
        }
      ]
    }
  ]
}
```

* **Payload de DM / Mensagem Recebida:**
```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "IG_ACCOUNT_ID",
      "time": 1727200000,
      "messaging": [
        {
          "sender": { "id": "IGSID_DO_LEAD" },
          "recipient": { "id": "IG_ACCOUNT_ID" },
          "timestamp": 1727200000,
          "message": {
            "mid": "mid.123456",
            "text": "QUERO SABER MAIS"
          }
        }
      ]
    }
  ]
}
```

* **Payload de Clique em Botão Fixo (Postback):**
```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "IG_ACCOUNT_ID",
      "messaging": [
        {
          "sender": { "id": "IGSID_DO_LEAD" },
          "recipient": { "id": "IG_ACCOUNT_ID" },
          "postback": {
            "title": "DESBLOQUEAR",
            "payload": "node:cly123456_btn_1"
          }
        }
      ]
    }
  ]
}
```

---

## 2. Envio de Mensagens para a Meta Graph API

### 2.1 Envio de DM com Botão Fixo (`button template`)
* **Endpoint:** `POST https://graph.facebook.com/v21.0/me/messages`
* **Headers:** `Authorization: Bearer {IG_ACCESS_TOKEN}`
* **Payload:**
```json
{
  "recipient": { "id": "IGSID_DO_LEAD" },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "Olá! Aqui está o seu material gratuito:",
        "buttons": [
          {
            "type": "postback",
            "title": "ACESSAR AGORA",
            "payload": "node:node_id_proximo_passo"
          }
        ]
      }
    }
  }
}
```

### 2.2 Resposta Pública ao Comentário
* **Endpoint:** `POST https://graph.facebook.com/v21.0/{COMMENT_ID}/replies`
* **Payload:**
```json
{
  "message": "Te mandei o link no direct! Dá uma olhadinha lá 🚀"
}
```

---

## 3. Rastreamento Interno de Cliques em Link
* **Rota:** `GET /api/l/[code]`
* **Comportamento:**
  1. Busca o link original correspondente ao `code`.
  2. Registra o evento de clique para o `contactId`.
  3. Atualiza o status no `FlowRun` (para desbloquear o nó de condição "link_clicked").
  4. Redireciona via `302 Found` para o link de destino.
