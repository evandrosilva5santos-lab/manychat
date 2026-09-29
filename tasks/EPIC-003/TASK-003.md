# TASK-003: Onboarding OAuth Facebook Login e Renovação de Token 60 Dias

> **Epic:** `EPIC-003` (Onboarding OAuth & Segurança)  
> **Fase:** `FASE 5` (Onboarding OAuth & Segurança)  
> **Framework de Engenharia:** Metodologia ECC (Everything Claude Code)  
> **Prioridade:** P1 (Alta)  
> **Origem:** `PRD.md` Módulo 1 (Conexão & Onboarding) e `docs/PRD_ISSUES.md` (`ISSUE-003`)  

---

## 1. Visão Geral da Decomposição ECC

```text
TASK-003: Fluxo OAuth e Ciclo de Vida do Token Meta
├── MICRO-003.01: Fluxo OAuth de Conexão com a Meta
│   ├── NANO-031 [CRITICAL]: Criar rotas `/api/auth/meta/login` e `/api/auth/meta/callback` com troca de code por access_token
│   └── NANO-032 [HIGH]: Salvar e vincular perfil InstagramBusinessAccount na tabela `InstagramAccount`
└── MICRO-003.02: Renovação e Saúde da Conexão
    ├── NANO-033 [HIGH]: Implementar rota de renovação de token 60d `/api/cron/refresh-token` protegida por CRON_SECRET
    └── NANO-034 [MEDIUM]: Criar indicador de status da conexão e dias restantes para expiração em `src/app/ajustes/page.tsx`
```

---

## 2. Especificação Detalhada das Nano Tasks

### NANO-031: Rotas de Conexão OAuth
- **ID:** `NANO-031`
- **TITLE:** Implementar fluxo de autorização Facebook Login for Business
- **RISK LEVEL:** `CRITICAL` (Manipulação direta de tokens OAuth da Meta e redirecionamentos externos).
- **OBJECTIVE:** Permitir que o usuário clique em "Conectar Instagram" e seja autenticado com segurança com escopos `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`.
- **SOURCE REQUIREMENT:** `PRD.md` Seção 3 (Módulo 1).
- **BUSINESS CONTEXT:** Onboarding sem atrito para conectar qualquer conta de cliente.
- **TECHNICAL CONTEXT:** Rotas Next.js App Router em `src/app/api/auth/meta/`.
- **PRECONDITIONS:** `EPIC-001` e `EPIC-002` concluídos.
- **DEPENDENCIES:** N/A.
- **ALLOWED FILES:**
  - `src/app/api/auth/meta/login/route.ts`
  - `src/app/api/auth/meta/callback/route.ts`
  - `src/lib/meta/oauth.ts`
- **FORBIDDEN FILES:**
  - `src/components/*`
  - `src/lib/engine/*`
- **RESEARCH REQUIRED:** Sim (documentação do Facebook Login for Business v21.0).
- **RESEARCH QUESTIONS:** Quais os escopos mínimos obrigatórios para envio de DMs e leitura de comentários? (`instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`).
- **IMPLEMENTATION ACTION:**
  1. Criar gerador de URL OAuth com state anti-CSRF aleatório.
  2. Implementar rota de callback que recebe o `code`, troca por `short_lived_token` e imediatamente troca por `long_lived_token` de 60 dias (`fb_exchange_token`).
- **EXPECTED RESULT:** Token de 60 dias obtido com sucesso e sem exposição de segredos.
- **ACCEPTANCE CRITERIA:**
  - State validado para mitigar CSRF.
  - Criptografia simétrica antes de persistir no banco.
- **TEST STRATEGY:** Mock da chamada à Graph API no Vitest validando a troca de tokens.
- **VALIDATION STRATEGY:**
  - *Level 1:* `npx tsc --noEmit` limpo.
  - *Level 2:* Testes de rota passando.
  - *Level 3:* Atendimento ao requisito REQ-001.
- **REVIEW STRATEGY:** Auditoria de segurança independente (Security Review).
- **SECURITY CONSIDERATIONS:** OWASP Top 10 - Mitigação estrita de CSRF, proteção do `META_APP_SECRET`.
- **PERFORMANCE CONSIDERATIONS:** Troca assíncrona com timeout.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** Fechar pendência de OAuth em `docs/DECISIONS.md`.
- **NEXT TASK:** `NANO-032`.

---

### NANO-032: Persistência da Conta Vinculada
- **ID:** `NANO-032`
- **TITLE:** Vincular e atualizar a conta do Instagram conectada na tabela `InstagramAccount`
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Atualizar os dados de `igUserId`, `username`, `accessTokenEnc` e status `ACTIVE` no banco de dados.
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 1 / `SCHEMA.md`.
- **BUSINESS CONTEXT:** Habilitar os fluxos daquela conta para funcionamento em produção.
- **TECHNICAL CONTEXT:** Prisma client em `src/lib/prisma.ts`.
- **PRECONDITIONS:** `NANO-031` concluída.
- **DEPENDENCIES:** `NANO-031`.
- **ALLOWED FILES:**
  - `src/app/api/auth/meta/callback/route.ts`
  - `src/lib/account.ts`
- **FORBIDDEN FILES:**
  - `src/proxy.ts`
  - `src/components/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Upsert no Prisma para o `igUserId`, associando o webhook e chamando `defaultGraphClient.subscribeWebhooks(igUserId)`.
- **EXPECTED RESULT:** Registro salvo no banco e inscrição automática nos webhooks da página.
- **ACCEPTANCE CRITERIA:** Tratar falha de inscrição de webhook sem perder o token.
- **TEST STRATEGY:** Teste unitário de upsert de conta.
- **VALIDATION STRATEGY:**
  - *Level 1:* Zero erros TypeScript.
  - *Level 2:* Testes de integração com banco mock/sqlite.
  - *Level 3:* Atendimento ao PRD.
- **REVIEW STRATEGY:** Checar se o token anterior é revogado de forma limpa.
- **SECURITY CONSIDERATIONS:** Nunca gravar token em texto claro caso haja módulo de criptografia ativo.
- **PERFORMANCE CONSIDERATIONS:** Operação atômica.
- **DESIGN CONSIDERATIONS:** Redirecionar para `/ajustes?connected=true`.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-033`.

---

### NANO-033: Rota de Renovação de Token 60 Dias (Cron Job)
- **ID:** `NANO-033`
- **TITLE:** Criar endpoint de renovação periódica de tokens do Instagram
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Evitar expiração silenciosa dos tokens a cada 60 dias através de chamada automática agendada.
- **SOURCE REQUIREMENT:** `docs/PRD_ISSUES.md` (`ISSUE-003`).
- **BUSINESS CONTEXT:** Automações rodando continuamente sem interrupção de serviço para o cliente.
- **TECHNICAL CONTEXT:** Rota `src/app/api/cron/refresh-token/route.ts` protegida por header `Authorization: Bearer ${CRON_SECRET}`.
- **PRECONDITIONS:** `NANO-032` concluída.
- **DEPENDENCIES:** `NANO-032`.
- **ALLOWED FILES:**
  - `src/app/api/cron/refresh-token/route.ts`
  - `src/lib/meta/graph.ts`
- **FORBIDDEN FILES:**
  - Todos os arquivos fora da pasta API.
- **RESEARCH REQUIRED:** Sim (verificar regras do endpoint `refresh_access_token` da Meta).
- **RESEARCH QUESTIONS:** A Meta só permite renovar tokens que tenham pelo menos 24 horas de vida e menos de 60 dias.
- **IMPLEMENTATION ACTION:** Iterar sobre as contas com tokens próximos de expirar (< 15 dias) e chamar `refreshLongLivedToken()`.
- **EXPECTED RESULT:** Tokens atualizados no banco com nova validade estendida por mais 60 dias.
- **ACCEPTANCE CRITERIA:** Rejeitar requisições sem o `CRON_SECRET` correto (401 Unauthorized).
- **TEST STRATEGY:** Teste no Vitest simulando a renovação e checagem de auth.
- **VALIDATION STRATEGY:**
  - *Level 1:* Type check limpo.
  - *Level 2:* Vitest passando.
  - *Level 3:* Resolução definitiva da `ISSUE-003`.
- **REVIEW STRATEGY:** Fresh context review focado em proteção contra acessos externos não autorizados.
- **SECURITY CONSIDERATIONS:** Header de autenticação mandatório com `timingSafeEqual`.
- **PERFORMANCE CONSIDERATIONS:** Executar em lote com delay entre requisições para evitar rate limit.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Atualizar status da `ISSUE-003` para `RESOLVED` em `docs/PRD_ISSUES.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-034`.

---

### NANO-034: Indicador de Saúde da Conexão em Ajustes
- **ID:** `NANO-034`
- **TITLE:** Exibir status da conexão, nome do perfil e dias restantes do token em `/ajustes`
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Dar transparência ao operador sobre a validade e status ativo da conta do Instagram.
- **SOURCE REQUIREMENT:** `docs/DESIGN.md` e `PRD.md` Módulo 6.
- **BUSINESS CONTEXT:** Previsibilidade para o cliente saber quando a conta precisa de reconexão.
- **TECHNICAL CONTEXT:** `src/app/ajustes/page.tsx`.
- **PRECONDITIONS:** `NANO-033` concluída.
- **DEPENDENCIES:** `NANO-033`.
- **ALLOWED FILES:**
  - `src/app/ajustes/page.tsx`
  - `src/app/ajustes/AjustesClient.tsx`
- **FORBIDDEN FILES:**
  - `src/app/api/webhook/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Adicionar badge de status (Verde = Conectado, Amarelo = Expirando em breve, Vermelho = Desconectado) e botão de "Reconectar".
- **EXPECTED RESULT:** Visualização clara do estado da integração.
- **ACCEPTANCE CRITERIA:** Seguir design system com tokens de cor e bordas padronizadas.
- **TEST STRATEGY:** Validação visual no browser.
- **VALIDATION STRATEGY:**
  - *Level 1:* Sem erros no console.
  - *Level 2:* Integração com API de ajustes.
  - *Level 3:* Conformidade de UX.
- **REVIEW STRATEGY:** Verificar responsividade em desktop e mobile.
- **SECURITY CONSIDERATIONS:** Não renderizar o token completo (apenas máscara `EAAB...xyz`).
- **PERFORMANCE CONSIDERATIONS:** Renderização estática com hidratação leve.
- **DESIGN CONSIDERATIONS:** Badge pill conforme `docs/DESIGN.md`.
- **DOCUMENTATION IMPACT:** Concluir `EPIC-003` em `execution/TASK_QUEUE.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** Início do `EPIC-004`.
