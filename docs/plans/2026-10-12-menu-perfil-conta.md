# Menu de Perfil + Troca de Conta do Instagram

> Status: **ENTREGUE em 12/10/2026** (commit `5c4d966`), exceto a checagem visual em 375px/1440px no navegador (item 9) — o banco local ainda não tem a migration de opt-out (BLK-008).
> Respostas às perguntas em aberto: edição de nome/e-mail fica para depois; "Desconectar" = **Descarregar** (mantém o histórico), igual a Ajustes.
> Referência visual: tela do ManyChat (menu do avatar no canto inferior esquerdo).

## Goal
Dar ao usuário um lugar óbvio para **ver quem está logado**, **trocar de conta do Instagram** e **sair**, no padrão do ManyChat.

## Estado atual (Fluxo)
- Troca de conta: um `<select>` invisível no header superior direito ([AccountSwitcher.tsx](src/components/layout/AccountSwitcher.tsx)). Funciona, mas é pouco visível.
- Avatar no rodapé da Sidebar: só um link para `/ajustes`. Não mostra nome nem e-mail.
- Não existe botão **Sair**.
- Não existe aviso global quando a conta ativa precisa de reconexão.
- Back-end já pronto: `listAccessibleAccounts`, `setActiveAccount`, `getTenantContext` em [tenancy.ts](src/lib/tenancy.ts) e a action `switchActiveInstagramAccount`.

## Decisões (Decision Log)
| Decisão | Alternativas | Motivo |
| :--- | :--- | :--- |
| Seletor de conta no topo da Sidebar (avatar do IG) | Manter no header | Igual ao ManyChat; fica sempre visível |
| Dados do usuário no popover do avatar inferior | Página `/perfil` | Acesso em 1 clique, sem tela nova |
| Página `/contas` para gestão completa | Tudo no popover | Popover fica leve; tabela comporta status/token/ações |
| Fora do escopo: idioma, modelos, API, apps, opções de login | Copiar tudo do ManyChat | YAGNI: nada disso existe no produto hoje |

## Tasks
- [x] 1. `getUserMenuData()` em `src/lib/tenancy.ts` (actor + contas + conta ativa, sem token) → Verify: teste unitário retorna só contas do workspace do CLIENT.
- [x] 2. Action `logout()` em `src/app/actions/auth.ts` (apaga `UserSession` pelo hash e limpa os 3 cookies) → Verify: teste confirma sessão removida e cookies apagados.
- [x] 3. `ActiveAccountMenu.tsx`: avatar do IG no topo da Sidebar + popover com lista, status, "+ Conectar conta" e "Gerenciar contas" → Verify: clicar troca a conta e a página recarrega com os dados dela.
- [x] 4. `UserMenu.tsx`: popover do avatar inferior com nome, e-mail, papel, Gerenciamento de contas, Ajustes, Painel Admin (só SUPERADMIN), Privacidade/Termos e Sair → Verify: CLIENT não vê "Painel Admin"; "Sair" leva para `/sair` (página pública que explica a senha do site guardada pelo navegador).
- [x] 5. Página `/contas`: tabela (foto, @usuário, provedor, status, validade do token) com Ativar / Reconectar / Desconectar → Verify: conta de outro workspace não aparece nem é acionável.
- [x] 6. `ConnectionHealthBanner.tsx` no layout: aparece se a conta ativa não está `CONNECTED` ou o token vence em < 7 dias → Verify: forçar status `EXPIRED` no banco mostra o aviso com botão "Reconectar".
- [x] 7. Remover o `<select>` do header e ligar tudo no `layout.tsx` → Verify: header limpo, nenhuma regressão visual em 375px e 1440px.
- [x] 8. Acessibilidade dos popovers (Esc fecha, foco volta ao gatilho, `aria-expanded`, navegação por teclado) → Verify: navegar só com Tab/Enter/Esc.
- [~] 9. Verificação final: `npx tsc --noEmit`, `npm test`, `npm run build` e checagem no navegador em `localhost:3007`.

## Done When
- [x] Usuário vê nome e e-mail em 1 clique e consegue sair.
- [x] Troca de conta em 2 cliques, sempre visível no topo da Sidebar.
- [x] Aviso global quando a conta ativa precisa de reconexão (faixa existente + aviso de vencimento < 7 dias).
- [x] Zero erros de tipo, todos os testes verdes, build ok.

## Premissas
- Escala: até ~50 contas por SUPERADMIN, 1–5 por cliente → lista simples; busca só acima de 6 contas.
- Segurança: toda troca/desconexão revalida acesso no servidor (`selectActiveAccount`); nenhum token vai para o cliente.
- Sem mudança de schema Prisma.

## Perguntas em aberto
1. O usuário deve poder **editar nome/e-mail** no menu agora, ou fica para depois?
2. "Desconectar" na página `/contas` apaga a conta ou só revoga o token (mantendo histórico)?

---

## Prompt de implementação (PRD para o agente executor)

```
Papel: Você é um engenheiro full-stack sênior em Next.js 16 (App Router, Server Actions), React 19, TypeScript strict, Prisma 7 e Tailwind v4, trabalhando no repositório "Fluxo" (automação de Instagram, porta 3007).

Objetivo: Implementar o menu de perfil do usuário e a troca de conta do Instagram no padrão do ManyChat: avatar da conta ativa no topo da Sidebar (troca de conta), avatar do usuário no rodapé da Sidebar (dados do usuário + Sair), página /contas para gestão completa e um aviso global de reconexão.

Contexto obrigatório (leia antes de codar):
- AGENTS.md, CLAUDE.md, docs/RULES.md, docs/DESIGN.md e node_modules/next/dist/docs/ (esta versão do Next tem mudanças).
- src/lib/tenancy.ts já tem: getCurrentActor, requireActor, listAccessibleAccounts, selectActiveAccount, setActiveAccount, clearActiveAccount, getTenantContext e os cookies ACTIVE_ACCOUNT_COOKIE, SESSION_COOKIE, IMPERSONATION_COOKIE.
- src/app/actions/tenancy.ts tem switchActiveInstagramAccount(accountId).
- src/components/layout/AccountSwitcher.tsx hoje é um <select> invisível no header (será substituído).
- src/components/layout/Sidebar.tsx tem o avatar inferior apontando para /ajustes.
- Modelos: User(name, email, role SUPERADMIN|CLIENT), Workspace(ownerId), InstagramAccount(username, name, profilePicUrl, status, tokenExpiresAt, authProvider, workspaceId), UserSession(tokenHash, expiresAt).

Instruções passo a passo:
1. Em src/lib/tenancy.ts crie getUserMenuData(): retorna { actor, accounts, activeAccountId, impersonatedWorkspaceId }. Cada conta expõe apenas id, username, name, profilePicUrl, status, tokenExpiresAt, authProvider. Nunca exponha accessTokenEnc.
2. Crie src/app/actions/auth.ts com logout(): apaga a UserSession pelo hash do cookie, remove os 3 cookies e redireciona para /conectar.
3. Crie src/components/layout/ActiveAccountMenu.tsx (client): avatar da conta ativa com bolinha de status no topo da Sidebar; ao clicar abre popover com a lista de contas (foto, @usuário, status), marca a ativa, campo de busca só se houver mais de 6 contas, itens "+ Conectar nova conta" (/conectar) e "Gerenciar contas" (/contas). A troca usa switchActiveInstagramAccount dentro de useTransition, com estado de carregamento.
4. Crie src/components/layout/UserMenu.tsx (client): popover do avatar inferior com cabeçalho (iniciais, nome, e-mail, selo do papel), itens "Gerenciamento de contas", "Ajustes", "Painel Admin" (somente SUPERADMIN), "Privacidade", "Termos" e "Sair" (chama logout).
5. Crie src/app/contas/page.tsx (server) + ContasClient.tsx: tabela com foto, @usuário, provedor, status, validade do token e ações Ativar, Reconectar (link para /api/auth/instagram/login) e Desconectar. Toda ação revalida acesso no servidor com selectActiveAccount.
6. Crie src/components/layout/ConnectionHealthBanner.tsx: faixa no topo quando a conta ativa não está CONNECTED ou o token vence em menos de 7 dias, com botão "Reconectar".
7. Atualize src/app/layout.tsx e Sidebar.tsx para usar os novos componentes e remova o <select> do header.
8. Popovers acessíveis: Esc e clique fora fecham, foco volta ao gatilho, aria-expanded/aria-haspopup, navegação por teclado, alvo mínimo de 40px.

Restrições:
- Não altere prisma/schema.prisma, PRD.md, webhooks nem o motor (src/lib/engine).
- Use apenas tokens do design system (bg-surface-*, text-ink*, border-border, primary, success, danger, warning). Sem cores soltas.
- Erros devem aparecer para o usuário com mensagem clara; nada de falha silenciosa.
- Textos em português do Brasil, linguagem simples.
- Fora do escopo: troca de idioma, modelos, configurações de API, minhas aplicações, opções de login vinculadas, edição de perfil.

Testes (escreva antes de implementar):
- getUserMenuData: CLIENT só vê contas do próprio workspace; SUPERADMIN vê todas; nenhum campo de token no retorno.
- logout: sessão apagada e cookies removidos.
- Ações de /contas: conta de outro workspace gera AccountAccessError.

Resultado esperado:
- Lista dos arquivos criados/alterados com 1 linha de motivo cada.
- Saída de npx tsc --noEmit (0 erros), npm test (todos verdes) e npm run build (sucesso).
- Registro em state/CHANGELOG.md e state/STATUS.md.

Checagem final: confirme que (a) a troca de conta funciona em 2 cliques, (b) o usuário vê nome/e-mail em 1 clique, (c) "Sair" encerra a sessão de verdade, (d) nenhum cliente consegue ver ou acionar conta de outro workspace, (e) o layout funciona em 375px e 1440px.
```
