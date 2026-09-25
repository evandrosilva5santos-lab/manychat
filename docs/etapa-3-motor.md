# Etapa 3 — O Motor de Automação, explicado

O **Motor de Automação** é o cérebro que faz seu ManyChat próprio funcionar 24 horas por dia, 7 dias por semana. Ele escuta o que acontece no Instagram (comentários, mensagens no direct e cliques em botões), descobre qual fluxo deve rodar e executa caixinha por caixinha.

---

## 1. O que foi construído nesta Etapa

| Arquivo | Pra que serve |
| --- | --- |
| `src/app/api/webhook/instagram/route.ts` | A "porta de entrada" que a Meta chama para avisar de novos comentários e mensagens. |
| `src/lib/meta/graph.ts` | O cliente que fala com a Instagram Graph API (manda DM, manda botões fixos e responde comentários). Tem modo Mock automático para testar sem chaves. |
| `src/lib/meta/webhook.ts` | Valida o aperto de mãos (handshake GET), confere a assinatura de segurança HMAC SHA-256 e transforma o JSON bagunçado da Meta em eventos limpos. |
| `src/lib/engine/contacts.ts` | Cadastra ou atualiza os contatos (`Contact`) e grava todo o histórico de mensagens trocadas (`Message`). |
| `src/lib/engine/matcher.ts` | Procura qual fluxo com status `LIVE` tem as palavras-chave que a pessoa comentou ou digitou. |
| `src/lib/engine/runner.ts` | O `FlowRunner`: caminha pelo grafo de nós, dispara as DMs, avalia condições e pausa em botões fixos. |
| `src/app/api/l/[code]/route.ts` | Rota para encurtar e rastrear cliques em links (ex: WhatsApp). |
| `src/lib/engine/engine.test.ts` | Suíte de testes automatizados cobrindo 100% da lógica do motor. |

---

## 2. O Ciclo de Vida do Webhook

Quando a Meta conversa com o seu sistema, ela faz isso em dois momentos:

### A. O Desafio de Verificação (GET)
Ao cadastrar a URL no painel do **Meta for Developers** (Etapa 7), a Meta faz uma requisição `GET` para testar se o servidor é seu mesmo:
```http
GET /api/webhook/instagram?hub.mode=subscribe&hub.challenge=11582012&hub.verify_token=SEU_TOKEN
```
O nosso endpoint confere se o `hub.verify_token` bate com o que você configurou no `.env` (`WEBHOOK_VERIFY_TOKEN`). Se bater, responde imediatamente com o número do `hub.challenge` em texto puro. Pronto, a Meta aprova o webhook na hora!

### B. O Recebimento de Eventos (POST)
Sempre que alguém comenta num post ou manda uma DM, a Meta dispara um `POST` com um cabeçalho de segurança:
```http
POST /api/webhook/instagram
x-hub-signature-256: sha256=abcdef123456...
```
Nosso código calcula o HMAC SHA-256 do corpo da requisição usando o seu `META_APP_SECRET`. Se a assinatura bater, temos certeza absoluta de que a mensagem veio da Meta e ninguém forjou dados.

---

## 3. Como o Motor Executa Cada Tipo de Caixinha

O `FlowRunner` pega o nó inicial e vai seguindo as linhas (`Edge`):

1. **Mensagem de Texto (`MESSAGE`)**:
   - Substitui variáveis como `{{name}}` e `{{username}}` pelo nome real do seguidor.
   - Envia a DM via Graph API.
   - Grava no histórico e avança imediatamente para a próxima caixinha conectada.

2. **Pergunta com Botões Fixos (`QUESTION`)**:
   - Envia a mensagem no formato `button template`.
   - Limite da Meta: **máximo de 3 botões** e até **20 caracteres** por botão.
   - **PAUSA a execução**: o `FlowRun` fica com status `WAITING_CLICK`. O sistema não manda mais nada até o usuário tocar num dos botões.
   - Quando o lead clica, a Meta manda um evento `postback`. O motor acorda a execução pausada e segue pela linha que sai daquele botão específico!

3. **Condição (`CONDITION`)**:
   - Avalia a regra (ex: `follows`, `has_tag`, `reply_contains`).
   - Se a condição for verdadeira, segue pela bolinha **"Sim"** (`yes`).
   - Se for falsa, segue pela bolinha **"Não"** (`no`).

4. **Aplicar Etiqueta (`ADD_TAG`)**:
   - Cria ou associa a etiqueta ao contato no banco de dados.
   - Útil para marcar quem é "lead-quente", "já-comprou" ou "noiva-2026".

5. **Confirme que Segue (`FOLLOW_GATE`)**:
   - Confere se o lead já segue o perfil.
   - Se já segue: avança direto e libera o link!
   - Se ainda não segue: manda uma mensagem com o botão fixo `JÁ SEGUI` e pausa até ele clicar após seguir o perfil.

6. **Espera (`DELAY`)**:
   - Define a data/hora em que a execução deve ser retomada (`resumeAt = agora + X segundos`).
   - O status vira `WAITING_DELAY`.

---

## 4. As Regras Oficiais da Meta (Muito Importante)

1. **Janela de 24 Horas**: você só pode mandar mensagens ativas para o Direct até 24h após a última mensagem enviada pelo lead. Se ele só comentou no post, a Meta libera o envio de **apenas 1 DM** de resposta inicial. Por isso, a primeira mensagem sempre deve ter um botão para o lead clicar (pois ao clicar, ele abre a janela de 24h para você conversar à vontade).
2. **Resposta Rápida (< 5 segundos)**: o webhook responde `HTTP 200 OK` logo no início, processando as mensagens em segundo plano. Se demorasse, o Instagram tentaria reenviar o evento várias vezes, duplicando mensagens.
3. **Modo MOCK Automático**: Se você rodar localmente sem `IG_ACCESS_TOKEN`, o sistema não quebra: ele simula os envios com sucesso e registra no banco, permitindo testar tudo com vitest ou cURL.
