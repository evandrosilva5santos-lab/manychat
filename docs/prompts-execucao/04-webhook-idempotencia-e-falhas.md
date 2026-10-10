# PROMPT 04 — Webhook confiável: sem DM duplicada, falhas registradas, resposta rápida

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> Onda C. Depende do item 3. Roda em paralelo com o item 5; as mudanças de `schema.prisma` dos dois viram uma única migration coordenada pelo orquestrador.

## Papel
Você torna o processamento de eventos à prova de falhas:
- cada evento da Meta é processado **exatamente uma vez**;
- todo envio que falha fica registrado e visível;
- o webhook responde à Meta em menos de 2 segundos.

## Leitura obrigatória específica
`docs/etapa-3-motor.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `prisma/schema.prisma`, `PRD_TRACEABILITY.md` (REQ-019: resposta sob carga < 3s), `execution/MASTER_PLAN.md` (NANO-051 a NANO-054), e a documentação de webhooks da Meta (retentativas por até 36h).

## Decisão a confirmar com o dono
A fila durável: **QStash, Inngest, Trigger.dev ou Vercel Queues**. O `after()` do Next não é durável e só serve como complemento. A mesma escolha atende o DELAY do item 5.

## Evidências da auditoria
- **Webhook síncrono:** o webhook aguarda todas as chamadas à Graph API antes do 200 (`route.ts:58-185`). Eventos lentos levam a timeout e retentativas, e as retentativas viram duplicatas.
- **Sem deduplicação:**
  - `recordIncomingMessage` faz busca e depois criação (`contacts.ts:120-138`), o que tem condição de corrida;
  - o resultado duplicado é ignorado e `executeFlow` roda de novo (`route.ts:69,110`);
  - postbacks não têm ID (`route.ts:~128`);
  - comentários não têm chave de idempotência.
- **Contato com condição de corrida:** busca → atualiza ou cria (`contacts.ts:26-58`); o P2002 cai no fallback.
- **FlowRun:**
  - criado a cada match sem unicidade (`runner.ts:109`);
  - `resumeFlowOnClick` faz busca e depois atualização sem reivindicação atômica (`runner.ts:426`), então um clique duplo executa duas vezes;
  - não há `orderBy`.
- **Falhas que somem:**
  - FOLLOW_GATE e CAROUSEL ignoram o resultado (`runner.ts:287-304,332-343`);
  - a nova tentativa do follow-gate também (`:476-479`);
  - QUESTION entra em `WAITING_CLICK` mesmo após falha (`:194`);
  - o run fica DONE mesmo com falha (`:401`);
  - não existe status `FAILED` nem campo de erro no `FlowRun`.
- **Exceções engolidas:** o webhook responde 200 mesmo com exceção, e o evento se perde (`route.ts:179-185`). `getCurrentAccount()` está fora do `try` (`:55`).
- **`checkUserFollows`:** devolve `false` em qualquer erro (`graph.ts:310,341`), e o lead fica preso no gate.
- **Desempenho:**
  - o matcher carrega todos os fluxos LIVE com todos os nós a cada evento (`matcher.ts:70`);
  - inbox e contatos sem paginação (`conversas/actions.ts`, `contatos/actions.ts:61`).
- **Índices que faltam:**
  - `Message(accountId, createdAt)`, `Message(runId)`, `Message(nodeId)`;
  - `Contact(sourceFlowId)`;
  - `FlowRun(triggerId)`, `FlowRun(currentNodeId)`, `FlowRun(contactId, currentNodeId, status)`;
  - `Trigger(startNodeId)`, `Trigger(type, mediaId)`;
  - `Edge(sourceHandle NULL)` permite duplicatas.
- **Pool `pg`:** o pool padrão não serve para serverless. Use `max` pequeno e o pooler (porta 6543 no Supabase).
- **Exclusões em cascata:** apagar um Flow apaga o histórico (`FlowRun`). Prefira soft-delete (`archivedAt`) e `SetNull`/`Restrict`.

## Tarefas
1. **Modelo `WebhookEvent`:**
   - campos: `id`, `accountId`, `idempotencyKey` único, `type`, `payload` JSON, `status` (RECEIVED, PROCESSING, DONE, FAILED, DEAD), `attempts`, `lastError`, `receivedAt`, `processedAt`;
   - chave de idempotência: `mid` da mensagem, `comment_id`, `mid` do postback ou um hash estável de `sender + timestamp + payload`.
2. **Webhook:**
   - verificar a assinatura;
   - validar com Zod;
   - **gravar o `WebhookEvent`** (P2002 = duplicado → responder 200 e parar);
   - enfileirar o processamento;
   - responder 200;
   - se a gravação falhar → 500, para a Meta tentar de novo.
3. **Worker (fila):**
   - reivindicar o evento de forma atômica (`updateMany` com o status esperado, conferindo `count===1`);
   - processar e marcar DONE ou FAILED;
   - backoff exponencial para erros `retryable`;
   - DEAD depois de N tentativas, com alerta.
4. **Contato:** `prisma.contact.upsert` com `accountId_igsid`.
5. **Mensagem:** `create` + P2002 devolve `{duplicate:true}`.
6. **FlowRun:**
   - status `FAILED` e campo `error`;
   - índice único parcial `(contactId, flowId) WHERE status IN ('RUNNING','WAITING_CLICK','WAITING_DELAY')` via SQL na migration;
   - reivindicação atômica em `resumeFlowOnClick`;
   - `orderBy startedAt desc`.
7. **Motor:**
   - todo envio verifica o resultado;
   - em falha: `Message.error`, `FlowRun` FAILED com o motivo, o fluxo para;
   - nada fica "aguardando" depois de uma falha.
8. **`checkUserFollows`:** devolve três estados (`true`, `false` ou `unknown`). Com `unknown`, tentar de novo sem punir o lead.
9. **Limites da Meta por conta:** respeitar os limites atuais (confirme na doc; por exemplo, private replies ~750/h) dentro do worker.
10. **Painel "Envios com falha":** mostrar no painel ou em Conversas os envios com falha, com motivo legível e opção de reenviar quando permitido.
11. **Consultas:**
    - o matcher busca só os gatilhos (`trigger.findMany` filtrado por tipo e conta) e carrega os nós apenas do fluxo encontrado;
    - paginação por cursor no inbox e nos contatos;
    - prévia da última mensagem desnormalizada em `Contact`.
12. **Banco:** índices listados acima; pool `pg` com `max` pequeno; soft-delete de fluxos; regras de cascata revisadas.

## Arquivos que este item possui
`src/app/api/webhook/instagram/route.ts` (fluxo de recebimento), `src/lib/queue/*` (novo), `src/lib/engine/contacts.ts`, `src/lib/engine/runner.ts` (estados e falhas), `src/lib/engine/matcher.ts` (consulta), `src/lib/prisma.ts` (pool), a parte de schema/índices (envie ao orquestrador) e o componente do painel de falhas.

## Agentes e skills
- **Agentes:** `database-reviewer`, `silent-failure-hunter`, `typescript-reviewer`, `performance-optimizer`, `code-reviewer`, `tdd-guide`.
- **Skills:** `postgres-patterns`, `prisma-patterns`, `database-migrations`, `upstash-qstash` / `inngest` / `trigger-dev` (conforme a escolha), `error-handling-patterns`, `backend-patterns`.

## Testes
- O mesmo evento entregue 2 vezes (e 5 vezes em paralelo) gera exatamente **1** DM.
- `Promise.all` com 10 eventos do mesmo contato novo cria **1** contato.
- Clique duplo no botão retoma o fluxo **1** vez.
- Falha de envio (Graph simulada com 500 ou 190) deixa o `FlowRun` FAILED, grava `Message.error` e para o fluxo.
- Erro `retryable` faz o worker tentar de novo com backoff; após N tentativas vira DEAD + alerta.
- Banco fora do ar no recebimento → 500, e a Meta vai tentar de novo.
- **Carga:** 50 a 100 webhooks assinados em rajada (script em `scripts/`) → p95 de resposta < 1s, nenhuma duplicata, todos processados (atende o REQ-019).
- **Navegador:** o painel de falhas mostra um envio que falhou, com motivo legível.

## Critérios de aceite
- [ ] Idempotência comprovada pelos testes acima.
- [ ] Webhook responde em p95 < 1s sob carga, com evidência do script.
- [ ] Nenhuma falha de envio fica invisível; o painel mostra o motivo.
- [ ] Migration única, revisada pelo `database-reviewer` e aplicada no banco de teste; `migrate status` limpo.
- [ ] `PRD_TRACEABILITY.md` (REQ-019) e `docs/ARCHITECTURE.md` atualizados.
