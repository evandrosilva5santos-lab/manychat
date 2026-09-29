# INITIAL AUDIT — Auditoria Inicial do Projeto

> **Documento:** Snapshot Histórico do Estado Inicial  
> **Data:** 28/09/2026 22:31 (Horário Local)  
> **Agente:** Antigravity (Arquiteto de Projeto & Orquestrador de Execução)  
> **Repositório:** `/Users/evandro/Downloads/Manychat` (Git: `evandrosilva5santos-lab/manychat.git`)  
> **Ambiente Local:** Node.js v22+, Next.js 16.3.6 (App Router), React 19, Porta `3007`  

---

## 1. Estado do Projeto

O projeto **Fluxo** é uma plataforma proprietária de automação de conversas para Instagram desenvolvida em Next.js com Tailwind CSS v4, Prisma v7 e `@xyflow/react`.
Encontra-se em estado funcional intermediário pós-reestruturação:
- O servidor roda na porta `3007` via script `npm run dev`.
- 46 testes unitários no Vitest estão passando sem falhas (`npm test`).
- A aplicação possui telas operacionais para Dashboard (`/`), Fluxos (`/fluxos`), Easy Builder (`/fluxos/[id]`), Contatos (`/contatos`), Conversas (`/conversas`), Catálogo (`/catalogo`) e Ajustes (`/ajustes`).
- Basic Auth no proxy foi desabilitado para navegação local direta sem atrito.
- Credenciais da Meta Graph API (`IG_ACCESS_TOKEN`, `IG_USER_ID="17841408178063858"`) estão configuradas no `.env` para o perfil `@startinc.marketing`.

---

## 2. Estrutura Existente Encontrada

```text
/Users/evandro/Downloads/Manychat
├── .env / .env.example
├── AGENTS.md (Apenas regras de bootstrap do Next.js geradas pelo dev server)
├── CLAUDE.md (Ponte vazia apontando para @AGENTS.md)
├── PRD.md (Requisitos do produto e limites da Meta)
├── DESIGN.md (Guia visual preliminar)
├── SCHEMA.md (Modelagem de dados)
├── API_CONTRACTS.md (Contratos de webhook e endpoints Meta)
├── TASK_PLAN.md (Plano de fases de alto nível)
├── docs/ (11 guias de etapas anteriores e tutoriais)
├── prisma/
│   ├── schema.prisma (10 modelos Prisma mapeados)
│   └── migrations/
├── src/
│   ├── app/ (App Router Next.js 16)
│   │   ├── ajustes/
│   │   ├── api/
│   │   │   ├── l/[code]/ (Encurtador de link)
│   │   │   └── webhook/instagram/ (Webhook Meta GET/POST)
│   │   ├── catalogo/
│   │   ├── contatos/
│   │   ├── conversas/
│   │   ├── fluxos/
│   │   │   └── [id]/ (SimpleBuilder e FlowEditor)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── flow-editor/ (Nós React Flow customizados)
│   │   ├── layout/ (Sidebar, Topbar)
│   │   ├── simple-builder/ (SimpleBuilder.tsx, DmPreview.tsx, PostPicker.tsx)
│   │   └── ui/ (Botões, inputs, modais)
│   ├── lib/
│   │   ├── engine/ (FlowRunner, Matcher, Executor)
│   │   ├── flow/ (recipe.ts, compiler.ts)
│   │   ├── meta/ (graph.ts, webhook.ts, window.ts)
│   │   ├── account.ts, db-url.ts, format.ts, prisma.ts
│   └── proxy.ts (Proxy de desenvolvimento e verificação de basic auth)
```

---

## 3. Documentação Existente vs Realidade

| Documento | Realidade Encontrada | Status |
| :--- | :--- | :--- |
| `PRD.md` | Define limites da Meta, escopo MVP e fluxos. | **FACT** / Aprovado |
| `DESIGN.md` | Descreve tokens e nós do canvas, mas carece de detalhes de micro-interações do Seletor de Posts e regras estritas de responsividade. | **PARTIAL** |
| `AGENTS.md` | Contém apenas o cabeçalho automático de Next.js. Não possui regras operacionais para Claude Code. | **INCOMPLETE** |
| `CLAUDE.md` | 11 bytes (`@AGENTS.md`). Inoperante. | **INCOMPLETE** |
| `SCHEMA.md` | Bate com `prisma/schema.prisma`. | **FACT** |
| `API_CONTRACTS.md` | Documenta Webhook e Send API. Falta contrato de `/api/instagram/media`. | **PARTIAL** |

---

## 4. Stack Tecnológica

- **Framework:** Next.js 16.3.6 (App Router, Server Components + Client Components)
- **Linguagem:** TypeScript 5.x (Strict mode)
- **UI & Estilização:** Tailwind CSS v4, Lucide React 1.48.0
- **Editor Visual:** `@xyflow/react` 12.12.0
- **Validação:** Zod 4.6.5
- **ORM / Banco:** Prisma 7.10.0 com driver `@prisma/adapter-pg` / PostgreSQL (Supabase) + fallback local
- **Testes:** Vitest 5.0.1 (46 testes passando)
- **Porta Padrão:** `3007`

---

## 5. Módulos & Integrações

- **Meta Graph API Client (`src/lib/meta/graph.ts`):**
  - Implementado: `sendTextMessage`, `sendButtonMessage`, `sendGenericTemplateMessage`, `replyToComment`, `getUserProfile`, `validateConnection`, `subscribeWebhooks`, `refreshLongLivedToken`.
  - Ausente: `getUserMedia` (buscar posts/reels da conta conectada).
- **Webhook Meta (`src/app/api/webhook/instagram/route.ts`):**
  - Validação HMAC SHA-256 ativa com `META_APP_SECRET`.
  - Resposta a challenge com `META_VERIFY_TOKEN`.
- **Easy Builder (`src/components/simple-builder/SimpleBuilder.tsx`):**
  - Configuração visual declarativa de gatilho, resposta pública, botões, direct, follow gate e link.
  - Possui componente `PostPicker.tsx` com dados MOCK estáticos (`MOCK_POSTS`).

---

## 6. Funcionalidades Implementadas, Parciais e Ausentes

### Implementadas (`IMPLEMENTED`)
- Engine de execução de nós (`FlowRunner`) com suporte a nós de mensagem, pergunta com botões, condições e tags.
- Verificação HMAC de webhooks da Meta.
- Validação de janela de 24 horas da Meta (`src/lib/meta/window.ts`).
- Compilação de receita declarativa para nós e arestas de automação (`src/lib/flow/recipe.ts`).
- Preview em tempo real simulado de smartphone com direct do Instagram (`DmPreview.tsx`).
- Gestão de contatos com persistência em banco/arquivo.

### Parciais (`PARTIALLY_IMPLEMENTED`)
- **Seletor de Posts do Instagram (`PostPicker.tsx`):** Exibe UI com cards e modal, porém opera exclusivamente com dados mock estáticos. Não consulta a API do Instagram nem possui rota `/api/instagram/media`.
- **Validação de ID de Mídia no Gatilho:** O schema aceita `mediaId`, mas não há validação cruzada do `mediaId` no webhook para disparar apenas quando o comentário for feito no post exato selecionado.

### Ausentes (`NOT_IMPLEMENTED`)
- Rota `GET /api/instagram/media` para listar publicações reais da conta conectada da Meta via Graph API.
- Filtro por tipo de mídia (Reels, Carrossel, Imagem estática) na interface de busca de posts.
- Tratamento de expiração de token de mídia ou permissões restritas da Meta no Seletor de Posts.

---

## 7. Conflitos & Riscos Identificados

1. **Conflito de Porta:** O projeto deve SEMPRE rodar na porta `3007` (`npm run dev` configurado para `-p 3007`). O script deve ser rigorosamente respeitado para não colidir com portas `3000`/`3001`.
2. **Ambiente Local sem Internet ou sem Token Válido:** Se o Claude Code rodar sem conexão viva com a Meta ou com token inválido, a rota `/api/instagram/media` DEVE retornar fallback gracioso com os posts mockados sem crashar a interface.
3. **Limite de Rate Limit da Meta Graph API:** Chamadas excessivas para `/{ig-user-id}/media` podem atingir throttle da Meta. É necessário implementar cache ou paginação inteligente.

---

## 8. Blockers & Pending Decisions

- **BLOCKER-001:** Nenhum blocker impeditivo para início da preparação documental.
- **PENDING_DECISION-001:** Definir comportamento do seletor caso a conta conectada não possua posts cadastrados (exibir empty state convidativo).

---

## 9. Veredito da Auditoria Inicial

O projeto possui base sólida, testes íntegros e arquitetura limpa. A feature prioritária selecionada para fatiamento e execução atômica pelo Claude Code é o **Seletor Visual de Posts do Instagram Conectado à Meta Graph API**, dividido estritamente em nano tasks testáveis e determinísticas.
