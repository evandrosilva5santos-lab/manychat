# ECC_INTEGRATION — Integração da Metodologia Everything Claude Code (ECC)

> **Documento:** Especificação da Camada de Engenharia ECC  
> **Referência Oficial:** `https://github.com/affaan-m/ECC` (Affaan Mustafa)  
> **Status:** Ativo / Inviolável  
> **Propósito:** Fundir a governança do projeto com os princípios de execução determinística de engenharia de software assistida por IA.  

---

## 1. O que é o ECC (Everything Claude Code)

O **ECC (Everything Claude Code)** é uma metodologia e framework de engenharia de alto rigor criado por Affaan Mustafa para transformar agentes de IA em engenheiros de software determinísticos, previsíveis e disciplinados. 

Em vez de uma IA agir por suposição ("vibe coding"), o ECC impõe um ciclo estrito de engenharia:
```text
PLAN → RESEARCH → TEST (TDD) → IMPLEMENT → REVIEW → VERIFY → DOCUMENT → MEMORY → HANDOFF
```

---

## 2. Princípios Adotados no Projeto Fluxo

1. **Separação Rígida em Duas Camadas:**
   - **Camada 1 (Governança & Produto - Antigravity):** Define **O QUE** fazer via PRD, Regras, Arquitetura, Design Tokens e Master Plan.
   - **Camada 2 (Ciclo de Engenharia - Claude Code):** Define **COMO** executar com rigor atômico e qualidade técnica incontestável.
2. **Research-First (Pesquisa Prévia Obrigatória):** Proibido escrever código sem antes verificar bibliotecas existentes, padrões do codebase, documentação oficial e risco de duplicação.
3. **TDD / Test-First:** Sempre que tecnicamente aplicável, testes são escritos antes ou no início do ciclo (Fail $\rightarrow$ Implement $\rightarrow$ Pass).
4. **Review em Contexto Fresco:** O código gerado é inspecionado sob perspectiva neutra de code review, auditando corretude, tipagem e ausência de regressões.
5. **Security Review Mandatório:** Toda alteração que manipule APIs externas, webhooks, credenciais, inputs de usuário ou banco passa por checagem defensiva OWASP.
6. **Validação em Três Níveis (Level 1, Level 2, Level 3):**
   - **Level 1 (Local):** A função/endpoint funciona isoladamente.
   - **Level 2 (Integration):** A integração com o restante do sistema (banco, roteador, engine) funciona harmoniosamente.
   - **Level 3 (Requirement):** O comportamento final atende 100% ao requisito original expresso no PRD.
7. **Memória Persistente vs Memória de Sessão:** Nenhum conhecimento crítico permanece retido na memória volátil do chat. Lições, novos padrões e decisões são promovidos diretamente para arquivos Markdown (`docs/DECISIONS.md`, `docs/RULES.md`, etc.).
8. **Classificação de Risco (Risk-Based Execution):** As tarefas são graduadas em LOW, MEDIUM, HIGH e CRITICAL, determinando o nível de profundidade de testes e revisões.

---

## 3. O que NÃO será Utilizado do ECC

Para manter a simplicidade e evitar burocracia desnecessária (princípio "anti-bloat" do ECC):
- Não instalaremos pacotes globais ou plugins pesados sem necessidade estrita.
- Não criaremos dezenas de agentes paralelos fictícios para tarefas que um único agente disciplinado executa com foco.
- Não adicionaremos wrappers de scripts que apenas adicionem latência aos comandos nativos do projeto (`npm test`, `npx tsc --noEmit`, `next dev -p 3007`).

---

## 4. Interação Operacional entre Antigravity e Claude Code

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      CAMADA 1: ORQUESTRAÇÃO & GOVERNANÇA              │
│                           (Agente: ANTIGRAVITY)                        │
│                                                                        │
│   PRD ──► ARCHITECTURE ──► DESIGN ──► RULES ──► MASTER PLAN ──► TASKS  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Autoriza 1 Nano Task
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      CAMADA 2: CICLO DE ENGENHARIA ECC                 │
│                              (Agente: CLAUDE)                          │
│                                                                        │
│   1. PLAN (Lê CURRENT_TASK e limites de arquivos permitidos)           │
│   2. RESEARCH (Verifica padrões em src/lib/meta e tipos existentes)    │
│   3. TEST (Escreve ou prepara o teste de validação - Fail)             │
│   4. IMPLEMENT (Edita estritamente ALLOWED FILES - Pass)               │
│   5. REVIEW (Auditoria de código, tipagem TypeScript e segurança)      │
│   6. VERIFY (Validação Level 1, Level 2 e Level 3)                     │
│   7. DOCUMENT (Registra em CHANGELOG.md e TASK_QUEUE)                  │
│   8. MEMORY (Promove aprendizados para DECISIONS/RULES se aplicável)    │
│   9. HANDOFF (Prepara autorização para a próxima Nano Task)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Matriz de Classificação de Risco (Risk-Based Matrix)

| Nível de Risco | Definição | Exigências Mandatórias |
| :--- | :--- | :--- |
| **LOW** | Ajustes cosméticos em CSS/UI estática sem alterar contratos de dados | Validação visual + `npx tsc --noEmit` |
| **MEDIUM** | Componentes com estado local (`useState`), formulários simples, novas interfaces | Testes unitários de renderização + Type check + Review |
| **HIGH** | Novas rotas de API, endpoints de consulta externa, novos métodos em clients de integração | Research prévio + TDD/Testes no Vitest + Security Check + Level 1 & 2 Verification |
| **CRITICAL** | Webhooks com HMAC, autenticação/tokens, envio de DMs na Send API, banco de dados / migrations | Independent Review + OWASP Security Review + Level 1, 2 & 3 Verification + Fail loudly |

---

## 6. Governança da Memória Contínua (Continuous Memory)

Se durante a execução o Claude Code identificar:
- Uma limitação não documentada da Meta Graph API $\rightarrow$ registrar em `docs/PRD_ISSUES.md`.
- Um padrão de tratamento de erro ou fallback reutilizável $\rightarrow$ registrar em `docs/RULES.md` ou `docs/DECISIONS.md`.
- Um novo jargão técnico $\rightarrow$ registrar em `docs/GLOSSARY.md`.

Desta forma, o projeto acumula sabedoria técnica incremental sem depender do histórico conversacional.
