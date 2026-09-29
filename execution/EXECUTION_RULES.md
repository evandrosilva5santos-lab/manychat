# EXECUTION_RULES — Protocolo Operacional Estrito e Ciclo ECC

> **Documento:** Regras de Execução Determinística para Claude Code  
> **Framework:** Everything Claude Code (ECC)  
> **Status:** Ativo / Inviolável  
> **Regra Áurea:** "Every authorized nano task follows the ECC execution lifecycle."  

---

## 1. O Princípio da Execução Única e Atômica

O agente executor está **estritamente proibido** de:
- Executar mais de uma nano task em uma única rodada.
- Pular diretamente para a implementação sem realizar a etapa de **RESEARCH** e **TEST (TDD)** quando aplicáveis.
- Adiantar tarefas subsequentes ou implementar "melhorias" não autorizadas (proibição de *scope creep*).
- Tocar em qualquer arquivo listado em `FORBIDDEN FILES`.
- Declarar sucesso sem que a validação nos três níveis seja comprovada.

---

## 2. O Ciclo de Engenharia ECC Passo a Passo

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CICLO DE ENGENHARIA ECC                         │
│                                                                        │
│   PLAN ──► RESEARCH ──► TEST ──► IMPLEMENT ──► REVIEW ──► VERIFY      │
│     ▲                                                      │           │
│     │                                                      ▼           │
│  HANDOFF ◄────────── STATUS ◄────────── MEMORY ◄────── DOCUMENT        │
└────────────────────────────────────────────────────────────────────────┘
```

### Etapa 1: PLAN (Planejamento)
- Ler `execution/CURRENT_TASK.md` e a ficha completa da tarefa em `tasks/`.
- Identificar os `ALLOWED FILES`, `FORBIDDEN FILES` e os critérios de aceitação.
- Produzir mentalmente ou em rascunho: O QUE fazer, POR QUE fazer e ONDE fazer.

### Etapa 2: RESEARCH (Pesquisa Prévia Mandatória)
- Verificar se já existem métodos, tipos ou utilitários semelhantes em `src/lib/meta/` ou componentes similares.
- Responder às perguntas de pesquisa mapeadas na ficha da tarefa antes de digitar uma única linha de código.
- Garantir que a documentação oficial da Meta Graph API v21.0 ou da stack foi conferida.

### Etapa 3: TEST (Test-First / TDD)
- Se aplicável, identificar ou escrever a condição de teste que falha antes da alteração (RED).
- Se TDD não for aplicável (ex: apenas tipagem ou rota vazia), validar o teste anterior e registrar o motivo.

### Etapa 4: IMPLEMENT (Implementação Controlada)
- Modificar **exclusivamente** os arquivos listados em `ALLOWED FILES`.
- Seguir os padrões e convenções de código estritos (`strict: true`, sem `any`, sem `console.log` desnecessário).

### Etapa 5: REVIEW (Revisão em Contexto Fresco)
- Inspecionar a alteração sob perspectiva neutra de auditoria:
  1. *Corretude:* O código faz exatamente o que a tarefa pediu?
  2. *Escopo:* Nenhum arquivo além dos permitidos foi modificado?
  3. *Segurança (OWASP):* Há risco de injeção, vazamento de credenciais ou exposição indevida de dados?
  4. *Performance:* Há vazamentos de memória ou chamadas redundantes?

### Etapa 6: VERIFY (Validação em Três Níveis)
- **Level 1 (Local):** `npx tsc --noEmit` passa com código 0.
- **Level 2 (Integração):** `npm test` passa com 100% dos testes da suíte verdes.
- **Level 3 (Requisito PRD):** A funcionalidade entrega exatamente o comportamento descrito na especificação (ex: requisição `curl` retorna JSON esperado).

### Etapa 7: DOCUMENT (Registro de Mudanças)
- Adicionar uma entrada formal em `state/CHANGELOG.md` contendo: Data, Agente, Tarefa, Arquivos Alterados e Resultado.
- Mover a tarefa atual de `READY` para `DONE` em `execution/TASK_QUEUE.md`.

### Etapa 8: MEMORY (Capitalização de Conhecimento)
- Se a execução gerou uma nova decisão técnica, registrar em `docs/DECISIONS.md`.
- Se gerou uma lição aprendida ou regra contra bugs recorrentes, registrar em `docs/RULES.md`.

### Etapa 9: HANDOFF (Transferência e Próxima Tarefa)
- Atualizar `state/STATUS.md` com o progresso atualizado.
- Atualizar `execution/CURRENT_TASK.md` e `state/HANDOFF.md` autorizando a próxima tarefa desbloqueada na fila.

---

## 3. Gestão de Bloqueios e Incertezas

Se em qualquer etapa surgir:
- Ambiguidade não resolvida pela documentação;
- Necessidade de alterar um arquivo proibido;
- Falha inexplicável de biblioteca externa;

O agente DEVE executar o protocolo de parada:
```text
STOP → REGISTRAR EM state/BLOCKERS.md → CLASSIFICAR ERRO → BLOQUEAR EM execution/TASK_QUEUE.md → ATUALIZAR state/STATUS.md
```
Nunca adivinhar ou assumir decisões arquiteturais por conta própria.
