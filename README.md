# Fluxo — automação de conversas para Instagram (ManyChat próprio — Start Inc.)

Sistema próprio de automação de conversas para Instagram (comentário → DM → botão → etiqueta), inspirado no ManyChat, feito para agências e negócios B2B.

## Estrutura

- `design-system/` — design system **Fluxo**
  - `README.md` — guia de marca (voz, cores, tipografia, layout, implementação)
  - `tokens.json` — tokens (tema claro e escuro)
  - `tokens.css` — tokens como variáveis CSS, prontos pra importar no Next.js/Tailwind
  - `design-system.json` — metadados do projeto de design system
  - `components/bundle.css` — estilos dos componentes (prefixo `fx-`)
  - `components/<Componente>/` — guia de uso (`README.md`) e exemplo (`preview.html`): AlertBanner, AutomationRow, Button, Cover, DmPreview, FlowNode, Input, Sidebar, StatCard, StatusBadge, Tabs, Toggle
- `design/` — telas desenhadas no canvas de Design do Claude (arquivos `.dc.html`)
  - `Fluxo-telas-do-app.html` — **todas as telas num arquivo só**; abra no navegador para visualizar
  - `canvas.json` — índice das telas (título, tamanho, posição no canvas)
  - `ds/fluxo/tokens.json` — tokens do design system Fluxo (cópia usada pelo canvas; igual a `design-system/tokens.json`)
- `docs/` — guia e documentação das etapas
  - `guia-passo-a-passo.md` — "Como Criar seu Próprio ManyChat" (@euguilhermepasin), com o prompt bônus e o checklist
  - `etapa-1-banco.md` — explicação do banco de dados (Etapa 1)
  - `etapa-2-editor.md` — como funciona o editor visual (Etapa 2)
  - `etapa-2b-builder-simples.md` — automação rápida (igual ao easy builder do ManyChat)
  - `deploy-vercel.md` — como colocar no ar (Vercel + Supabase próprio, com senha)
- `prisma/schema.prisma` — modelo do banco de dados; `prisma/seed.ts` — fluxo de exemplo
- `src/` — app Next.js
  - `app/fluxos/` — lista de automações e editor (`/fluxos/[id]`), com as ações de salvar em `actions.ts`
  - `components/flow-editor/` — editor visual (React Flow): paleta, caixinhas, painel de propriedades
  - `components/simple-builder/` — builder simples (automação rápida: comentário → DM → link)
  - `lib/flow/` — regras do fluxo sem React: tipos, limites do Instagram, validação e conversão banco ↔ editor

> Os arquivos `.dc.html` carregam `./support.js`, o runtime do canvas de Design do Claude, que não faz parte do repositório. Fora do canvas, use `design/Fluxo-telas-do-app.html`.

## Telas (`design/`)

**Desktop (1440×960)**

| # | Tela | Arquivo |
| --- | --- | --- |
| 01 | Login | `Login.dc.html` |
| 02 | Painel | `Painel.dc.html` |
| 03 | Automações | `Automacoes.dc.html` |
| 04 | Builder simples | `Construtor.dc.html` |
| 05 | Builder avançado | `Fluxo.dc.html` |
| 06 | Contatos | `Contatos.dc.html` |
| 07 | Conversas | `Conversa.dc.html` |
| 08 | Catálogo de cards | `Catalogo.dc.html` |
| 09 | Ajustes — Meta | `Ajustes.dc.html` |
| 10 | Onboarding 1 — Entrar com a Meta | `Conectar.dc.html` |
| 11 | Onboarding 2 — Escolher conta | `Conta.dc.html` |
| 12 | Onboarding 3 — Verificar | `Verificacao.dc.html` |
| 13 | Automações básicas | `Basico.dc.html` |
| 14 | Cumprimente novos seguidores | `Seguidores.dc.html` |
| 15 | Ajustes — canal Instagram | `Canal.dc.html` |
| — | Componente · Sidebar (72×960) | `Sidebar.dc.html` |

**Celular (390×844):** `M-Login`, `M-Painel`, `M-Automacoes`, `M-Construtor`, `M-Fluxo`, `M-Contatos`, `M-Conversa`, `M-Conectar` + `TabBar` (barra de abas, 390×76).

**Tablet (834×1194):** `T-Painel`, `T-Automacoes`, `T-Construtor`, `T-Fluxo`, `T-Contatos`, `T-Conversa`.

**Guia passo a passo (1080×1350):** `Main` (capa), `Passo-1` a `Passo-8` (+ `Passo-7b`), `Prompt-1` a `Prompt-4`, `Checklist`.

## Stack planejada

Next.js (App Router) + TypeScript · PostgreSQL + Prisma (Supabase como hospedagem do Postgres) · Tailwind CSS · React Flow · Instagram Messaging API · Vercel

## Etapas (do prompt em `docs/guia-passo-a-passo.md`)

- [x] 1. Modelagem do banco de dados (schema Prisma) — ver `docs/etapa-1-banco.md`
- [x] 2. Editor visual de fluxos com React Flow — ver `docs/etapa-2-editor.md`
  - [x] Builder simples (automação rápida) — ver `docs/etapa-2b-builder-simples.md`
- [ ] 3. Motor de automação (webhook do Instagram)
- [ ] 4. Botões fixos (button template, nunca quick reply)
- [ ] 5. Carrossel/catálogo de cards
- [ ] 6. Painel de contatos, etiquetas e histórico
- [ ] 7. App no Meta for Developers
- [ ] 8. Deploy na Vercel + webhook + teste real

## Rodando localmente

```bash
cp .env.example .env   # preencha DATABASE_URL e DIRECT_URL
npm install
npx prisma migrate dev          # cria as tabelas
npx prisma db seed              # exemplos: automação rápida e fluxo avançado
npm run dev                     # abra http://localhost:3000/fluxos
```

Testes e checagens: `npm test` · `npm run lint` · `npm run build`
