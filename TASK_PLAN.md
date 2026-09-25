# TASK_PLAN — Plano de Execução e Reestruturação (Fluxo)

> **Plano de Implementação Atômico**  
> **Estratégia:** Fatiamento em etapas pequenas, testáveis e independentes.

---

## 🚦 Status das Fases

- [x] **Fase 1: Especificação & PRD** (`PRD.md`, `DESIGN.md`, `SCHEMA.md`, `API_CONTRACTS.md`)
- [x] **Fase 2: Modelagem de Dados & Editor Visual de Fluxos**
  - [x] Schema Prisma & Seed inicial
  - [x] Easy Builder (Automação rápida declarativa)
  - [x] Canvas Avançado (React Flow)
- [x] **Fase 3: Motor de Automação & Webhooks (Engine Core)**
  - [x] 3.1: Endpoint de validação de Webhook Meta (`GET /api/webhook/instagram`)
  - [x] 3.2: Receptor de eventos e validação HMAC (`POST /api/webhook/instagram`)
  - [x] 3.3: Módulo de disparo da Graph API (Envio de DM, Botões Fixos, Resposta em Comentário)
  - [x] 3.4: Motor de Execução `FlowRunner` (Processar nós `MESSAGE`, `QUESTION`, `CONDITION`, `ADD_TAG`, `FOLLOW_GATE`)
  - [x] 3.5: Rota de encurtamento & rastreamento de cliques (`/api/l/[code]`)
- [ ] **Fase 4: Catálogo de Cards & Carrossel**
  - [ ] 4.1: Painel visual para criar/editar itens do catálogo (`/catalogo`)
  - [ ] 4.2: Integração de nó `CAROUSEL` com a Graph API
- [ ] **Fase 5: CRM & Histórico de Conversas**
  - [ ] 5.1: Tela de Lista de Contatos com filtros de tags (`/contatos`)
  - [ ] 5.2: Tela de Histórico de Conversas e mensagens (`/conversas`)
- [ ] **Fase 6: Autenticação & Configurações da Conta**
  - [ ] 6.1: Tela de Ajustes e credenciais Meta (`/ajustes`)
  - [ ] 6.2: Fluxo de Conexão OAuth da Meta / Login Seguro
- [ ] **Fase 7: Verificação de Qualidade, Testes & Deploy**
  - [ ] 7.1: Testes unitários com Vitest
  - [ ] 7.2: Browser QA visual
  - [ ] 7.3: Deploy na Vercel com migrações automáticas
