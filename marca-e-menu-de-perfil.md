# Marca instachat + Menu de perfil

> **Status 12/10/2026:** entregue na pasta oficial com ajustes às decisões abaixo — cor real do logo (`brand` #FB264D, `primary` #DC1A44), nome em minúsculas ("instachat") e fonte Plus Jakarta mantida. Ver `state/CHANGELOG.md`.

## Goal
Aplicar a identidade InstaChat (brand book v1.0, `~/Downloads/Instachat_Brand_Book_Completo.pdf`) ao design system e às telas, e entregar o menu de perfil/troca de conta especificado em `menu-perfil-conta.md` (diretório principal).

## Decisões
| Decisão | Motivo |
|---|---|
| `primary` vira coral; preenchimento com texto branco usa `#E8164A` (4,5:1) e `#FF2D55` fica como `brand` (logo, destaques grandes, ícone) | Brand book: coral é a cor de ação; `#FF2D55` com texto branco dá 3,6:1 e reprova WCAG AA em botão |
| `danger` passa a vermelho-tijolo escuro `#B42318`, sempre com ícone + palavra | Separar erro do coral da marca |
| `ink` = carvão `#151A24`, `ink-muted` = `#69717D`, `primary-soft` = `#FFF0F3` | Paleta institucional |
| Fonte Lato (400/700/900) no lugar de Plus Jakarta; JetBrains Mono continua para IDs/URLs | Brand book §13 |
| Símbolo vetorizado em SVG (bolha "C" com três pontos) para favicon, sidebar e avatar; logotipo completo só ≥ 120 px de largura | Brand book §10 e §15 |
| Nome do produto na interface: "InstaChat" | Marca e domínio `instachat.startinc.com.br` |
| Menu: editar nome/e-mail fica para depois; "Desconectar" em `/contas` = descarregar (mantém histórico) | Perguntas em aberto do `menu-perfil-conta.md` |
| "Sair" encerra a sessão; acesso pelo Basic Auth do operador continua até fechar o navegador — a tela avisa | O navegador guarda a credencial do Basic Auth |

## Tasks
- [ ] 1. **Marca (agente E)** — tokens claro/escuro em `src/app/globals.css` e `design-system/tokens.*`, Lato via `next/font`, `src/components/brand/` (símbolo SVG + logotipo), `src/app/icon.svg` + `apple-icon.png`, logotipo transparente e negativo em `public/brand/`, "InstaChat" em `/conectar`, `/privacidade`, `/termos`, `/exclusao-de-dados`, `design-system/README.md` atualizado → Verify: contraste ≥ 4,5:1 nos pares de texto, `tsc`, build.
- [ ] 2. **Menu de perfil (agente F)** — `getUserMenuData`, `logout`, `ActiveAccountMenu` (topo da sidebar), `UserMenu` (avatar inferior), página `/contas`, faixa de estado também para token vencendo em < 7 dias, remoção do `<select>` do cabeçalho → Verify: testes de escopo por workspace, logout e ações de `/contas`.
- [ ] 3. **Integração (líder)** — símbolo na sidebar, fonte e título no `layout.tsx` → Verify: `tsc`, testes, build.
- [ ] 4. **Revisão + validação no Chrome** em 375px e 1440px (menu, `/contas`, diálogos, faixa, `/conectar`) → Verify: capturas; nenhuma ação destrutiva em conta real.
- [ ] 5. **Governança** — CHANGELOG, STATUS, TASK_QUEUE, ADR-008 (marca) → Verify: entradas datadas.

## Done When
- [ ] Interface com a marca InstaChat sem quebrar contraste; menu de perfil e troca de conta em 2 cliques; `/contas` funcionando; testes, tipos e build verdes.
