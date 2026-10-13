# O que só você pode fazer (passo a passo simples)

> Atualizado em 12/10/2026. Tudo o que não dependia de você já foi feito no código.
> A ordem abaixo é a de importância.

---

## 1. ~~Autorizar o deploy~~ — feito em 13/10/2026

A versão nova está no ar em <https://instachat.startinc.com.br>.

O que já aconteceu no deploy:
- a mudança no banco do opt-out ("PARAR") é aplicada;
- o agendamento diário que destrava os nós "Esperar" passa a rodar (a senha dele, `CRON_SECRET`, já está cadastrada na Vercel).

---

## 1b. ⚠️ Ligar o webhook no app da Meta (sem isto, NADA responde)

Diagnóstico de 13/10/2026: o perfil `@evansantoos` está conectado e inscrito (`comments`, `messages`, `messaging_postbacks`), a automação está AO VIVO, mas **a Meta nunca chamou o instachat** — o app não tem endereço de webhook configurado.

1. Em <https://developers.facebook.com/apps>, abra o app › **Instagram** › **Configuração da API com login do Instagram** › passo **2. Configurar webhooks**.
2. **URL de retorno de chamada:** `https://instachat.startinc.com.br/api/webhook/instagram`
3. **Verificar token:** o valor de `WEBHOOK_VERIFY_TOKEN` (Vercel › projeto *manychat* › Settings › Environment Variables › `WEBHOOK_VERIFY_TOKEN` › ícone do olho). Clique em **Verificar e salvar**.
4. Na lista de campos logo abaixo, clique em **Inscrever** em `comments`, `messages` e `messaging_postbacks`.
5. Enquanto o app estiver em **Desenvolvimento**, a Meta só entrega eventos de contas com função no app: teste comentando com **outra** conta do Instagram que seja **testadora** do app (comentário do próprio `@evansantoos` é ignorado de propósito, para o perfil não responder a si mesmo).

---

## 2. Painel da Meta: cadastrar 3 endereços (10 minutos)

Entre em <https://developers.facebook.com/apps>, abra o seu app e cole os endereços abaixo.

| Onde clicar | Campo | Cole isto |
| :--- | :--- | :--- |
| Instagram › Configuração da API com login do Instagram › Configurar o login comercial | URL de redirecionamento OAuth | `https://instachat.startinc.com.br/api/auth/instagram/callback` |
| (mesma tela) | URL de retorno de chamada para cancelar autorização | `https://instachat.startinc.com.br/api/meta/deauthorize` |
| (mesma tela) | URL de solicitação de exclusão de dados | `https://instachat.startinc.com.br/api/meta/data-deletion` |
| Login do Facebook para Empresas › Configurações | URIs de redirecionamento do OAuth válidos | `https://instachat.startinc.com.br/api/auth/instagram/callback` |
| (mesma tela) | URL de retorno de chamada para cancelar autorização | `https://instachat.startinc.com.br/api/meta/deauthorize` |
| Configurações do app › Básico › Exclusão de dados do usuário | URL de retorno de chamada | `https://instachat.startinc.com.br/api/meta/data-deletion` |

Depois, em **Funções do app › Funções**, adicione a sua conta do Instagram como **Testador do Instagram** e aceite o convite no app do Instagram (Configurações › Apps e sites › Convites de testador).

Detalhes, se precisar: `docs/etapa-7-meta-app.md`, seção 2.

---

## 3. Recarregar os dois perfis (2 minutos, depois do passo 2)

`@movingfestival` e `@loveu.sunset` estão **descarregados**: as automações deles estão paradas.

1. Abra o painel e clique no avatar do perfil, no topo da barra lateral.
2. Clique em **Gerenciar contas**.
3. Em cada perfil, clique em **Carregar de novo** e entre com o Instagram.

---

## 4. Decisões rápidas (responda para o Claude)

| # | Pergunta | Sugestão do Claude |
| :--- | :--- | :--- |
| A | Mensagens antigas devem ser apagadas sozinhas depois de X dias, ou ficam até o cliente pedir para apagar? (hoje a política de privacidade diz "até pedir") | Manter "até pedir" e revisar com o jurídico |
| B | Quem mandou "PARAR" volta a receber automações só quando mandar "VOLTAR", ou quando escrever qualquer coisa? | Só com "VOLTAR" (já está assim) |
| C | Remover do menu as páginas "Agentes de IA" e "Transmissão", que só dizem "Em breve"? | Remover até existirem |
| D | Remover o código de cobrança Stripe, que não faz nada (o PRD diz que cobrança está fora do MVP)? | Remover agora; refazer quando for vender |

---

## 5. Opcionais (quando quiser)

- **Esperas de poucos minutos sem depender de tráfego:** criar conta grátis no Upstash QStash — passo a passo em `docs/agendador-qstash.md` (os passos 1 e 2 de lá já estão feitos).
- **Alerta de erros (Sentry):** criar um projeto grátis em <https://sentry.io> e mandar o "DSN" para o Claude.
- **Limpar pastas antigas do projeto:** cole no terminal do Claude Code:
  ```
  ! git worktree prune && git worktree remove .claude/worktrees/agent-a199b46d3efcb481f && git worktree remove .claude/worktrees/agent-acda6f01134281660 && git worktree remove .claude/worktrees/token-renew
  ```
