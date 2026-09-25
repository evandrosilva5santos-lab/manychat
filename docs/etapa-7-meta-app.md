# Etapa 7 — Configuração do App no Meta for Developers

> **Resumo em português simples:**  
> Para que o seu sistema envie e receba mensagens automaticamente pelo Instagram, ele precisa de uma "autorização oficial" da Meta (dona do Instagram, Facebook e WhatsApp).  
> Sem essa porta de entrada oficial, qualquer envio de DM seria considerado invasivo e bloqueado pelo Instagram. Aqui está o passo a passo completo, mastigado e sem termos complicados, para conectar o seu perfil profissional.

---

## 1. Pré-Requisitos (Antes de Abrir o Painel)

1. **Conta Profissional no Instagram:**  
   Seu perfil precisa ser do tipo **Criador de Conteúdo** ou **Comercial (Business)**. Perfis pessoais não possuem acesso à API de mensagens.
2. **Página no Facebook Vinculada:**  
   No aplicativo do Instagram no celular: vá em *Configurações › Tipo de Conta e Ferramentas › Conectar ou Criar Página do Facebook*.

---

## 2. Passo a Passo no Meta for Developers

### Passo 1 — Criar Conta de Desenvolvedor
1. Acesse [developers.facebook.com](https://developers.facebook.com).
2. Faça login com a sua conta normal do Facebook.
3. Se for seu primeiro acesso, clique em **Começar** e confirme seu número de telefone e e-mail.

### Passo 2 — Criar um Novo App
1. Clique no botão verde **Criar App** (ou *Create App*).
2. Quando a Meta perguntar *"O que você deseja que o seu aplicativo faça?"*, selecione a opção **Outro** (Other) e clique em Avançar.
3. Na tela seguinte, selecione o tipo de aplicativo: **Empresa** (Business).
4. Dê um nome para o app (ex: `Meu ManyChat`) e insira seu e-mail de contato.

### Passo 3 — Adicionar o Produto Instagram
1. No painel do seu novo App, localize o cartão **API do Instagram Graph** (ou *Instagram Graph API*) e clique em **Configurar**.
2. No menu lateral esquerdo, vá em **Configurações Básicas** do aplicativo e anote:
   * **ID do Aplicativo** (`META_APP_ID`)
   * **Chave Secreta do Aplicativo** (`META_APP_SECRET`)

### Passo 4 — Gerar o Token de Acesso de Longa Duração (60 Dias)
1. No menu superior, abra a ferramenta **Explorador da Graph API** (Graph API Explorer).
2. No campo *Aplicativo da Meta*, selecione o seu App recém-criado.
3. No campo *Permissões*, adicione as três permissões essenciais:
   * `instagram_business_basic`
   * `instagram_business_manage_messages`
   * `instagram_business_manage_comments`
4. Clique em **Generate Access Token** e faça login com a conta que gerencia a página do Instagram.
5. Copie o token gerado. *(Observação: esse token dura 1 hora; para transformá-lo no token de 60 dias, use a ferramenta de depuração de token da Meta ou clique no botão "Renovar Token" dentro de `/ajustes` no nosso painel)*.

---

## 3. Configurando o Webhook da Meta

O Webhook é o "endereço de entrega" para onde o Instagram manda os comentários e DMs que chegam no seu perfil:

1. No menu lateral do seu app na Meta, clique em **Webhooks** (embaixo de Instagram).
2. Clique em **Editar URL de retorno de chamada**:
   * **URL de Retorno:** `https://[seu-site-na-vercel].vercel.app/api/webhook/instagram`
   * **Token de Verificação:** O mesmo texto que você configurou no seu `.env` na variável `WEBHOOK_VERIFY_TOKEN` (ou copie da tela `/ajustes`).
3. Clique em **Verificar e Salvar**. A Meta fará uma chamada de teste GET instantânea; nosso sistema responderá com o `hub.challenge` e a conexão será ativada com sucesso!
4. Na tabela de campos, clique em **Assinar** para os dois campos obrigatórios:
   * `comments` (para escutar comentários em posts e reels)
   * `messages` (para escutar DMs e cliques de botões)

---

## 4. Modo de Teste vs App Review (Você Não Precisa de Aprovação Imediata!)

Uma dúvida muito comum de quem cria seu próprio ManyChat: *"Preciso enviar para a aprovação da Meta antes de começar a usar?"*

> **A resposta é NÃO, se você for usar para as suas próprias contas!**

* **Modo de Desenvolvimento:** Enquanto o App da Meta estiver em *Modo de Desenvolvimento*, qualquer conta adicionada como **Testadora (Tester)** no menu *Funções do App › Funções* pode interagir com o bot, receber DMs e rodar as automações de verdade sem precisar de nenhuma revisão da Meta.
* **App Review (Apenas se for vender para terceiros):** Se você quiser criar um SaaS onde clientes desconhecidos conectam seus próprios perfis, aí sim você envia para revisão. Para isso, já deixamos todos os textos prontos em `/ajustes` e abaixo:

### Justificativas Prontas para Copiar e Colar no App Review:

* **Para `instagram_business_manage_messages`:**
  > *"After a follower comments a configured keyword, we send that follower a one-time private reply with content the account owner set up, typically a link or answer the follower asked for by commenting. This is the standard Instagram comment-to-DM flow. We send one reply per matching comment and respect Meta's rate limits."*

* **Para `instagram_business_manage_comments`:**
  > *"When a follower comments a keyword the account owner configured on the owner's own post or reel, we receive the comment through the comments webhook and, if the owner enabled it, post a public reply under that comment. We only act on comments on the connecting account's own media."*

---

## 5. Tela de Ajustes no Sistema (`/ajustes`)

Criamos a tela [`http://localhost:3001/ajustes`](http://localhost:3001/ajustes) onde você pode:
* Visualizar o status da conexão em tempo real.
* Testar se as credenciais da Meta estão válidas com um clique.
* Copiar a URL de Webhook e o Verify Token formatados.
* Renovar o Token de 60 dias diretamente pelo painel (`refreshLongLivedToken`).
* Inscrever automaticamente os webhooks através da chamada oficial `POST /{igUserId}/subscribed_apps`.
