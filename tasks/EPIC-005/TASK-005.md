# TASK-005: Verificação de Qualidade, Stress Test e Deploy Vercel

> **Epic:** `EPIC-005` (QA Final, E2E & Produção)  
> **Fase:** `FASE 6` (QA Final, E2E & Produção)  
> **Framework de Engenharia:** Metodologia ECC (Everything Claude Code)  
> **Prioridade:** P1 (Alta)  
> **Origem:** `PRD.md` Seção 7 (Critérios de Aceitação do MVP)  

---

## 1. Visão Geral da Decomposição ECC

```text
TASK-005: Homologação Final e Lançamento
├── MICRO-005.01: Testes E2E e Stress Test de Webhook
│   ├── NANO-051 [HIGH]: Criar script de stress test simulando 100 webhooks concorrentes com validação HMAC
│   └── NANO-052 [MEDIUM]: Executar auditoria visual completa de acessibilidade e dark/light mode
└── MICRO-005.02: Pipeline de Produção e Deploy
    ├── NANO-053 [HIGH]: Validar migrações Prisma em produção e variáveis de ambiente na Vercel
    └── NANO-054 [CRITICAL]: Executar teste de fumaça (smoke test) em ambiente de staging/produção com Meta real
```

---

## 2. Especificação Detalhada das Nano Tasks

### NANO-051: Stress Test de Webhooks Concorrentes
- **ID:** `NANO-051`
- **TITLE:** Criar script de teste de carga simulando rajada de comentários e DMs concorrentes
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Garantir que o endpoint `/api/webhook/instagram` responda dentro da janela de 3 segundos exigida pela Meta mesmo sob alta concorrência.
- **SOURCE REQUIREMENT:** `PRD.md` Seção 7 (Critério de Aceitação 1 e 3).
- **BUSINESS CONTEXT:** Lançamentos com picos de centenas de comentários por minuto durante lives.
- **TECHNICAL CONTEXT:** Script Node/TypeScript em `scripts/stress-test-webhook.ts`.
- **PRECONDITIONS:** `EPIC-001` a `EPIC-004` concluídos.
- **DEPENDENCIES:** N/A.
- **ALLOWED FILES:**
  - `scripts/stress-test-webhook.ts`
  - `package.json`
- **FORBIDDEN FILES:**
  - `src/lib/engine/*`
- **RESEARCH REQUIRED:** Sim (verificar timeout de webhook da Meta: 20 segundos para HTTP 200).
- **RESEARCH QUESTIONS:** O endpoint responde 200 antes de finalizar o processamento assíncrono? (Sim, padrão exigido pelo PRD).
- **IMPLEMENTATION ACTION:** Disparar 100 requisições POST com payloads de comentário e assinatura HMAC válida gerada dinamicamente.
- **EXPECTED RESULT:** 100% das requisições respondem status 200 em menos de 1000ms.
- **ACCEPTANCE CRITERIA:** Nenhuma falha de concorrência ou colisão no banco.
- **TEST STRATEGY:** Execução do script localmente contra `http://localhost:3007/api/webhook/instagram`.
- **VALIDATION STRATEGY:**
  - *Level 1:* Script executa sem erros.
  - *Level 2:* Métricas de latência < 1s registradas.
  - *Level 3:* Conformidade estrita com o PRD Seção 7.
- **REVIEW STRATEGY:** Checar se há memory leak ou travamento de conexões Prisma.
- **SECURITY CONSIDERATIONS:** Assinaturas HMAC calculadas com chave de teste.
- **PERFORMANCE CONSIDERATIONS:** Pool de conexões do Prisma configurado para suportar picos.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar resultados em `reports/VALIDATION.md`.
- **MEMORY IMPACT:** Registrar limites de concorrência em `docs/RULES.md`.
- **NEXT TASK:** `NANO-052`.

---

### NANO-052: Auditoria Visual e Acessibilidade (Dark/Light)
- **ID:** `NANO-052`
- **TITLE:** Auditoria de contraste, navegação por teclado e harmonia estética
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Garantir que todas as telas respeitam o `docs/DESIGN.md`, sem quebras visuais em mobile ou problemas de contraste no tema escuro.
- **SOURCE REQUIREMENT:** `docs/DESIGN.md` e regras de UI/UX.
- **BUSINESS CONTEXT:** Produto com visual limpo e refinado que passa credibilidade profissional.
- **TECHNICAL CONTEXT:** `src/app/globals.css` e componentes.
- **PRECONDITIONS:** `NANO-051` concluída.
- **DEPENDENCIES:** `NANO-051`.
- **ALLOWED FILES:**
  - `src/app/globals.css`
  - `docs/DESIGN.md`
- **FORBIDDEN FILES:**
  - `src/app/api/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Inspecionar e ajustar variáveis CSS para contraste WCAG AA em botões primários e muted text.
- **EXPECTED RESULT:** Visual impecável em ambos os temas sem elementos ilegíveis.
- **ACCEPTANCE CRITERIA:** Contraste mínimo de 4.5:1 em todos os textos informativos.
- **TEST STRATEGY:** Auditoria visual de componentes.
- **VALIDATION STRATEGY:**
  - *Level 1:* Zero erros CSS.
  - *Level 2:* Renderização correta em navegadores Chromium e Safari.
  - *Level 3:* Aprovação de design.
- **REVIEW STRATEGY:** Fresh context review em telas mobile de 375px de largura.
- **SECURITY CONSIDERATIONS:** N/A.
- **PERFORMANCE CONSIDERATIONS:** Zero CSS não utilizado.
- **DESIGN CONSIDERATIONS:** Tokens oficiais preservados.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-053`.

---

### NANO-053: Validação de Build e Migrations Vercel
- **ID:** `NANO-053`
- **TITLE:** Executar script `vercel-build` e validar geração de bundle de produção
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Assegurar que o build de produção Next.js conclua sem erros de hidratação ou falhas de bundle.
- **SOURCE REQUIREMENT:** `package.json` (`npm run build`).
- **BUSINESS CONTEXT:** Deploy contínuo sem quebras no ambiente de produção.
- **TECHNICAL CONTEXT:** `next.config.ts`, `prisma.config.ts`.
- **PRECONDITIONS:** `NANO-052` concluída.
- **DEPENDENCIES:** `NANO-052`.
- **ALLOWED FILES:**
  - `next.config.ts`
  - `package.json`
- **FORBIDDEN FILES:**
  - `src/app/api/webhook/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Executar `npm run build` localmente e conferir integridade dos artefatos estáticos.
- **EXPECTED RESULT:** Build concluído com sucesso e status verde.
- **ACCEPTANCE CRITERIA:** Zero warnings de páginas quebradas no prerender.
- **TEST STRATEGY:** `npm run build` gerando saída `.next` íntegra.
- **VALIDATION STRATEGY:**
  - *Level 1:* Compilação limpa.
  - *Level 2:* `npm run start` servindo na porta 3007.
  - *Level 3:* Pronto para produção.
- **REVIEW STRATEGY:** Inspecionar tamanho do bundle JS.
- **SECURITY CONSIDERATIONS:** Sem vazamento de `.env` em bundles públicos.
- **PERFORMANCE CONSIDERATIONS:** Tamanho de first load JS < 150KB por rota.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-054`.

---

### NANO-054: Teste de Fumaça com Meta Real (Smoke Test)
- **ID:** `NANO-054`
- **TITLE:** Teste real ponta a ponta: Comentário no Instagram $\rightarrow$ DM com Botão Fixo $\rightarrow$ Link
- **RISK LEVEL:** `CRITICAL`
- **OBJECTIVE:** Validar o critério de aceitação #1 do PRD em um post real no perfil `@startinc.marketing`.
- **SOURCE REQUIREMENT:** `PRD.md` Seção 7 (Critério #1).
- **BUSINESS CONTEXT:** Garantia de funcionamento do produto antes de abrir para clientes.
- **TECHNICAL CONTEXT:** Webhook apontando para URL pública com HTTPS.
- **PRECONDITIONS:** `NANO-053` concluída.
- **DEPENDENCIES:** `NANO-053`.
- **ALLOWED FILES:**
  - `reports/SMOKE_TEST.md`
- **FORBIDDEN FILES:**
  - Código-fonte em geral.
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Postar comentário de teste, verificar recebimento do webhook, resposta no comentário e entrega da DM com botão fixo em menos de 3 segundos.
- **EXPECTED RESULT:** Lead recebe a DM com botão clicável imediatamente.
- **ACCEPTANCE CRITERIA:** Fluxo executado sem duplicidade e com registro no banco.
- **TEST STRATEGY:** Teste real com conta externa.
- **VALIDATION STRATEGY:**
  - *Level 1:* Webhook processado.
  - *Level 2:* DM entregue no app do Instagram.
  - *Level 3:* Critério #1 do PRD 100% satisfeito.
- **REVIEW STRATEGY:** Registrar logs completos e tempo de resposta.
- **SECURITY CONSIDERATIONS:** Não expor dados do lead no relatório.
- **PERFORMANCE CONSIDERATIONS:** Tempo total < 3 segundos.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar encerramento do MVP em `state/STATUS.md` e gerar relatório de smoke test.
- **MEMORY IMPACT:** Registrar sucesso do lançamento.
- **NEXT TASK:** MVP Finalizado e entregue com sucesso!
