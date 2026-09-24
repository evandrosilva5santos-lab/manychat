# Fluxo — automação de conversas para Instagram

Sistema próprio de automação (comentário → DM → botão → etiqueta), inspirado no ManyChat.

## `design/`

Telas desenhadas no canvas de Design do Claude (arquivos `.dc.html`):

- **Desktop (1440×960):** Login, Painel, Automações, Builder simples, Builder avançado, Contatos, Conversas, Catálogo de cards, Ajustes (Meta), Onboarding com a Meta (3 etapas), Automações básicas, Cumprimente novos seguidores, Canal Instagram
- **Celular (390×844):** arquivos `M-*.dc.html` + `TabBar.dc.html`
- **Tablet (834×1194):** arquivos `T-*.dc.html`
- **Guia passo a passo:** `Main`, `Passo-*`, `Prompt-*`, `Checklist`
- `canvas.json`: índice das telas; `ds/fluxo/tokens.json`: tokens do design system Fluxo

## Stack planejada

Next.js (App Router) + TypeScript · PostgreSQL + Prisma · Tailwind · React Flow · Instagram Messaging API · Vercel
