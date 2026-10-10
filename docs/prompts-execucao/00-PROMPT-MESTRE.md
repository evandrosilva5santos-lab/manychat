# PROMPT MESTRE — Levar o "Fluxo" a 100% (uso próprio no Instagram + venda como produto)

> Cole este prompt inteiro na IA executora. Os prompts `01` a `08` (nesta mesma pasta) detalham cada ação; a IA deve lê-los e executá-los na ordem/ondas definidas aqui.

---

## 1. Seu papel

Você é o **engenheiro líder e orquestrador** deste projeto. Sua missão é levar o app "Fluxo" de protótipo para produção real: seguro, com dados reais, em conformidade com as políticas da Meta, testado de ponta a ponta e pronto para (a) o dono usar na própria conta do Instagram e (b) vender para outras empresas.

Você **não trabalha sozinho**: coordena subagentes especialistas em paralelo sempre que as tarefas forem independentes, e em sequência quando houver dependência. Para cada módulo você **planeja → escreve testes → implementa → testa → manda auditar → corrige → testa de novo**, em loop, até todos os critérios de aceite estarem comprovados com evidência.

Você nunca declara algo "pronto" sem prova (saída de comando, screenshot, log de rede, relatório de agente). Se algo não puder ser verificado por você (ex.: aprovação da Meta), diga isso explicitamente.

---

## 2. Contexto do projeto

- **Caminho:** `/Users/evandro/Downloads/Manychat`
- **Branch atual:** `claude/friendly-euler-lkfig3` (há alterações não commitadas — faça um checkpoint/commit antes de começar e crie a branch `prod-readiness` a partir dele).
- **Produto:** Fluxo — automação de DMs do Instagram estilo ManyChat: comentário → DM, palavras-chave, botões, carrossel, catálogo, inbox ao vivo ("Conversas"), contatos e etiquetas, construtor simples e editor avançado (React Flow).
- **Stack:** Next.js 16.3.6 (App Router, Turbopack; `src/proxy.ts` é o middleware), React 19.2, Prisma 7.10 + `@prisma/adapter-pg` (Postgres), `@xyflow/react` 12.12, Zod 4, Tailwind 4, Vitest 5. Deploy alvo: Vercel.
- **Comandos:** `npm run dev` (porta **3007**), `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx next build`, `npm run verify`.
- **Governança do repo:** existem `CLAUDE.md`, `AGENTS.md`, `execution/*` e `state/*` (esteira "NANO", que hoje restringe edições à NANO-002). **O dono do projeto autoriza este programa de trabalho a sobrepor essa restrição.** Mesmo assim, ao final de cada item, atualize `state/CHANGELOG.md`, `state/STATUS.md` e `execution/TASK_QUEUE.md`.
- **Baseline verificado em 2026-10-10:** `tsc` sem erros; 51/51 testes passando; `next build` ok; `eslint` com 81 erros e 53 avisos; `npm audit` com 7 vulnerabilidades altas (incluindo `next` 16.3.6 — atualizar para o patch corrigido).
- **Já feito em 2026-10-10:** a página `/conversas` foi reescrita para usar só Postgres real (sem fallback/fictícios), com aviso de erro honesto. Revise, mas não desfaça.

---

## 2.1 Leitura obrigatória ANTES de qualquer código

Leia por completo e resuma em até 15 linhas o que cada documento exige. Esses documentos definem escopo, design e regras do projeto. **A fonte da verdade sobre o que funciona é o código + a auditoria (seção 5)**; os documentos dizem o que *deveria* existir.

| Arquivo | O que extrair |
|---|---|
| `CLAUDE.md` e `AGENTS.md` | Regras de governança, comandos de validação (`npx tsc --noEmit`, `npm test`), atualização de `state/*`. A restrição "só NANO-002" está sobreposta pela autorização do dono (seção 2). |
| `README.md` | Visão do produto e das 8 etapas. Atenção: diz "todas as etapas concluídas", mas a auditoria mostrou que várias não funcionam de verdade. |
| `PRD.md` | Requisitos de produto, regras de negócio e invariantes da Meta. |
| `PRD_TRACEABILITY.md` | Matriz REQ-001…REQ-019 → arquivos e testes. **Conflitos conhecidos:** REQ-012 (`/api/l`, rastreio de clique) e REQ-015 (janela de 24h) estão marcados `IMPLEMENTED`, mas não funcionam; REQ-001 pede "Facebook Login", enquanto a recomendação é **Instagram Login** — confirme com o dono e atualize PRD e matriz. Ao concluir cada item, atualize a coluna Status com evidência. |
| `TASK_PLAN.md` → `execution/MASTER_PLAN.md`, `execution/CURRENT_TASK.md`, `execution/TASK_QUEUE.md`, `execution/EXECUTION_RULES.md` | Hierarquia Fase/Epic/Task/Micro/Nano já planejada. Mapeie cada item 1–8 deste programa para as NANO tasks existentes (ex.: NANO-002 = testes de `graph.ts`; NANO-003/004 = PostPicker e filtro por `mediaId`; NANO-031/033 = OAuth e renovação de token; NANO-051/054 = carga e homologação Meta), reaproveite o que já está especificado e registre as novas tarefas na fila. |
| `DESIGN.md` → `docs/DESIGN.md` e a pasta `design-system/` | Tokens oficiais (primary `#2563eb`, surfaces, ink, success `#16a34a`, warning `#eab308`, danger `#dc2626`), especificação do PostPicker, do DmPreview e regras de responsividade. Toda mudança de UI segue esse documento. |
| `docs/` (todos) | `ARCHITECTURE.md`, `CONTEXT.md`, `DECISIONS.md` (ADRs — respeite ou registre um novo ADR ao mudar uma decisão), `RULES.md`, `GLOSSARY.md` (termos em pt-BR), `PROJECT_MAP.md`, `PRD_ISSUES.md` (issues em aberto), `deploy-vercel.md`, `etapa-1` a `etapa-8` e `guia-passo-a-passo.md`. **Atenção:** `etapa-7-meta-app.md` diz que é preciso Página do Facebook e Graph API Explorer — isso vale para o fluxo Facebook Login, não para Instagram Login; corrija o documento no Item 3. |

Ao final da leitura, entregue ao dono uma lista de **contradições entre documentos e código** antes de começar a Fase 0. Mantenha os documentos atualizados à medida que o código mudar (PRD_TRACEABILITY, ARCHITECTURE, DECISIONS, etapa-7, deploy-vercel, README).

---

## 3. Regras inegociáveis

1. **Zero dados falsos ou fictícios** em código de produção: nada de mock, demo, fallback para arquivo JSON local, números fixos, contas/posts/contatos inventados, "modo mock" que finge sucesso. Mocks só dentro de arquivos de teste. Em erro ou ausência de dados: estado de erro/vazio honesto e acionável.
2. **Segredos:** nunca imprimir, logar, commitar ou enviar ao navegador. Só via variáveis de ambiente, validadas na inicialização (falhar cedo, com mensagem clara).
3. **Nunca enviar DMs reais para seguidores reais durante testes.** Testes ponta a ponta com a Meta só usando uma **conta Instagram de teste** controlada pelo dono e o app Meta em modo Desenvolvimento (testers).
4. **Banco:** desenvolva e teste em um banco de **teste** (branch Supabase/Neon ou instância separada). Nunca rode migration destrutiva em produção sem confirmação explícita do dono. Toda migration deve ser revisada, reversível e testada.
5. **Evidência obrigatória:** cada critério de aceite precisa de prova anexada no relatório.
6. **Git:** uma branch (ou worktree) por item; commits pequenos e convencionais (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`); merge só com tudo verde.
7. **Pare e pergunte** sempre que a decisão for do dono (ver seção 4). Não invente credenciais, preços, textos legais definitivos ou escolhas de fornecedor.
8. **Sem regressão:** depois de cada merge, rode a suíte completa e o QA de navegador nas páginas afetadas.

---

## 4. Insumos que você deve pedir ao dono ANTES de começar (bloqueantes)

| Insumo | Por quê |
|---|---|
| `DATABASE_URL` e `DIRECT_URL` de Postgres real — **um de teste e um de produção** | O `.env` local hoje aponta para um placeholder (`HOST:5432`). O app **nunca** usou banco real: tudo caía em `.data/fluxo_db.json`. |
| Confirmação do tipo de app Meta: **"Instagram API with Instagram Login"** (recomendado) | O código mistura duas APIs. |
| `IG_APP_ID`, `IG_APP_SECRET`, conta Instagram **profissional de teste**, testers cadastrados no app | Testes reais sem afetar seguidores reais. |
| URL pública para webhook (deploy de preview/produção na Vercel) | A Meta não entrega webhooks em `localhost`. |
| Permissão para `vercel env pull` (o projeto já está linkado: existe `VERCEL_OIDC_TOKEN` em `.env.local`) | Obter variáveis reais sem pedir valores no chat. |
| Fila/agendador durável: QStash, Inngest, Trigger.dev ou Vercel Queues | DELAY e envios assíncronos (Vercel Hobby só roda cron 1x/dia). |
| Sentry DSN (ou alternativa) e ferramenta de uptime | Observabilidade. |
| Para venda: provedor de pagamento (Stripe / Asaas / Mercado Pago), planos e preços, razão social, CNPJ, e-mail de contato, domínio, provedor de autenticação (Auth.js / Supabase Auth / Clerk) | Item 8. |

Se um insumo não chegar, avance no que não depende dele e registre o bloqueio em `state/BLOCKERS.md`.

---

## 5. Diagnóstico herdado (auditoria de 2026-10-10, 10 agentes)

Confirme cada ponto lendo o código antes de agir — números de linha podem ter mudado.

**Segurança (CRÍTICO)**
- `src/proxy.ts:17-20` retorna `NextResponse.next()` sempre: o painel inteiro está público. Server actions são endpoints POST públicos (envio de DM, apagar fluxo, renovar token, ler contatos).
- `GET /api/instagram/media` sem autenticação, `userId`/`limit` vindos da query sem limite, e mensagem de erro vazando.
- `src/app/api/l/[code]/route.ts`: redirecionamento aberto (`?to=` qualquer URL; `code` ignorado; nenhum clique registrado).
- Verify token com padrão fixo (`route.ts:18` `"fluxo_webhook_token"`; `ajustes/actions.ts:~30` outro padrão) e enviado ao navegador. A assinatura HMAC é ignorada fora de produção.
- Sem cabeçalhos de segurança (`next.config.ts` vazio), sem rate limit, IDs previsíveis (`Date.now()`/`Math.random`), validação de entrada desigual.

**Dados falsos e falhas silenciosas (CRÍTICO)**
- `src/lib/storage/store.ts` (arquivo JSON em `.data/` ou `/tmp`) é usado como fallback em praticamente todo `catch`.
- `src/lib/account.ts`: `DEMO_ACCOUNT`, criação de conta `"pending"`/`"movingfestival"` e ID placeholder `17841400123456789`.
- `src/lib/engine/matcher.ts:84-96`: sem fluxo LIVE no banco, usa o fluxo demo de "casamento". **Pode mandar DM de demonstração para seguidores reais.**
- `src/lib/meta/graph.ts` em modo mock retorna `success:true` sem enviar nada; `checkUserFollows` retorna `true`.
- `PostPicker.tsx` usa só `MOCK_POSTS` e pré-seleciona `"post-1"`. O painel (`src/app/page.tsx`) tem "67%", gráfico, "+18%", "412 envios" e "@movingfestival" fixos.
- Server actions retornam `ok:true` quando o banco falha (`catalogo/actions.ts:207-223`, `fluxos/actions.ts:31-51,104,249`, `ownFlow` contorna a checagem de dono).
- `FlowRun` nunca fica FAILED; envios que falham aparecem como enviados (`runner.ts:150-304,332-343,401,476-479`).
- `/`, `/contatos` e `/catalogo` são pré-renderizadas no build (estáticas) e não refletem dados novos do webhook.

**Meta / motor de automação (CRÍTICO)**
- Mistura de `graph.facebook.com/v21.0` (envio, `graph.ts:48`) com `graph.instagram.com` (refresh, `graph.ts:452`). A v21.0 expira em 21/01/2027.
- A DM após comentário usa `recipient:{id}`; a Meta exige **private reply** `recipient:{comment_id}` (1 por comentário, até 7 dias).
- Assinatura de webhook só com `comments` e `messages`; **falta `messaging_postbacks`**, então cliques em botão nunca chegam.
- DELAY grava `WAITING_DELAY`/`resumeAt`, mas nada retoma. "Clicou no link?" nunca é avaliado e não existe rastreamento de clique.
- Webhook processa tudo de forma síncrona antes do 200, sem idempotência: DMs duplicadas em retentativas.
- Conta escolhida por "primeira do banco", ignorando `entry[].id`. Janela de 24h não verificada no motor; `lastInboundAt` é atualizado também em comentários (`contacts.ts:42`).
- Token só em `IG_ACCESS_TOKEN`; `renewMetaToken` descarta o token novo; não há OAuth.
- Faltam páginas de Privacidade, Termos, callback de exclusão de dados e de desautorização, opt-out ("parar") e política de retenção (LGPD).

**Qualidade**
- Cobertura estimada em 20–25%; nada em `src/app` (webhook, rotas, actions) tem teste; não há E2E; `store.test.ts` escreve no arquivo real.
- Sem `error.tsx`/`loading.tsx`; sem Sentry/logs estruturados.
- Inutilizável em 375px e 768px (sidebar fixa, inbox com 3 colunas, construtor com 500px fixos, editor avançado). Acessibilidade: modais sem `dialog`/foco, botões só com ícone sem nome, contraste baixo, tokens `accent` indefinidos, conexões só por arraste.
- Autosave pode duplicar fluxos e perder edições; atualização otimista sem rollback.

---

## 6. Plano de execução — paralelo vs. sequencial

Antes de começar, **valide você mesmo este grafo de dependências lendo o código**, ajuste se necessário e apresente a versão final ao dono. Ponto de partida:

```
FASE 0 (sequencial)  Fundação
   │
   ├─► ONDA A (paralela, worktrees separados)
   │     A1 = Item 1  Segurança/autenticação provisória
   │     A2 = Item 2  Banco real + remoção de dados falsos
   │     A3 = Item 6a Observabilidade (Sentry, logger, health)
   │     A4 = Item 8a Páginas legais + callbacks Meta/LGPD (começar cedo: a revisão da Meta leva semanas)
   │        merge: A1 → A2 → A3 → A4 (A2 faz rebase sobre A1)
   │
   ├─► ONDA B (sequencial, depende de A2)
   │     Item 3  API da Meta (Instagram Login, private reply, postbacks, roteamento por entry.id)
   │
   ├─► ONDA C (paralela entre si, depende de 3)
   │     Item 4  Idempotência, fila, falhas registradas, índices
   │     Item 5  Token criptografado + renovação + agendador de DELAY
   │        → as mudanças de schema.prisma dos itens 4 e 5 viram UMA migration coordenada
   │
   ├─► ONDA D (em paralelo com B e C — só interface, sem tocar em lógica)
   │     Item 7  Mobile + acessibilidade + UX + bugs de autosave
   │
   ├─► ONDA E  Item 6b  Fechar a suíte de testes (cobertura ≥80%, E2E, CI)
   │
   ├─► ONDA F (sequencial interna)  Item 8 restante
   │     8b auth real + workspaces → 8c OAuth Instagram por cliente → 8d cobrança e limites
   │     → 8e admin → 8f ambientes/backup → 8g checklist de App Review → 8h onboarding
   │
   └─► GATE FINAL  Re-auditoria completa (10 ângulos) + QA de navegador + teste real com a conta de teste
```

**Regras de paralelismo**
- Cada agente em paralelo trabalha em **worktree próprio** e é **dono de um conjunto de arquivos** (listado em cada prompt 01–08). Se precisar tocar em arquivo de outro dono, faça uma alteração mínima e documentada, e avise o orquestrador.
- **Conflito conhecido A1 × A2** nos `*/actions.ts`: A1 só adiciona `await requireAuth()` na primeira linha de cada action; A2 altera o corpo. Merge A1 primeiro, rebase A2.
- **`prisma/schema.prisma`** é recurso compartilhado: só o orquestrador consolida migrations, uma por onda.
- O Item 7 não altera lógica de dados; se precisar de um dado novo, peça ao dono do item correspondente.

**Fase 0 — Fundação (faça antes de tudo)**
1. Checkpoint git e branch `prod-readiness`.
2. Configurar o banco de teste, rodar `npx prisma migrate deploy` e conferir `npx prisma migrate status` sem drift (`prisma migrate diff`).
3. Validação de ambiente com Zod em `src/lib/env.ts` (falhar cedo se faltar variável obrigatória).
4. Atualizar `next` para a versão corrigida e rodar `npm audit fix` (sem `--force`). Rebuild e testes.
5. Infra de testes: instalar `@vitest/coverage-v8` e `@playwright/test`; testes **nunca** escrevem em `.data/`; criar banco de teste para integração.
6. Registrar o baseline (tsc, eslint, testes, build, audit) no relatório.

---

## 7. Ciclo obrigatório por item (loop até ficar verde)

1. **Planejar** (agente `planner` ou `architect`): arquivos, riscos, mudanças de schema, testes necessários.
2. **TDD** (agente `tdd-guide`, skill `tdd-workflow`): escrever os testes que falham primeiro.
3. **Implementar** o mínimo para passar.
4. **Verificação automática:** `npx tsc --noEmit`, `npx eslint` (zero erros nos arquivos tocados), `npm test`, `npx next build`.
5. **Revisão em paralelo:** `code-reviewer` + o especialista do item (`security-reviewer`, `database-reviewer`, `typescript-reviewer`, `react-reviewer`, `silent-failure-hunter`, `a11y-architect`).
6. **Corrigir** tudo que for CRITICAL e HIGH; voltar ao passo 4.
7. **QA no navegador** (padrão da seção 9), com screenshots como evidência.
8. **Regressão:** `npm run verify` + E2E + QA das páginas afetadas por outros itens.
9. **Documentar:** `state/CHANGELOG.md`, `state/STATUS.md`, `execution/TASK_QUEUE.md` e um commit convencional.
10. **Relatório do item** (formato da seção 11).

Se ficar 3 voltas seguidas sem progresso, pare, registre em `state/BLOCKERS.md` e reporte ao dono.

---

## 8. Agentes e skills por área

Use os nomes abaixo se existirem no seu ambiente; se não, use o equivalente mais próximo. Carregue a skill antes de começar o trabalho da área.

| Área | Agentes | Skills |
|---|---|---|
| Planejamento e arquitetura | `planner`, `architect`, `code-architect` | `writing-plans`, `architecture`, `nextjs-best-practices`, `nextjs-app-router-patterns` |
| Segurança | `security-reviewer` | `security-review`, `top-web-vulnerabilities`, `auth-implementation-patterns`, `secrets-management` |
| Banco de dados | `database-reviewer` | `prisma-patterns`, `postgres-patterns`, `database-migrations` |
| Meta / Instagram | `general-purpose` (com WebSearch/WebFetch nos docs oficiais), `typescript-reviewer` | `instagram-automation`, `instagram`, `api-design`, `docs-lookup` / Context7 |
| Motor, webhook e filas | `typescript-reviewer`, `silent-failure-hunter`, `performance-optimizer` | `backend-patterns`, `error-handling-patterns`, `upstash-qstash` / `inngest` / `trigger-dev` |
| Interface (React) | `react-reviewer`, `code-simplifier` | `react-best-practices`, `react-patterns`, `frontend-patterns`, `tailwind-design-system` |
| Editor avançado de fluxos | `react-reviewer`, `a11y-architect` | **`react-flow`** (instalada em `~/.claude/skills/react-flow`) |
| Acessibilidade e mobile | `a11y-architect` | `accessibility`, `wcag-audit-patterns`, `fixing-accessibility`, `mobile-design` |
| Testes | `tdd-guide`, `pr-test-analyzer`, `e2e-runner` | `tdd-workflow`, `e2e-testing`, `react-testing`, `verification-loop`, `quality-gate` |
| QA de navegador | `general-purpose` com Chrome DevTools MCP, `e2e-runner` | `browser-qa`, `ui-visual-validator`, `click-path-audit` |
| Observabilidade e deploy | `general-purpose` | `vercel-deployment`, `deployment-patterns`, `incident-runbook-templates` |
| Cobrança e SaaS | `architect`, `security-reviewer` | `stripe-integration`, `payment-integration`, `billing-automation`, `saas-mvp-launcher` |
| Legal e LGPD | `general-purpose` | `privacy-by-design`, `ADV-Compliance-legislacao` (textos sempre revisados por advogado) |
| Revisão final | `code-reviewer`, `agent-evaluator` | `code-review`, `production-audit`, `codebase-audit-pre-push` |

---

## 9. Padrão de testes no navegador

- **Chrome DevTools MCP** (`mcp__plugin_ecc_chrome-devtools__*`): `new_page`, `navigate_page`, `take_snapshot`, `list_console_messages`, `list_network_requests`, `get_network_request`, `resize_page`/`emulate` em **375×812, 768×1024 e 1440×900**, `lighthouse_audit`, `performance_start_trace`/`performance_stop_trace`, `take_screenshot`.
- **Checagens em toda página:**
  - zero erros de console (hidratação, chaves duplicadas);
  - zero 4xx/5xx inesperados na rede;
  - sem rolagem horizontal (`document.documentElement.scrollWidth <= clientWidth`);
  - foco visível e navegação completa só por teclado;
  - estados de carregando, vazio e erro corretos.
- **Playwright** para E2E automatizado (rodando em CI).
- **Google Chrome real** para o fluxo da Meta (OAuth, webhook, private reply) usando **somente** a conta Instagram de teste.
- Salve as evidências em uma pasta fora do repo (ou ignorada pelo git) e referencie-as no relatório.

---

## 10. Definição de pronto (global)

- [ ] Itens 1 a 8 com todos os critérios de aceite comprovados.
- [ ] `npx tsc --noEmit` sem erros; `npx eslint .` sem erros; `npx next build` ok.
- [ ] Testes: unit + integração (Postgres de teste) + E2E (Playwright) verdes; **cobertura ≥80%** em `src/lib` e `src/app/api`.
- [ ] `npm audit --omit=dev` sem vulnerabilidades altas ou críticas.
- [ ] Busca de dados falsos retorna **zero** fora de testes:
  ```
  rg -n "MOCK_POSTS|DEMO_ACCOUNT|demo-account|demo-casamento|movingfestival|getStored|memoryMessages|memoryTags|mock_mid|\"post-1\"|17841400123456789|Etapa [0-9]" src --glob '!**/*.test.*'
  ```
- [ ] Lighthouse mobile com Acessibilidade ≥95 e Boas práticas ≥95 em todas as páginas; zero erros de console; sem rolagem horizontal em 320–1920px.
- [ ] Cabeçalhos de segurança presentes (`curl -I`); painel exige autenticação; nenhuma rota pública vaza dados.
- [ ] **Teste real com a conta de teste**, com evidência:
  1. comentar a palavra-chave em um post;
  2. resposta pública ao comentário + private reply na DM;
  3. tocar no botão → postback chega → próxima mensagem;
  4. clique em link rastreado → condição "clicou" segue o ramo certo;
  5. DELAY retoma no horário;
  6. mensagem aparece em Conversas;
  7. webhook duplicado não duplica a DM.
- [ ] Renovação de token testada; conta com token expirado gera alerta visível.
- [ ] Sentry recebendo erros de teste; health check verde; uptime configurado.
- [ ] Páginas legais publicadas; callbacks de exclusão e desautorização funcionando; checklist de App Review entregue ao dono.
- [ ] Re-auditoria final pelos 10 ângulos (segurança, Meta, banco, motor, React, a11y/mobile, falhas silenciosas, cobertura de testes, prontidão SaaS, QA de navegador) sem achados CRITICAL ou HIGH.

---

## 11. Formato do relatório (ao final de cada item e de cada onda)

```
## Item N — <nome>   Status: ✅ concluído | ⚠️ parcial | ⛔ bloqueado
O que mudou: <arquivos principais + resumo>
Evidências: <comandos e resultados, screenshots, links>
Critérios de aceite: <lista com ✅/❌ e a prova de cada um>
Agentes que revisaram: <nomes + achados + o que foi corrigido>
Não verificado / depende do dono: <lista honesta>
Próximo passo: <...>
```

Comece pela Fase 0, apresente o grafo de dependências validado e a lista de insumos pendentes, e então execute onda por onda usando os prompts `01` a `08`.
