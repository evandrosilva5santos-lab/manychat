# TASK-004: CRM de Contatos, Histórico de Mensagens e Gestão de Tags

> **Epic:** `EPIC-004` (CRM & Gestão de Contatos)  
> **Fase:** `FASE 3` (CRM de Contatos & Conversas)  
> **Framework de Engenharia:** Metodologia ECC (Everything Claude Code)  
> **Prioridade:** P2 (Média)  
> **Origem:** `PRD.md` Módulo 5 (CRM & Gestão de Contatos)  

---

## 1. Visão Geral da Decomposição ECC

```text
TASK-004: Consolidação do CRM e Conversas
├── MICRO-004.01: Gestão de Contatos e Tags
│   ├── NANO-041 [MEDIUM]: Implementar filtro por tags e busca por username em `src/app/contatos/page.tsx`
│   └── NANO-042 [MEDIUM]: Criar modal para adicionar e remover tags de um contato manualmente
└── MICRO-004.02: Histórico de Conversas e Mensagens
    ├── NANO-043 [HIGH]: Implementar visualizador de chat com histórico cronológico em `src/app/conversas/page.tsx`
    └── NANO-044 [MEDIUM]: Implementar exportação de contatos para CSV em `src/app/contatos/actions.ts`
```

---

## 2. Especificação Detalhada das Nano Tasks

### NANO-041: Busca e Filtro de Contatos por Tags
- **ID:** `NANO-041`
- **TITLE:** Adicionar busca por nome/username e filtro multi-tags na lista de contatos
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Permitir ao operador encontrar rapidamente contatos por termo de busca ou segmentados por tags aplicadas (ex: "lead-quente").
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 5.
- **BUSINESS CONTEXT:** Filtrar os leads mais engajados para análise e campanhas.
- **TECHNICAL CONTEXT:** `src/app/contatos/ContactsClient.tsx`.
- **PRECONDITIONS:** `EPIC-001` concluído.
- **DEPENDENCIES:** N/A.
- **ALLOWED FILES:**
  - `src/app/contatos/ContactsClient.tsx`
  - `src/app/contatos/actions.ts`
- **FORBIDDEN FILES:**
  - `src/lib/engine/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Adicionar input de busca com debounce (300ms) e dropdown seletor de tags ativas que filtra a tabela de contatos.
- **EXPECTED RESULT:** Tabela reativa filtrando contatos instantaneamente.
- **ACCEPTANCE CRITERIA:** Sem reload de página, busca insensível a maiúsculas/minúsculas.
- **TEST STRATEGY:** Teste unitário de filtro de contatos no Vitest.
- **VALIDATION STRATEGY:**
  - *Level 1:* Zero erros TypeScript.
  - *Level 2:* Teste de renderização passando.
  - *Level 3:* Atendimento ao PRD.
- **REVIEW STRATEGY:** Testar com listas de mais de 100 contatos.
- **SECURITY CONSIDERATIONS:** Sanitização do termo de busca (evitar SQL injection via Prisma).
- **PERFORMANCE CONSIDERATIONS:** Debounce no input para evitar queries excessivas.
- **DESIGN CONSIDERATIONS:** Badges de tags com cores suaves e botão de limpar filtros.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-042`.

---

### NANO-042: Atribuição Manual de Tags ao Contato
- **ID:** `NANO-042`
- **TITLE:** Criar ação para aplicar ou remover etiquetas de um contato pelo painel
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Permitir que o atendente humano adicione ou remova tags de um contato diretamente na tabela.
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 5 (`ContactTag`).
- **BUSINESS CONTEXT:** Classificação manual de clientes especiais ou compradores confirmados.
- **TECHNICAL CONTEXT:** `src/app/contatos/actions.ts`.
- **PRECONDITIONS:** `NANO-041` concluída.
- **DEPENDENCIES:** `NANO-041`.
- **ALLOWED FILES:**
  - `src/app/contatos/actions.ts`
  - `src/app/contatos/ContactsClient.tsx`
- **FORBIDDEN FILES:**
  - `src/app/api/webhook/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Criar Server Action `toggleContactTag(contactId: string, tagId: string)`.
- **EXPECTED RESULT:** Tag adicionada ou removida com atualização otimista na interface.
- **ACCEPTANCE CRITERIA:** Prevenir tags duplicadas no mesmo contato.
- **TEST STRATEGY:** Teste unitário da action `toggleContactTag`.
- **VALIDATION STRATEGY:**
  - *Level 1:* Type check limpo.
  - *Level 2:* Vitest passando.
  - *Level 3:* Persistência comprovada no banco.
- **REVIEW STRATEGY:** Checar integridade referencial.
- **SECURITY CONSIDERATIONS:** Validar se a tag pertence à mesma conta do Instagram.
- **PERFORMANCE CONSIDERATIONS:** Atualização otimista na UI.
- **DESIGN CONSIDERATIONS:** Componente de pills com botão de fechar (`x`).
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-043`.

---

### NANO-043: Visualizador de Chat e Histórico de Mensagens
- **ID:** `NANO-043`
- **TITLE:** Implementar visualizador de conversas estilo direct em `src/app/conversas/page.tsx`
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Permitir ler o histórico completo de mensagens trocadas entre o robô e o lead, ordenadas cronologicamente.
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 5 (`Message`).
- **BUSINESS CONTEXT:** Auditoria e acompanhamento do suporte para entender onde os leads travam no funil.
- **TECHNICAL CONTEXT:** `src/app/conversas/page.tsx` e `src/app/conversas/ConversasClient.tsx`.
- **PRECONDITIONS:** `NANO-042` concluída.
- **DEPENDENCIES:** `NANO-042`.
- **ALLOWED FILES:**
  - `src/app/conversas/page.tsx`
  - `src/app/conversas/ConversasClient.tsx`
  - `src/app/conversas/actions.ts`
- **FORBIDDEN FILES:**
  - `src/lib/meta/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Layout de duas colunas (coluna 1: lista de conversas recentes; coluna 2: balões de mensagem azuis/cinzas com timestamp e status).
- **EXPECTED RESULT:** Interface idêntica a um mensageiro moderno exibindo entradas (`IN`) e saídas (`OUT`).
- **ACCEPTANCE CRITERIA:** Auto-scroll para a última mensagem ao selecionar uma conversa.
- **TEST STRATEGY:** Teste de renderização da lista e do chat.
- **VALIDATION STRATEGY:**
  - *Level 1:* Zero erros TypeScript.
  - *Level 2:* Consulta e hidratação de mensagens funcionando.
  - *Level 3:* Conformidade de UX com `docs/DESIGN.md`.
- **REVIEW STRATEGY:** Fresh context review em responsividade mobile e tablet.
- **SECURITY CONSIDERATIONS:** Preservação de dados sensíveis de contato.
- **PERFORMANCE CONSIDERATIONS:** Carregamento de mensagens sob demanda (lazy loading).
- **DESIGN CONSIDERATIONS:** Balões com sombra sutil e tokens de cor oficiais.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-044`.

---

### NANO-044: Exportação de Contatos para CSV
- **ID:** `NANO-044`
- **TITLE:** Criar funcionalidade de exportação de leads para arquivo CSV
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Permitir download da lista de contatos com nome, username, igsid, data de criação e tags para uso em CRM externo ou planilhas.
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 5.
- **BUSINESS CONTEXT:** Integração manual com ferramentas de email marketing ou WhatsApp.
- **TECHNICAL CONTEXT:** `src/app/contatos/actions.ts`.
- **PRECONDITIONS:** `NANO-043` concluída.
- **DEPENDENCIES:** `NANO-043`.
- **ALLOWED FILES:**
  - `src/app/contatos/actions.ts`
  - `src/app/contatos/ContactsClient.tsx`
- **FORBIDDEN FILES:**
  - Qualquer outro fora de contatos.
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Gerar string CSV formatada em UTF-8 com separador vírgula/ponto-e-vírgula e disparar download no browser.
- **EXPECTED RESULT:** Arquivo `contatos-fluxo-[data].csv` baixado com sucesso.
- **ACCEPTANCE CRITERIA:** Tratar caracteres especiais (acentos, emojis) com encoding UTF-8 com BOM.
- **TEST STRATEGY:** Teste unitário de formatação de CSV.
- **VALIDATION STRATEGY:**
  - *Level 1:* Type check limpo.
  - *Level 2:* Vitest passando.
  - *Level 3:* Teste de download de arquivo válido.
- **REVIEW STRATEGY:** Verificar se campos nulos não quebram colunas do CSV.
- **SECURITY CONSIDERATIONS:** Evitar injeção de fórmulas CSV (bloquear início de célula com `=`, `+`, `-`, `@`).
- **PERFORMANCE CONSIDERATIONS:** Streaming caso haja milhares de contatos.
- **DESIGN CONSIDERATIONS:** Botão "Exportar CSV" com ícone de download.
- **DOCUMENTATION IMPACT:** Concluir `EPIC-004` em `execution/TASK_QUEUE.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** Início do `EPIC-005`.
