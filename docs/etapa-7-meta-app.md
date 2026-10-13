# Etapa 7 — Configuração do App no Meta for Developers

> **Resumo em português simples:**  
> Para que o seu sistema envie e receba mensagens automaticamente pelo Instagram, ele precisa de uma "autorização oficial" da Meta (dona do Instagram, Facebook e WhatsApp).  
> Sem essa porta de entrada oficial, qualquer envio de DM seria considerado invasivo e bloqueado pelo Instagram. Aqui está o passo a passo completo, mastigado e sem termos complicados, para conectar o seu perfil profissional.

---

## 1. Pré-Requisitos (Antes de Abrir o Painel)

1. **Conta Profissional no Instagram:**  
   Seu perfil precisa ser do tipo **Criador de Conteúdo (Creator)** ou **Comercial (Business)**. Perfis pessoais não possuem acesso à API de mensagens.
2. **Escolha do login (há dois caminhos, veja a [seção 2](#2-login-duplo-instagram-e-facebook)):**
   * **Entrar com Instagram** — não precisa de Página do Facebook. A autenticação é feita direto com a conta do Instagram (**Instagram API com login do Instagram**).
   * **Entrar com Facebook** — a conta do Instagram precisa estar **vinculada a uma Página do Facebook**, e quem loga precisa ter acesso a essa Página.

---

## 2. Login Duplo (Instagram e Facebook)

O Fluxo conecta contas profissionais do Instagram por **dois caminhos independentes**. Os dois botões aparecem em `/ajustes` (operador) e em `/conectar` (cliente). Um não depende do outro: se um falhar, o erro real aparece na tela (não existe "tentar o outro por baixo dos panos").

### 2.1 Diferença entre os dois logins

| | **Entrar com Instagram** | **Entrar com Facebook** |
|---|---|---|
| Produto da Meta | Instagram API com login do Instagram | Facebook Login (conta do IG ligada a uma Página) |
| Tela de autorização | `www.instagram.com/oauth/authorize` | `www.facebook.com/v21.0/dialog/oauth` |
| Troca do código | `api.instagram.com` | `graph.facebook.com` |
| Host usado depois (DMs, comentários) | `graph.instagram.com` | `graph.facebook.com` |
| Credenciais (`.env`) | `IG_APP_ID` / `IG_APP_SECRET` (**ID do app do Instagram**) | `META_APP_ID` / `META_APP_SECRET` (ID do App da Meta) |
| Escopos | `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments` | `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `business_management` |
| Quantas contas conecta | A conta do Instagram que fez login | **Todas** as contas do IG das Páginas autorizadas na tela da Meta |
| Validade do token | 60 dias, renovado automaticamente pelo cron | Token de Página, **não expira** |
| Como a conta fica salva | `authProvider = INSTAGRAM_LOGIN` | `authProvider = FACEBOOK_LOGIN` (+ `fbPageId`) |

**Quando usar cada um:**
* **Instagram** é o padrão: serve para qualquer conta Creator/Business, sem Página do Facebook. Use sempre que o cliente tiver só o Instagram.
* **Facebook** serve para quem já gerencia o Instagram por uma Página (agências, Business Manager, várias contas de uma vez) ou quando o login do Instagram estiver bloqueado para aquela conta.

> ⚠️ **`IG_APP_ID` NÃO é o ID do App da Meta.** O app da Meta tem um ID (o que aparece no topo do painel e em *Configurações › Básico*) e o produto Instagram tem **outro ID**, próprio. Se `IG_APP_ID` for igual a `META_APP_ID`, o Fluxo recusa o login antes de ir à Meta, com uma mensagem dizendo que o ID do app do Instagram está errado (antes, a Meta respondia "Invalid platform app").

### 2.2 Checklist do painel da Meta (passo a passo)

Faça uma vez por app. `APP_URL` é a URL pública **https** do Fluxo (ex.: `https://seu-site.vercel.app`).

**A) Credenciais do Facebook Login (`META_APP_ID` / `META_APP_SECRET`)**
1. [developers.facebook.com](https://developers.facebook.com) › **Meus Apps** › seu app › **Configurações do app › Básico**.
2. Copie o **ID do Aplicativo** para `META_APP_ID` e a **Chave Secreta do Aplicativo** para `META_APP_SECRET`.

**B) Credenciais do Instagram Login (`IG_APP_ID` / `IG_APP_SECRET`)**
1. No mesmo app: **Instagram › Configuração da API com login do Instagram**.
2. Vá em **3. Configurar login comercial do Instagram › Configurações do login comercial**.
3. Copie o **ID do app do Instagram** para `IG_APP_ID` e a **Chave secreta do app do Instagram** para `IG_APP_SECRET`.
4. Confira: o número de `IG_APP_ID` precisa ser **diferente** de `META_APP_ID`.

**C) URL de retorno (a mesma para os dois logins, cadastrada em DOIS lugares)**

A URL é sempre: `${APP_URL}/api/auth/instagram/callback` (ex.: `https://seu-site.vercel.app/api/auth/instagram/callback`). Ela também aparece em `/ajustes`, no bloco "Configuração do login", com botão de copiar.

1. **Facebook Login › Configurações › URIs de redirecionamento do OAuth válidos** → cole a URL e salve. Sem isso aparece **"URL bloqueada"**.
2. **Instagram › Configuração da API com login do Instagram › 3. Configurar login comercial do Instagram › Configurações do login comercial › URLs de redirecionamento do OAuth** → cole a mesma URL e salve.

> Iniciar o login a partir do `localhost` funciona: a Meta devolve para a URL de produção, e o Fluxo redireciona de volta para a página de origem (o endereço de retorno vai assinado no `state`).

**D) Detalhes do app (evitam "Recurso indisponível")**
1. **Configurações do app › Básico**: preencha **URL da Política de Privacidade**, **URL dos Termos de Serviço** e **URL de exclusão de dados** (precisam ser públicas e abrir sem login), **Ícone do app** (1024×1024) e **Categoria**.
2. Em **Configurações do app › Básico › Domínios do app**, inclua o domínio de `APP_URL`.
3. Abra o **Painel do app** e resolva tudo que estiver em **Ações obrigatórias** / alertas (ex.: verificação de dados, certificação anual).
4. Se a Meta pedir, conclua a **Verificação da empresa** (*Configurações do app › Básico › Verificação*).

**E) Modo do app e testadores**
* **Modo Desenvolvimento:** só **administradores, desenvolvedores e testadores** do app conseguem logar.
  * Facebook Login: adicione a pessoa em **Funções do app › Funções** (ela aceita o convite no Facebook).
  * Instagram Login: adicione a conta em **Funções do app › Funções › Testadores do Instagram**. O dono da conta precisa aceitar em **instagram.com › Configurações › Apps e sites › Convites de testador**.
* **Modo Ao vivo (Live):** qualquer conta consegue logar, desde que as permissões usadas tenham passado pelo App Review (veja a [seção 5](#5-modo-de-teste-vs-app-review-você-não-precisa-de-aprovação-imediata)).

**F) Variáveis de ambiente (`.env` local e Vercel)**
* `META_APP_ID`, `META_APP_SECRET`, `IG_APP_ID`, `IG_APP_SECRET` (itens A e B).
* `APP_URL` — URL pública https, base da URL de retorno.
* `OAUTH_STATE_SECRET` — opcional; se ficar vazio, o Fluxo usa `TOKEN_ENCRYPTION_KEY`. **Sem nenhum dos dois, o login é recusado** (falha fechada).
* `WEBHOOK_VERIFY_TOKEN` — para o webhook (seção 3).

### 2.3 Erro na tela → causa → correção

| Erro na tela | Causa | Correção |
|---|---|---|
| **"Invalid platform app"** (ou "O ID do app do Instagram está errado") | `IG_APP_ID` está com o ID do App da Meta (ou vazio). O Instagram Login só aceita o **ID do app do Instagram**. | Copie o ID e o secret de **Instagram › Configuração da API com login do Instagram › Configurações do login comercial** para `IG_APP_ID` / `IG_APP_SECRET` (item B) e reinicie/redeploye. |
| **"URL bloqueada"** | A URL `${APP_URL}/api/auth/instagram/callback` não está cadastrada no produto usado. | Cadastre a URL exata nos **dois** lugares do item C. Confira `APP_URL` (https, sem barra no final). |
| **"Recurso indisponível — Login do Facebook está indisponível para esse aplicativo"** | Restrição do lado da Meta no app: ação obrigatória pendente, detalhes do app incompletos, verificação da empresa ou app em modo Desenvolvimento com uma pessoa que não tem função no app. | Siga os itens D e E: resolva **Ações obrigatórias**/alertas, publique política de privacidade, termos e exclusão de dados, ícone e categoria, faça a verificação da empresa se pedida, e em modo Dev adicione a pessoa como admin/desenvolvedor/testador. |
| **"Nenhuma conta profissional do Instagram vinculada a uma Página do Facebook foi autorizada"** | No Entrar com Facebook, nenhuma Página com conta do IG vinculada foi marcada na tela da Meta (ou a conta do IG não está ligada a uma Página). | Vincule o Instagram à Página (nas configurações da Página, em **Contas vinculadas › Instagram**, ou pelo Meta Business Suite) e refaça o login marcando **a Página e a conta do Instagram**. Ou use Entrar com Instagram. |
| **"Sessão de autorização inválida ou expirada"** | O `state` do OAuth não confere: passaram mais de 15 minutos entre o clique e a volta, o link foi reaproveitado, ou o segredo de assinatura mudou/está diferente entre ambientes. | Clique em conectar de novo. Se persistir, confira se `OAUTH_STATE_SECRET` (ou `TOKEN_ENCRYPTION_KEY`) é **o mesmo** no ambiente que inicia e no que recebe o callback. |

Outros erros da Meta também viram mensagens em português (ex.: "Autorização cancelada no Instagram/Facebook.", "Este link de autorização expirou. Clique em conectar novamente.").

### 2.4 Link do cliente (`/conectar` com convite)

O cliente não precisa de conta nem de sessão no Fluxo para conectar o Instagram dele:

1. O operador abre `/ajustes` e copia o **link do cliente**: `${APP_URL}/conectar?convite=<token>`.
2. O `convite` é um token assinado (HMAC) que carrega o **workspace** do cliente e vale **7 dias**. Passou disso, gere um novo em `/ajustes`.
3. O cliente abre o link e escolhe **Entrar com Instagram** ou **Entrar com Facebook**.
4. O Fluxo cria o `state` assinado com o modo, o workspace do convite e a URL de volta (`/conectar?convite=...`) e manda o cliente para a Meta.
5. Na volta, a conta (ou as contas, no caso do Facebook) é salva **no workspace do convite** e o cliente vê a confirmação.
6. Sem convite (ou com convite expirado/adulterado), `/conectar` mostra o aviso **"Peça ao seu gestor o link de conexão"** e os botões ficam desativados.

> Se a conta do Instagram já estiver ligada a outro cliente, a conexão é recusada com "Esta conta do Instagram já está vinculada a outro cliente."

### 2.5 Desautorização e exclusão de dados (obrigatórios na revisão do app)

Quando alguém remove o Fluxo do Instagram ou do Facebook, a Meta avisa o Fluxo por dois endereços. Cadastre-os **nos dois produtos** (troque `${APP_URL}` pelo domínio de produção, ex.: `https://instachat.startinc.com.br`):

| Campo no painel | Instagram (login do Instagram) | Facebook (Login do Facebook) |
|---|---|---|
| **Desautorização** | Instagram › Configuração da API com login do Instagram › Configurar o login comercial › **URL de retorno de chamada para cancelar autorização**: `${APP_URL}/api/meta/deauthorize` | Login do Facebook para Empresas › Configurações › **URL de retorno de chamada para cancelar autorização**: `${APP_URL}/api/meta/deauthorize` |
| **Exclusão de dados** | Mesma tela › **URL de solicitação de exclusão de dados**: `${APP_URL}/api/meta/data-deletion` | Configurações do app › Básico › **Exclusão de dados do usuário** › URL de retorno de chamada: `${APP_URL}/api/meta/data-deletion` |

O que acontece em cada caso:

- **Desautorização:** o Fluxo confere a assinatura (`signed_request`, HMAC-SHA256 com o secret do produto que mandou), acha os perfis daquela pessoa e os deixa **descarregados** (credencial apagada, automações paradas). Pedido assinado há mais de 24 h, adulterado ou de perfil reconectado depois é ignorado.
- **Exclusão de dados:** responde na hora com `{ url, confirmation_code }`. A `url` aponta para `${APP_URL}/exclusao-de-dados?codigo=…`, onde a pessoa acompanha o estado. Pelo login do Instagram, a pessoa é a própria conta profissional: o perfil e os dados dele (contatos, conversas, fluxos) são apagados. Pelo login do Facebook, a pessoa é quem administra a Página: o Fluxo apaga os dados dela (credencial e ID da Meta) e descarrega os perfis, e os dados do negócio só saem por **Ajustes › Excluir perfil e dados** ou por e-mail.
- Em **Configurações do app › Básico**, a **URL de exclusão de dados** pública pode ser `${APP_URL}/exclusao-de-dados`.
- Antes de enviar para revisão, use o **testador de callback** do painel para conferir os dois endereços (resposta 200).

> Perfis conectados antes desta versão não têm o ID que a Meta manda no aviso do Facebook. Eles passam a ser reconhecidos na próxima vez que forem carregados de novo.

---

## 3. Configurando o Webhook da Meta

O Webhook é o "endereço de entrega" para onde o Instagram manda os comentários e DMs que chegam no seu perfil. **Os dois produtos usam a mesma URL e o mesmo token:**

1. No menu lateral do seu app na Meta, clique em **Webhooks** (embaixo de Instagram). Se você usa o Entrar com Facebook, configure também o webhook do objeto **Instagram** no produto Webhooks do app.
2. Clique em **Editar URL de retorno de chamada**:
   * **URL de Retorno:** `${APP_URL}/api/webhook/instagram` (ex.: `https://seu-site.vercel.app/api/webhook/instagram`)
   * **Token de Verificação:** O mesmo texto que você configurou no seu `.env` na variável `WEBHOOK_VERIFY_TOKEN` (ou copie da tela `/ajustes`).
3. Clique em **Verificar e Salvar**. A Meta fará uma chamada de teste GET instantânea; nosso sistema responderá com o `hub.challenge` e a conexão será ativada com sucesso!
4. Na tabela de campos, clique em **Assinar** para os três campos obrigatórios:
   * `comments` (para escutar comentários em posts e reels)
   * `messages` (para escutar DMs e respostas a stories)
   * `messaging_postbacks` (para escutar cliques nos botões fixos das DMs)

> A assinatura dos eventos (`X-Hub-Signature-256`) é aceita tanto com `IG_APP_SECRET` quanto com `META_APP_SECRET`, então eventos dos dois produtos são validados. Ao conectar uma conta, o Fluxo inscreve os webhooks dela automaticamente (Instagram: `POST /{igUserId}/subscribed_apps`; Facebook: `POST me/subscribed_apps` com o token da Página).

---

## 4. Token de Acesso

Com o login duplo, **não é preciso gerar token à mão**: o botão de conectar faz a autorização, troca o código pelo token e salva tudo criptografado no banco.

* **Instagram Login:** token de 60 dias, renovado automaticamente pelo cron (`/api/cron/refresh-tokens`). Também dá para renovar pelo botão em `/ajustes`.
* **Facebook Login:** token de Página, que não expira. O cron pula essas contas.

As variáveis `IG_ACCESS_TOKEN` / `IG_USER_ID` do `.env` são só para testes manuais antigos; o fluxo normal não depende delas.

---

## 5. Modo de Teste vs App Review (Você Não Precisa de Aprovação Imediata!)

Uma dúvida muito comum de quem cria seu próprio ManyChat: *"Preciso enviar para a aprovação da Meta antes de começar a usar?"*

> **A resposta é NÃO, se você for usar para as suas próprias contas!**

* **Modo de Desenvolvimento:** Enquanto o App da Meta estiver em *Modo de Desenvolvimento*, só quem tem função no app consegue logar e rodar as automações de verdade, sem nenhuma revisão da Meta:
  * **Entrar com Facebook:** admins, desenvolvedores e testadores em *Funções do app › Funções*.
  * **Entrar com Instagram:** contas adicionadas em *Funções do app › Funções › Testadores do Instagram*, que aceitaram o convite em *instagram.com › Configurações › Apps e sites*.
* **App Review (Apenas se for vender para terceiros):** Se você quiser criar um SaaS onde clientes desconhecidos conectam seus próprios perfis, aí sim você envia para revisão as permissões do login que for oferecer (as `instagram_business_*` do Instagram Login e/ou as `instagram_*` + `pages_*` + `business_management` do Facebook Login). Para isso, já deixamos todos os textos prontos em `/ajustes` e abaixo:

### Justificativas Prontas para Copiar e Colar no App Review:

* **Para `instagram_business_manage_messages`:**
  > *"After a follower comments a configured keyword, we send that follower a one-time private reply with content the account owner set up, typically a link or answer the follower asked for by commenting. This is the standard Instagram comment-to-DM flow. We send one reply per matching comment and respect Meta's rate limits."*

* **Para `instagram_business_manage_comments`:**
  > *"When a follower comments a keyword the account owner configured on the owner's own post or reel, we receive the comment through the comments webhook and, if the owner enabled it, post a public reply under that comment. We only act on comments on the connecting account's own media."*

> Os mesmos textos servem para `instagram_manage_messages` e `instagram_manage_comments` (equivalentes no Facebook Login).

---

## 6. Tela de Ajustes no Sistema (`/ajustes`)

Criamos a tela [`http://localhost:3007/ajustes`](http://localhost:3007/ajustes) onde você pode:
* Conectar contas com os botões **Entrar com Instagram** e **Entrar com Facebook**.
* Ver o bloco **Configuração do login**: a URL de retorno para copiar e o status de cada produto (verde = pronto; âmbar = falta algo, com o motivo, ex.: `IG_APP_ID` igual ao `META_APP_ID`).
* Copiar o **link do cliente** (`/conectar?convite=...`, válido por 7 dias).
* Visualizar o status da conexão em tempo real.
* Testar se as credenciais da Meta estão válidas com um clique.
* Copiar a URL de Webhook e o Verify Token formatados.
* Renovar o Token de 60 dias diretamente pelo painel (`refreshLongLivedToken`) — só para contas do Instagram Login.
* Inscrever automaticamente os webhooks através da chamada oficial `POST /{igUserId}/subscribed_apps`.

---

## Verificação de Empresa (obrigatória para "Entrar com Facebook")

Diagnóstico feito no painel em 12/10/2026 (app 1911508559530553, tipo **Empresa**):

- **Login do Facebook para Empresas › Configurações** mostra o aviso: *"O Facebook Login for Business requer acesso avançado. Seu app tem acesso padrão a public_profile."*
- Em **Análise do app › Permissões e recursos**, `public_profile` está em *Standard access* com status **"Verificação necessária"**.
- Enquanto isso não for resolvido, a Meta mostra **"Recurso indisponível — o Login do Facebook está indisponível para esse aplicativo"**. Não há correção possível no código.

**Como resolver (dono da empresa):**
1. Em business.facebook.com › Configurações do negócio › Central de segurança, conclua a **Verificação da empresa** (CNPJ/documentos).
2. Volte em Análise do app › Permissões e recursos › `public_profile` › **Solicitar acesso avançado**.
3. (Recomendado) Em Login do Facebook para Empresas › Configurações (lista de configurações), crie uma configuração com as permissões do Instagram e coloque o ID em `META_LOGIN_CONFIG_ID`.

Enquanto isso, use **Entrar com Instagram**, que não depende dessa verificação. Em modo Desenvolvimento, a conta precisa estar em Funções do app › Testadores do Instagram.

**Instagram App ID deste app:** `1544789910543811` (diferente do ID do App da Meta).

