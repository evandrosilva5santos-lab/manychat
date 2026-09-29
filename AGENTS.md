<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS — Contrato Operacional Universal de Execução (ECC Powered)

> **Documento:** Regras Mandatórias de Engenharia e Execução para Agentes de IA  
> **Framework:** Everything Claude Code (ECC)  
> **Status:** Ativo / Inviolável  
> **Porta de Execução:** `3007` (`http://localhost:3007`)  

---

## 1. As Duas Camadas do Sistema

- **Camada 1: Governança do Projeto (Antigravity):**
  - Define o PRD, Arquitetura, Design System, Regras Invariantes, Decisões de Arquitetura e o Master Plan.
- **Camada 2: Ciclo de Engenharia ECC (Claude Code):**
  - Executa cada nano task individual de forma determinística, auditável e com alta qualidade técnica.

---

## 2. Leitura Prévia Obrigatória (Antes de Tocar em Qualquer Código)
Antes de executar qualquer ação no repositório, o agente DEVE ler obrigatoriamente nesta ordem:
1. `PRD.md` — Requisitos e limites do produto (Inalterável).
2. `docs/ECC_INTEGRATION.md` — Princípios da metodologia ECC adotada.
3. `execution/CURRENT_TASK.md` — A única tarefa autorizada para execução.
4. `execution/EXECUTION_RULES.md` — O protocolo operacional passo a passo.
5. `docs/RULES.md` — Regras invariantes de código, Meta API, design e segurança.
6. `docs/DESIGN.md` — Contrato de design tokens, paleta e componentes.
7. `docs/ARCHITECTURE.md` — Arquitetura de APIs, motor e banco de dados.
8. `state/STATUS.md` e `state/HANDOFF.md` — Estado operacional e último handoff.

---

## 3. O Ciclo de Engenharia ECC (Mandatório para Toda Nano Task)

Todo agente executor deve cumprir rigorosamente as 9 etapas em cada rodada:

```text
1. PLAN: Ler CURRENT_TASK, escopo, arquivos permitidos e critérios de aceite.
2. RESEARCH: Investigar bibliotecas, padrões existentes e documentação antes de codificar.
3. TEST (TDD): Preparar os testes ou identificar condição de falha antes da implementação.
4. IMPLEMENT: Modificar estritamente os ALLOWED FILES da nano task.
5. REVIEW: Auditar o código com perspectiva de contexto fresco (tipos, OWASP, complexidade).
6. VERIFY: Validar nos 3 níveis (Level 1 Local, Level 2 Integração, Level 3 Requisito PRD).
7. DOCUMENT: Registrar em state/CHANGELOG.md e atualizar execution/TASK_QUEUE.md.
8. MEMORY: Promover aprendizados, decisões ou novas regras para a documentação persistente.
9. HANDOFF: Atualizar state/STATUS.md e state/HANDOFF.md preparando a próxima nano task.
```

---

## 4. Regras Inegociáveis de Execução
1. **Uma Execução = Uma Nano Task:** Jamais agrupe, antecipe ou expanda o escopo da tarefa.
2. **Respeito aos Arquivos Permitidos e Proibidos:** Se a alteração exigir mexer em um arquivo proibido, pare e registre um blocker em `state/BLOCKERS.md`.
3. **Qualidade Verificada:** Não declare nada como concluído sem que `npm test` e `npx tsc --noEmit` passem 100%.
4. **Sem Alucinação ou Decisões Ocultas:** Diante de qualquer dúvida ou ambiguidade:
```text
STOP → DOCUMENTAR EM state/BLOCKERS.md → BLOQUEAR TAREFA → ATUALIZAR STATUS
```
