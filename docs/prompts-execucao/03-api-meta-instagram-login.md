# PROMPT 03 — API da Meta: Instagram Login, private reply, postbacks e motor correto

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> Onda B. Depende do item 2. Os itens 4 e 5 dependem deste.

## Papel
Você é o especialista em Instagram Platform. Faça a função principal funcionar de verdade e dentro das regras da Meta: **comentou → resposta pública → DM (private reply) → botão → próxima mensagem → link rastreado**.

## Leitura obrigatória específica
`PRD.md` (invariantes da Meta), `PRD_TRACEABILITY.md` (REQ-001, REQ-003, REQ-008 a REQ-012, REQ-015 a REQ-018), `docs/etapa-3-motor.md`, `docs/etapa-4-botoes.md`, `docs/etapa-5-carrossel.md`, `docs/etapa-7-meta-app.md`, `docs/ARCHITECTURE.md` (§6, janela de 24h), `docs/DECISIONS.md`, `docs/GLOSSARY.md`.

**Documentação oficial atual da Meta** (use WebFetch/WebSearch; não confie na memória):
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
- https://developers.facebook.com/docs/instagram-platform/private-replies
- https://developers.facebook.com/docs/instagram-platform/webhooks
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/docs/instagram-platform/overview (limites e níveis de acesso)
- https://developers.facebook.com/docs/graph-api/changelog

## Decisão a confirmar com o dono
Adotar **Instagram API with Instagram Login** (`graph.instagram.com`, escopos `instagram_business_basic`, `instagram_business_manage_messages` e `instagram_business_manage_comments`, sem Página do Facebook). O REQ-001 do PRD diz "Facebook Login": registre um ADR e atualize o PRD.

## Evidências da auditoria
- **Hosts misturados:** envio em `graph.facebook.com/v21.0` (`graph.ts:48`), campo de Página `instagram_business_account` (`:369`) e refresh em `graph.instagram.com` (`:452`). A v21.0 expira em 21/01/2027.
- **Primeira DM após comentário:** o envio usa `recipient:{id: igsid}` (`graph.ts:77,137`; `runner.ts:150,180,332`). O correto é private reply `recipient:{comment_id}`, uma por comentário, em até 7 dias. Depois disso, só há janela aberta quando a pessoa responder ou clicar.
- **`subscribeWebhooks`** (`graph.ts:417`) assina só `comments` e `messages`. **Falta `messaging_postbacks`.**
- **Nó QUESTION** só com botões `web_url` fica parado em `WAITING_CLICK` para sempre (`runner.ts:169-203`). QUESTION sem botões gera payload inválido.
- **Condição `link_clicked`** não é tratada (`runner.ts:206-244`). Os botões levam a URL crua, não um link rastreado.
- **Janela de 24h:** não é checada no motor. `lastInboundAt` é atualizado também em comentários (`contacts.ts:42`). DELAY aceita até 7 dias (`flow/schema.ts:43`).
- **Conta errada:** o webhook usa a "primeira conta" (`route.ts:55`) e ignora `entry[].id`.
- **Erros da Graph:** viram só uma string (`graph.ts:85`). Não há código ou subcódigo, nem timeout. Os códigos 190, 10/2018278/2534022 e 4/613 não são tratados.
- **Limites de texto:** o texto do template de botões é limitado a 640 caracteres (o código usa 1000). Mensagem de texto: 1000 *bytes*, não caracteres.
- **Payload de postback:** a regex `^node:([^_]+)` (`route.ts:153`) quebra em IDs com `_`.
- **Matcher:**
  - `negativeKeywords` não funciona (não existe a coluna);
  - `matchType:"any"` é ignorado;
  - lista de palavras vazia + CONTAINS dispara em todo comentário (`matcher.ts:46`);
  - CONTAINS é substring sem limite de palavra ("eu" casa com "europa");
  - EXACT falha com pontuação ou emoji;
  - o filtro de `mediaId` é ignorado quando o evento não traz `mediaId` (`:103`);
  - não há cooldown por contato;
  - a ordem de prioridade dos gatilhos é indefinida.
- **Eco e auto-disparo:** falta checar `is_echo` e ignorar respostas aos próprios comentários. `from.id` pode vir `undefined` (`webhook.ts:108`). Valide o corpo com Zod.

## Tarefas
1. **Cliente Graph único** (`src/lib/meta/graph.ts`):
   - base `https://graph.instagram.com/<versão estável mais recente>` em uma constante;
   - token por conta (o item 5 entrega o armazenamento; até lá, leia do ambiente pela conta);
   - `AbortSignal.timeout`;
   - retorno tipado `{ success, id?, code?, subcode?, retryable, error }`.
2. **Endpoints do Instagram Login:**
   - `POST /me/messages` (texto, template de botões, template genérico/carrossel, quick replies);
   - private reply (`recipient:{comment_id}`);
   - `POST /{comment-id}/replies` (resposta pública);
   - `GET /me?fields=user_id,username,…`;
   - `POST /me/subscribed_apps` com `comments`, `messages` e `messaging_postbacks` (e `messaging_seen` ou `message_reactions` só se forem usados).
3. **Motor (`runner.ts`):**
   - `executeFlow` recebe o contexto do gatilho (`commentId`, `mediaId`, origem);
   - a primeira mensagem de um fluxo disparado por comentário vai como private reply;
   - o fluxo pausa até a pessoa interagir quando a janela ainda não está aberta;
   - antes de cada envio que não seja private reply, verificar a janela de 24h;
   - `lastInboundAt` só muda com DM ou postback.
4. **QUESTION:** só aguarda clique se houver ao menos um botão postback; senão segue a aresta padrão. Validar de 1 a 3 botões, título com até 20 caracteres e texto com até 640.
5. **Links rastreados:** botões `web_url` passam a usar `TrackedLink` (criado no item 1), um por contato e nó. A condição `link_clicked` consulta os cliques. Recomende ao dono cuidado com lembretes para quem já clicou.
6. **DELAY:** limite de 23h, a não ser que a janela seja reaberta. O agendamento em si é do item 5; aqui, só a validação no lint e no schema.
7. **Matcher:**
   - normalização (minúsculas, sem acento, pontuação, emoji, seletores de variação e caracteres de largura zero);
   - CONTAINS com limite de palavra;
   - "qualquer comentário" só como opção explícita;
   - `mediaId` obrigatório quando o gatilho é de post específico;
   - prioridade determinística;
   - `negativeKeywords` implementado (coluna nova) ou removido da interface;
   - cooldown por contato e fluxo, configurável.
8. **Webhook:** validar o corpo com Zod; rotear a conta por `entry[].id` (`InstagramAccount.igUserId`); ignorar `is_echo`, comentários da própria conta e respostas a respostas próprias; payload de postback codificado com JSON/base64url, sem regex frágil.
9. **Erros:**
   - 190 → marcar a conta como `EXPIRED` e mostrar alerta;
   - 10, 2018278 e 2534022 → "fora da janela", registrar;
   - 4, 613 e 32 → `retryable` (a fila do item 4 refaz).
10. **Documentação:** reescrever `docs/etapa-7-meta-app.md` para o Instagram Login (escopos, webhook, campos, sem Página), e atualizar `ARCHITECTURE.md`, `DECISIONS.md` (ADR), `PRD.md` e `PRD_TRACEABILITY.md`.

## Arquivos que este item possui
`src/lib/meta/*`, `src/lib/engine/*`, `src/lib/flow/*` (validações), `src/app/api/webhook/instagram/route.ts` (parse e roteamento), a mudança de schema do matcher (envie ao orquestrador) e os documentos citados.

## Agentes e skills
- **Agentes:** `general-purpose` (pesquisa nos docs oficiais da Meta com citação de URL), `typescript-reviewer`, `silent-failure-hunter`, `code-reviewer`, `tdd-guide`, `security-reviewer` (webhook).
- **Skills:** `instagram-automation`, `instagram`, `api-design`, `error-handling-patterns`, `backend-patterns`, `tdd-workflow`; `docs-lookup`/Context7 para o Next.js.

## Testes
- **Fixtures** com payloads reais de exemplo da documentação da Meta: comentário, DM, postback, eco, story reply.
- **Cliente Graph** com `fetch` simulado: URL, cabeçalho Bearer e corpo de cada endpoint; mapeamento dos códigos 190, 10, 2018278, 2534022, 4, 613 e 100; timeout; resposta que não é JSON.
- **Motor:**
  - um teste por tipo de nó;
  - a primeira mensagem após comentário é private reply;
  - QUESTION só com link não espera;
  - `link_clicked` verdadeiro e falso;
  - envio bloqueado fora da janela;
  - ciclo interrompido;
  - postback com ID contendo `_`.
- **Matcher:** testes em tabela (acentos, pontuação, emoji, limite de palavra, lista vazia, `mediaId`, prioridade, cooldown).
- **Real com a conta de teste** (com o dono, app em modo Dev):
  1. comentar a palavra-chave → resposta pública + DM private reply chegam;
  2. tocar no botão → o postback chega (log do webhook) → a próxima mensagem chega;
  3. clicar no link → `TrackedLink.clicks` sobe → o ramo "clicou" é seguido.
  - Guarde screenshots do celular/Instagram e os logs.
- **Navegador:** Ajustes mostra a conta real, as permissões reais e o estado do webhook.

## Critérios de aceite
- [ ] Um único host e uma única versão da Graph API; nenhum resto do fluxo Facebook Login (exceto se o dono escolher o contrário).
- [ ] O teste real com a conta de teste funciona de ponta a ponta, com evidência.
- [ ] O motor respeita a janela de 24h, os limites de template e o limite de uma private reply por comentário.
- [ ] Eventos roteados pela conta certa (`entry.id`); nenhum auto-disparo por eco.
- [ ] Documentos e `PRD_TRACEABILITY.md` (REQ-001, REQ-009 a REQ-012, REQ-015 a REQ-018) atualizados; ADR registrado.
