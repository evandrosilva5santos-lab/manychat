# BLOCKERS — Registro de Impedimentos e Bloqueios Operacionais

> **Documento:** Painel de Bloqueios e Dependências Ativas  
> **Status:** Ativo  
> **Regra:** Se uma tarefa encontrar um bloqueio ou inconsistência na validação, o agente deve registrar imediatamente aqui e parar a execução.  

---

## Bloqueios Ativos (`OPEN`)

### BLK-008: Migration de opt-out ainda não aplicada no banco
- **DATE:** 2026-10-12
- **DESCRIPTION:** `prisma/migrations/20261012230000_contact_opt_out` (só adiciona `Contact.optedOut` e `optedOutAt`) foi escrita à mão e não rodou em nenhum banco. O código já lê essas colunas: **sem a migration, o worker falha** ao filtrar esperas e ao ler contatos.
- **REQUIRED ACTION:** aplicar antes (ou junto) do próximo deploy — `npx prisma migrate deploy` em produção, que o `vercel-build` já faz só em `VERCEL_ENV=production`.
- **OWNER:** dono (deploy)
- **STATUS:** `OPEN`

### BLK-009: Política de opt-out a confirmar
- **DATE:** 2026-10-12
- **DESCRIPTION:** implementada a política padrão do item 8a: só a mensagem inteira conta ("parar", "sair", "stop", "cancelar"); reativação só com "voltar"; confirmação enviada dentro da janela de 24h; comentário não conta.
- **REQUIRED DECISION:** dono confirma as palavras e a forma de reativação (o prompt 08 sugere reativar quando a pessoa escrever de novo).
- **STATUS:** `OPEN` (não bloqueia; o padrão é o mais conservador)

---

## Bloqueios Resolvidos (`RESOLVED`)

### BLK-003: Sincronização e Validação da NANO-001
- **ID:** `BLK-003`
- **DATE:** 2026-09-28 23:45
- **RESOLVED DATE:** 2026-09-29 02:50
- **SOURCE:** Auditoria de Validação do Claude (Fase 10) / Antigravity
- **DESCRIPTION:** A `NANO-001` havia sido codificada no ambiente do volume externo e necessitava de sincronização, unificação de tipos TypeScript e validação de runtime no diretório oficial.
- **RESOLUTION:** Código sincronizado e integrado em `/Users/evandro/Downloads/Manychat`, `InstagramMediaItem` duplicado corrigido, endpoint `GET /api/instagram/media` validado via runtime com HTTP 200 e payload mock completo, `npx tsc --noEmit` zerado e 51/51 testes passando.
- **STATUS:** `RESOLVED`

### BLK-001: Exigência de Basic Auth no Proxy Local
- **ID:** `BLK-001`
- **DATE:** 2026-09-28
- **SOURCE:** Auditoria Técnica QA / Antigravity
- **DESCRIPTION:** O proxy `src/proxy.ts` interceptava chamadas em `localhost:3007` exigindo cabeçalho de autenticação básica HTTP, impedindo requisições de subagentes e ferramentas de teste.
- **IMPACT:** Bloqueava testes e navegação automática sem credenciais hardcoded.
- **BLOCKED TASK:** Nenhuma tarefa específica; impedia testes automatizados.
- **REQUIRED DECISION:** Desativar a exigência de Basic Auth em ambiente de desenvolvimento local (formalizado em `docs/DECISIONS.md` via `ADR-002`).
- **OWNER:** Antigravity / Engenharia
- **STATUS:** `RESOLVED`

---

### BLK-002: Desconexão da Mídia Real da Meta no Seletor de Posts
- **ID:** `BLK-002`
- **DATE:** 2026-09-28
- **SOURCE:** Auditoria Inicial / Análise de Código
- **DESCRIPTION:** O componente `PostPicker.tsx` operava exclusivamente com array estático `MOCK_POSTS` sem endpoint de backend para consumir a Meta Graph API.
- **IMPACT:** O usuário não conseguia selecionar suas postagens reais publicadas no Instagram.
- **BLOCKED TASK:** `TASK-001`
- **REQUIRED DECISION:** Decompor a integração em 4 nano tasks com fallback gracioso para mock (`ADR-004`).
- **OWNER:** Antigravity / Claude Code
- **STATUS:** `RESOLVED` (Desbloqueada para início através de `NANO-001`).


## BLK-ITEM-03 — Integração Meta (2026-10-10, OPEN)
Confirmação de Instagram Login pendente; TrackedLink ausente; fallback local ainda presente; banco/conta de teste não identificados; alterações concorrentes em autenticação/segurança/webhook observadas. TypeScript e suíte completa não passaram. Continuar após resolver propriedade dos arquivos e decisões pendentes. Evidências: [ITEM-03-REPORT.md](ITEM-03-REPORT.md).
