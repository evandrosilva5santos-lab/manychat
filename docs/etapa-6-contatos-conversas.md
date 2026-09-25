# Etapa 6 — Painel de Contatos e Histórico de Conversas (Live Inbox)

> **Resumo em português simples:**  
> Nesta etapa, construímos a central de atendimento e CRM do seu ManyChat próprio:  
> 1. O **Painel de Contatos (`/contatos`)**, com busca, filtro por etiquetas e identificação de seguidores.  
> 2. O **Live Inbox / Bate-Papo ao vivo (`/conversas`)**, onde você lê o histórico completo das mensagens (comentários, botões clicados, carrosséis) e pode responder manualmente o seguidor pelo computador, respeitando a **Regra da Janela de 24 Horas da Meta**.

---

## 1. A Regra Sagrada da Meta: A Janela de 24 Horas do Direct

A Meta possui uma política muito rígida contra spam no Instagram:
* Quando um seguidor manda uma DM para o seu perfil ou clica em um botão, **abre-se uma janela de 24 horas**.
* Durante essas 24 horas, sua conta tem permissão total para mandar mensagens diretas para ele (sejam automáticas do fluxo ou manuais pelo painel).
* **Após 24 horas sem que o seguidor mande nenhuma nova mensagem:** a Meta **bloqueia o envio livre de novas DMs**. O sistema só volta a poder falar com ele quando o próprio seguidor mandar uma nova mensagem ou comentar em um post novo.

### Como implementamos isso no sistema:
* No arquivo [`src/lib/meta/window.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/lib/meta/window.ts), calculamos a função `check24hWindow(lastInboundAt)` em tempo real.
* Se a janela estiver aberta: exibe um contador em verde (ex: *"Janela aberta · 22h restantes"*).
* Se a janela estiver expirada: a caixa de digitação manual é travada defensivamente e um aviso educativo explica por que não é possível enviar mensagem avulsa naquele momento, protegendo sua conta do Instagram contra bloqueios ou perda de permissões na Meta.

---

## 2. Filtro Anti-Auto-Comentário (Inspirado no OpenReply)

Quando você mesmo entra no Instagram pelo celular para responder um seguidor, o webhook da Meta recebe o evento desse comentário.  
Se o sistema não filtrasse isso, o bot tentaria responder a você mesmo e mandar uma DM para a própria conta da empresa (gerando erros na API).

No arquivo [`src/lib/meta/webhook.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/lib/meta/webhook.ts):
```typescript
// Se o autor do comentário for o próprio dono da conta, ignora silenciosamente:
if (val.from?.id === igUserId) continue;

// Se o remetente da DM for o próprio dono da conta, ignora:
if (userIgsid === igUserId) continue;
```
Isso garante estabilidade 100% à prova de loops e erros fantasmas.

---

## 3. O Painel de Contatos (`/contatos`)

O painel de contatos funciona como um **CRM dedicado do Instagram**:
* **Avatar e Nome:** Mostra a foto, o nome e o `@username` com link direto para o perfil no Instagram.
* **Etiquetas (Tags):** Mostra todas as etiquetas aplicadas pelos fluxos (ex: `lead-quente`, `casamento-2026`). Permite adicionar ou remover etiquetas na hora com 1 clique.
* **Status de Seguidor:** Identifica visualmente quem já segue o perfil e quem foi capturado sem seguir.
* **Origem:** Identifica qual fluxo ou publicação trouxe aquele lead.
* **Atalho Direto:** Botão *"Bate-Papo"* que abre imediatamente a conversa daquele lead na tela de chat.

---

## 4. O Live Inbox / Bate-Papo (`/conversas`)

A interface foi projetada no padrão de classe mundial do ManyChat Pro e Slack:
1. **Coluna Esquerda:** Lista de conversas com filtro rápido (*Todas* ou *Janela 24h Ativas*), busca por texto e avatar com status em tempo real.
2. **Coluna Central:** Linha do tempo visual da conversa:
   * Balões cinza à esquerda: mensagens recebidas do lead (`IN`), comentários feitos em posts e cliques em botões.
   * Balões azuis à direita: mensagens automáticas (`OUT`), botões fixos entregues, carrosséis de cards e respostas públicas enviadas no post.
   * Barra de envio manual (composer) para atendimento humano.
3. **Coluna Direita (Drawer de Lead):** Dados cadastrais, IGSID (ID único da Meta), gerenciador de tags e status de follow.

---

## 5. Arquivos Implementados nesta Etapa

* [`src/lib/meta/window.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/lib/meta/window.ts): Cálculo da janela de 24 horas da Meta.
* [`src/lib/meta/webhook.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/lib/meta/webhook.ts): Filtro anti-auto-comentário e anti-auto-mensagem.
* [`src/app/contatos/actions.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/app/contatos/actions.ts): Server Actions para listar contatos, aplicar tags e filtrar leads.
* [`src/app/contatos/page.tsx`](file:///Volumes/Vol%20Macbook/App/Manychat/src/app/contatos/page.tsx) & [`src/app/contatos/ContactsClient.tsx`](file:///Volumes/Vol%20Macbook/App/Manychat/src/app/contatos/ContactsClient.tsx): CRM visual de contatos.
* [`src/app/conversas/actions.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/app/conversas/actions.ts): Server Actions de mensagens e live inbox com bloqueio defensivo da regra de 24h.
* [`src/app/conversas/page.tsx`](file:///Volumes/Vol%20Macbook/App/Manychat/src/app/conversas/page.tsx) & [`src/app/conversas/InboxClient.tsx`](file:///Volumes/Vol%20Macbook/App/Manychat/src/app/conversas/InboxClient.tsx): Interface completa de Live Inbox / Bate-papo.
* [`src/lib/engine/engine.test.ts`](file:///Volumes/Vol%20Macbook/App/Manychat/src/lib/engine/engine.test.ts): Testes unitários com 100% de sucesso cobrindo a janela de 24h e o filtro de comentários próprios.
