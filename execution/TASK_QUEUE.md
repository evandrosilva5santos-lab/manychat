# TASK_QUEUE — Fila Operacional de Execução

> **Documento:** Fila de Tarefas por Estado  
> **Status:** Ativo  
> **Regra:** Uma nano task só pode estar em um único estado por vez.  

---

## 🟢 READY (Pronta para Execução Imediata)

Pedidos do dono em 13/10/2026 — **prioridade: Instagram** (nesta ordem):

1. **`AGENDADOR-MINUTOS`** — fazer as esperas de minutos saírem no horário (lembrete de 10 min). Opções: QStash (`docs/agendador-qstash.md`) ou `pg_cron` + `pg_net` no Supabase chamando o `/tick` a cada minuto (sem conta nova; precisa de autorização para alterar o banco de produção).
2. **`STORY-REPLY`** — automação para quem responde ao story (gatilho `STORY_REPLY` já existe no banco; o webhook já marca `isStoryReply`). Construtor rápido próprio: palavra-chave opcional → DM → link.
3. **`STORY-MENTION`** — resposta a quem menciona o perfil no story (anexo `story_mention` no Direct).
4. **`LIVE-COMMENTS`** — automação para quem comenta na live (campo `live_comments` do webhook; inscrever o campo no app e no perfil).
5. **`MENU-INSTAGRAM`** — menu principal do Direct ("Mais opções", até 20 itens): cada item responde com uma mensagem/automação ou abre um site (Messenger Profile API: `persistent_menu`/`ice_breakers` do Instagram).
6. **`ICE-BREAKERS`** — iniciadores de conversa (perguntas prontas na primeira conversa).
7. **`RESPOSTA-PADRAO`** — resposta padrão para DM que não casou com nenhuma palavra-chave (com intervalo mínimo por contato para não repetir).
8. **`BOAS-VINDAS-SEGUIDORES`** — cumprimentar novos seguidores. **Verificar viabilidade antes:** a API oficial do Instagram não tem webhook de "novo seguidor"; não implementar por meios não oficiais.
9. **`MENU-MESSENGER`** — menu do Messenger (Facebook): implementar e deixar **bloqueado** (feature flag desligada) até o dono liberar.

Depois da fila: pacotes do plano n8n (`docs/plans/2026-10-13-engenharia-reversa-n8n.md`) — P1 mídia no Direct, P3 funil, P4 agente de IA (decisões do dono).

---

## 🟡 IN_PROGRESS (Em Execução Pelo Agente Autorizado)

- **`PLANOS-E-COBRANCA`** (autorizado pelo dono em 13/10/2026; ADR-008; plano em `docs/plans/2026-10-13-planos-e-cobranca.md`). Fases: 1 login de cliente e equipe · 2 planos e direitos · 3 aplicação dos limites · 4 Super Admin · 5 cobrança Stripe · 6 página de preços e cadastro.

---

## 🟣 VALIDATION (Em Fase de Validação / Testes)

*(Nenhuma tarefa aguardando validação no momento)*

---

## 🔴 BLOCKED (Aguardando Conclusão de Dependências)

*(Nenhuma tarefa bloqueada no momento)*

---

## ⚪ DONE (Concluídas e Validadas)

- [x] **`MENU-PERFIL`** (2026-10-13): sidebar com troca de perfil, menu do usuário com Sair, `/contas`, `/sair`, aviso de token vencendo. Commit `5c4d966`.
- [x] **`ESPERAS-E-QUALIDADE`** (2026-10-13): webhook e cron diário retomam esperas (`8ed8937`); erros internos fora da tela, tipos e cores do design system (`9e2c740`).
- [x] **`PORTE-ITENS-6-8`** (2026-10-12): `vercel-build` só em produção, opt-out "PARAR" (migration pendente — BLK-008), exportar/excluir contato, cabeçalhos de segurança. Commits `9bef2b7`, `45e5bed`, `eced9c5`, `4acf127`.
- [x] **`MARCA-INSTACHAT`** (2026-10-12): logos, favicon, `primary` vermelho, token `brand`, saneamento da governança. Commit `500e025`.

- [x] **`PERFIL-SEGURO`** (2026-10-12): descarregar/excluir perfil, callbacks de desautorização e exclusão de dados da Meta, motor sem token global, isolamento da tela de falhas. Plano `perfil-seguro.md`, ADR-007.

- [x] **`ITEM-01`**: Segurança, basic auth no proxy, requireAuth em server actions e links rastreados.
- [x] **`ITEM-02`**: Banco Postgres real (Supabase), remoção de 100% de dados falsos/mocks/store.ts, páginas dinâmicas, zero falhas silenciosas.
- [x] **`MULTI-TENANCY-ADMIN`**: Workspaces, isolamento por conta, painel Super Admin e seletor multi-conta.
- [x] **`NANO-001`**: Adicionar busca de mídia no `InstagramGraphClient` (`src/lib/meta/graph.ts`) e criar rota `GET /api/instagram/media` (`src/app/api/instagram/media/route.ts`).
- [x] **`NANO-002`**: Criar suíte de testes unitários para a rota `/api/instagram/media` e método `getUserMedia` no Vitest (`src/lib/meta/graph.test.ts`).
- [x] **`NANO-003`**: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')` exibindo loading, empty e abas de filtro reais.
- [x] **`NANO-004`**: Atualizar `matcher.ts` e `recipe.ts` para validar `mediaId` no webhook quando `scope === 'specific'` contra Postgres real.
