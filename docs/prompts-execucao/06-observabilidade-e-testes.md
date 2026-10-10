# PROMPT 06 — Observabilidade (Sentry, logs, alertas) e suíte de testes completa + CI

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> **6a (observabilidade)** entra na Onda A, em paralelo. **6b (testes e CI)** fecha na Onda E, mas cada item já escreve os próprios testes por TDD.

## Papel
Você garante que nenhum erro em produção passa despercebido e que o projeto tem uma rede de testes que impede regressões: cobertura de pelo menos 80%, testes de integração com Postgres, E2E com Playwright e CI.

## Leitura obrigatória específica
`CLAUDE.md` (comandos de validação), `docs/RULES.md`, `execution/EXECUTION_RULES.md`, `execution/CURRENT_TASK.md` (**NANO-002**: testes de `getUserMedia` e `GET /api/instagram/media` em `src/lib/meta/graph.test.ts` — inclua aqui), `PRD_TRACEABILITY.md` (coluna "Teste Associado" de cada REQ), `reports/*.md`, `vitest.config.mts`.

## Evidências da auditoria
- **Observabilidade:** não há Sentry, logger nem `instrumentation.ts`; só 2 ou 3 `console.*`. Exceções no webhook somem.
- **Testes:**
  - 51 testes, em 4 arquivos, só unitários; cobertura estimada em 20–25%;
  - nada em `src/app` tem teste;
  - não há banco de teste nem E2E;
  - `store.test.ts` escreve no arquivo real;
  - `graph.ts` entra em modo mock quando `NODE_ENV==="test"`, então os caminhos reais de `fetch` nunca foram testados.
- **Lint:** `eslint` com 81 erros, a maioria `no-explicit-any`. Alguns escondem bugs reais:
  - `runner.ts:36,83,89,103,138,141,240,264,276`: dados dos nós sem tipo;
  - `matcher.ts:7,8,68`;
  - `contacts.ts:76,103`;
  - `webhook.ts:84`;
  - `route.ts:46`.

## Tarefas
### 6a — Observabilidade (Onda A)
1. **`@sentry/nextjs`** via `instrumentation.ts` (servidor, edge e cliente):
   - `beforeSend` remove dados pessoais e segredos (token, `igsid`, texto das mensagens);
   - tags `accountId`, `flowId`, `runId`;
   - releases com sourcemaps enviados ao Sentry e **não** publicados.
2. **Logger estruturado** (`pino` ou equivalente) em `src/lib/log.ts`, substituindo `console.*` nos módulos de servidor, com níveis e correlação por `webhookEventId`.
3. **Alertas:**
   - falha de assinatura em sequência;
   - eventos DEAD;
   - token 190;
   - taxa de falha de envio acima de X%;
   - health check vermelho.
4. **Uptime externo** (Better Stack, UptimeRobot ou similar) em `/api/health`. O dono configura; você entrega o passo a passo.

### 6b — Testes e CI (Onda E)
1. **Configuração:**
   - `@vitest/coverage-v8` com limite de **80%** em `src/lib/**` e `src/app/api/**` (linhas, funções e ramos);
   - script `test:coverage` no `package.json`.
2. **Unitários que faltam** (o plano mínimo da auditoria):
   - `webhook.test.ts`: assinatura, parser, eco e payloads malformados;
   - `api/webhook/instagram/route.test.ts`: GET, POST, assinatura, JSON inválido, idempotência, evento com erro sem derrubar os outros;
   - `graph.test.ts` (**inclui a NANO-002**, `getUserMedia` e a rota `/api/instagram/media`) com `fetch` simulado e ambiente de produção simulado;
   - `runner.test.ts`: cada nó, falhas, janela, DELAY, private reply;
   - `contacts.test.ts`;
   - `api/l/[code]/route.test.ts`;
   - `window.test.ts`: exatamente 24h, 23h59, data inválida, data futura;
   - server actions: autenticação, Zod, isolamento entre contas, tokens mascarados.
3. **Integração** com Postgres de teste: banco descartável por execução (schema aleatório ou container) com `prisma migrate deploy`; fluxo webhook → banco → envio com a Graph simulada.
4. **E2E com Playwright:**
   - login;
   - criar automação simples;
   - escolher post (com a API de mídia simulada no nível da rede);
   - publicar;
   - simular POST de webhook assinado;
   - ver a mensagem em Conversas;
   - salvar em Ajustes;
   - estados de erro com o banco fora do ar;
   - para o editor avançado, use os seletores da skill `react-flow` (`references/e2e-testing.md`).
5. **CI** (GitHub Actions), com tudo verde obrigatório para merge:
   - `npm ci`;
   - `npx eslint .` (**zero erros**);
   - `npx tsc --noEmit`;
   - testes com cobertura;
   - serviço `postgres` para os testes de integração;
   - `next build`;
   - Playwright;
   - `npm audit --omit=dev --audit-level=high`.
6. **Lint:**
   - corrigir os 81 erros;
   - tipar os dados dos nós com a união dos schemas Zod de `src/lib/flow/schema.ts`, o que deve expor em compilação os bugs que o item 3 corrigiu;
   - corrigir também as regras de React hooks (`set-state-in-effect` em `InboxClient.tsx:73` e outros).

## Arquivos que este item possui
`instrumentation.ts`, `sentry.*.config.ts`, `src/lib/log.ts`, `vitest.config.mts`, `playwright.config.ts`, `tests/e2e/*`, `**/*.test.ts`, `.github/workflows/*`, scripts de teste no `package.json`. As correções de tipo nos arquivos de outros itens só entram **depois** que esses itens forem integrados (Onda E).

## Agentes e skills
- **Agentes:** `pr-test-analyzer` (lacunas antes e depois), `tdd-guide`, `e2e-runner`, `silent-failure-hunter`, `build-error-resolver`, `typescript-reviewer`, `code-reviewer`.
- **Skills:** `tdd-workflow`, `e2e-testing`, `react-testing`, `verification-loop`, `quality-gate`, `github-actions-templates`, `incident-runbook-templates`, `react-flow` (para o E2E do editor).

## Testes desta própria entrega
- Erro proposital em uma rota de teste aparece no Sentry, sem dados pessoais (screenshot do evento).
- Um PR com teste quebrado faz a CI falhar; um PR verde passa.
- O relatório de cobertura mostra ≥80% nos diretórios-alvo.

## Critérios de aceite
- [ ] Sentry + logger + alertas ativos, com evidência; `console.*` removido dos módulos de servidor.
- [ ] Cobertura ≥80% em `src/lib` e `src/app/api`; integração com Postgres verde; E2E verde.
- [ ] `npx eslint .` com **0 erros**; CI obrigatória no repositório.
- [ ] NANO-002 marcada DONE; coluna "Teste Associado" do `PRD_TRACEABILITY.md` aponta para testes reais e verdes.
