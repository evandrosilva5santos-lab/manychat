# CURRENT_TASK — Autorização Operacional de Execução

> **Documento:** Autorização Formal de Execução  
> **Status:** `READY_FOR_EXECUTION`  
> **Framework:** Everything Claude Code (ECC)  
> **Agente Autorizado:** `CLAUDE` (Claude Code)  
> **Orquestrador Emissor:** `ANTIGRAVITY`  
> **Data de Emissão:** 29/09/2026 02:55  

---

## 🎯 Ficha Canônica da Nano Task Autorizada

- **ID:** `NANO-002`
- **TITLE:** Criar suíte de testes unitários para `getUserMedia` e rota `/api/instagram/media` no Vitest
- **OBJECTIVE:** Garantir cobertura automatizada e robusta para o método `getUserMedia` de `InstagramGraphClient` e para a rota `GET /api/instagram/media`, cobrindo cenários de sucesso com mock, normalização de campos, query params de paginação (`limit`), e tratamento defensivo de falhas de conexão/erros.
- **CONTEXT:** A `NANO-001` adicionou o tipo `InstagramMediaItem`, o método `getUserMedia` e a rota `GET /api/instagram/media`. Conforme a regra invariante `REG-TEST-002` e os princípios ECC, nenhuma funcionalidade avança para a interface visual sem testes unitários rigorosos no Vitest.
- **SOURCE REQUIREMENT:** `docs/RULES.md` (`REG-TEST-002`), `PRD.md` Módulo 2 e Metodologia ECC (TDD).
- **BUSINESS CONTEXT:** Prevenir que alterações futuras quebrem a integração com a listagem de posts da Meta, assegurando que o modal visual de seleção de posts sempre receba dados íntegros e consistentes.
- **TECHNICAL CONTEXT:** Criar o arquivo `src/lib/meta/graph.test.ts` usando Vitest (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`). Utilizar a configuração existente em `vitest.config.mts`.
- **PRECONDITIONS:**
  - `NANO-001` concluída e validada.
  - Zero erros em `npx tsc --noEmit`.
- **DEPENDENCIES:** `NANO-001`.
- **ALLOWED FILES:**
  - `src/lib/meta/graph.test.ts`
- **FORBIDDEN FILES:**
  - `PRD.md` (Imutável)
  - `src/components/*`
  - `src/app/api/webhook/*`
  - `prisma/*`
  - `package.json`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** Nenhuma.
- **EXACT ACTION:**
  1. Criar `src/lib/meta/graph.test.ts`:
     - Testar `defaultGraphClient.getUserMedia()` em ambiente sem token / teste (retorna `success: true`, `mock: true`, array com 3 itens).
     - Testar integridade dos campos normalizados de cada post (`id`, `caption`, `mediaType`, `timestamp`, `likeCount`, `commentsCount`).
     - Testar chamada com token simulado usando `vi.spyOn(globalThis, "fetch")` para validar a URL correta (`https://graph.facebook.com/v21.0/me/media`), parâmetros `fields` e `limit`, e headers de autenticação (`Bearer <token>`).
     - Testar comportamento defensivo quando o `fetch` retorna erro HTTP 400 ou rejeição de rede (deve retornar `success: false` com string amigável em `error` sem disparar `unhandledRejection`).
  2. Testar a rota de API `GET /api/instagram/media`:
     - Importar o handler `GET` de `@/app/api/instagram/media/route`.
     - Executar com requisição simulada `new Request("http://localhost:3007/api/instagram/media")` e validar status HTTP 200 com payload JSON `{ success: true, data: [...] }`.
     - Validar que query param `?limit=10` é repassado ao cliente.
- **EXPECTED RESULT:** `npm test` executa agora 5 suites de testes com 100% de aprovação (todos os testes verdes).
- **ACCEPTANCE CRITERIA:**
  - `src/lib/meta/graph.test.ts` adicionado com testes claros, declarativos e isolados.
  - Nenhum mock vaza estado para outros testes (`afterEach(() => vi.restoreAllMocks())`).
  - `npx tsc --noEmit` conclui com 0 erros.
  - `npm test` conclui com todos os testes passando em tempo inferior a 2 segundos.
- **TEST STRATEGY:**
  - Executar `npx vitest run src/lib/meta/graph.test.ts`.
- **VALIDATION METHOD:**
  - `npm run verify` (`vitest run && tsc --noEmit`).
- **RISKS:** Mocks poluírem o escopo global $\rightarrow$ mitigado por `vi.restoreAllMocks()` no `afterEach`.
- **SECURITY CONSIDERATIONS:** Jamais incluir tokens de acesso reais em arquivos de teste.
- **PERFORMANCE CONSIDERATIONS:** Testes estritamente em memória sem chamadas externas lentas.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md` e atualizar `execution/TASK_QUEUE.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT NANO TASK:** `NANO-003` (Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')`).

---

## 🛑 Protocolo de Execução do Claude Code
1. Leia `CLAUDE.md` e `AGENTS.md`.
2. Execute o ciclo ECC: Research $\rightarrow$ Plan $\rightarrow$ Test $\rightarrow$ Implement $\rightarrow$ Review $\rightarrow$ Verify.
3. Modifique estritamente o arquivo autorizado em `ALLOWED FILES` (`src/lib/meta/graph.test.ts`).
4. Valide com `npm run verify`.
5. Atualize `state/CHANGELOG.md`, `state/STATUS.md` e emita o `state/HANDOFF.md`.
