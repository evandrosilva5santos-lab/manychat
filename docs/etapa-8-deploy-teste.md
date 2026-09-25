# Etapa 8 — Deploy na Vercel e Teste Real no Instagram

> **Resumo em português simples:**  
> O seu sistema de automação já está 100% programado e testado localmente. No entanto, o Instagram **não consegue enviar mensagens para o seu computador (`localhost`)**.  
> Para que a Meta envie os comentários e DMs das pessoas para o seu sistema em milissegundos, o sistema precisa estar rodando na nuvem com um endereço público seguro (`https://...`).  
> A **Vercel** é a plataforma ideal para isso: rápida, segura, com certificado SSL/HTTPS automático e plano gratuito.  
> Nesta etapa final, vamos colocar o projeto no ar e executar o primeiro teste real de ponta a ponta com uma conta do Instagram.

---

## 1. Por que o Deploy é Necessário?

Quando um seguidor comenta **"QUERO"** em um post seu no Instagram:
1. O servidor da Meta detecta o comentário.
2. A Meta dispara uma requisição HTTP do tipo `POST` (chamada de **Webhook**) para a URL cadastrada no seu aplicativo.
3. Se essa URL for pública e responder com `HTTP 200 OK` em menos de 5 segundos, a Meta considera a entrega concluída.
4. O nosso motor lê o comentário, responde publicamente no post ("*Te mandei uma DM!*") e envia a DM com os botões fixos.

---

## 2. Passo a Passo do Deploy na Vercel

### Passo 1 — Subir o Código para o GitHub
Se você ainda não enviou as últimas alterações para o seu repositório:
```bash
git add .
git commit -m "feat: implementacao completa das etapas 1 a 8 com painel manychat"
git push origin main
```

---

### Passo 2 — Importar o Projeto na Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login com a sua conta do GitHub.
2. No painel principal, clique no botão **Add New…** › **Project**.
3. Localize o repositório do seu projeto (ex: `Manychat` ou `fluxo`) e clique em **Import**.
4. Em **Framework Preset**, a Vercel detectará automaticamente **Next.js**.

---

### Passo 3 — Cadastrar as Variáveis de Ambiente na Vercel
Antes de clicar em *Deploy*, expanda a seção **Environment Variables** e adicione as variáveis abaixo.

| Variável | O que colocar | Exemplo |
| :--- | :--- | :--- |
| `DATABASE_URL` | URL do PostgreSQL com pooler (Supabase porta 6543) | `postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | URL direta do PostgreSQL (Supabase porta 5432) | `postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:5432/postgres` |
| `SITE_PASSWORD` | Senha criada por você para acessar o painel web | `minha_senha_segura_2026` |
| `SITE_USER` | Usuário de acesso ao painel (padrão: `fluxo`) | `fluxo` |
| `META_APP_ID` | ID do aplicativo criado no Meta for Developers | `123456789012345` |
| `META_APP_SECRET` | Chave secreta do aplicativo no Meta for Developers | `a1b2c3d4e5f6...` |
| `IG_ACCESS_TOKEN` | Token de acesso de 60 dias gerado na Etapa 7 | `EAAB...` |
| `IG_USER_ID` | ID numérico da sua conta comercial do Instagram | `17841400000000000` |
| `WEBHOOK_VERIFY_TOKEN` | Código secreto inventado por você para validar o webhook | `meu_token_secreto_manychat_123` |

> 💡 **Dica Supabase:** Se você usar a integração oficial da Vercel com o Supabase (aba *Storage* na Vercel), as variáveis `POSTGRES_PRISMA_URL` e `POSTGRES_URL_NON_POOLING` são configuradas automaticamente. O nosso sistema já está preparado para ler esses nomes sem nenhuma alteração.

---

### Passo 4 — Configuração do Comando de Build
O projeto já conta com o script `"vercel-build": "prisma generate && prisma migrate deploy && next build"`.  
Nas configurações de build da Vercel (**Build and Output Settings**), você pode deixar o padrão ou definir:
* **Build Command:** `npm run vercel-build`

Clique em **Deploy**. A Vercel criará o build de produção e, ao concluir, fornecerá o seu domínio oficial:
👉 `https://seu-projeto.vercel.app`

---

## 3. Ativando o Webhook Oficial na Meta

Com o site no ar e a URL da Vercel em mãos:

1. Acesse o [Meta for Developers](https://developers.facebook.com) e entre no seu aplicativo.
2. No menu lateral esquerdo, vá em **Instagram** › **Webhooks**.
3. Clique no botão **Editar URL de Retorno de Chamada** (ou *Edit Callback URL*):
   * **URL de Retorno de Chamada:** `https://seu-projeto.vercel.app/api/webhook/instagram`
   * **Token de Verificação:** Digite o mesmo valor que você colocou em `WEBHOOK_VERIFY_TOKEN` na Vercel.
4. Clique em **Verificar e Salvar**.
   * *O que acontece nos bastidores:* A Meta faz uma requisição `GET` com o parâmetro `hub.challenge`. O nosso endpoint valida o token e devolve o desafio com código `200 OK`. O Meta confirmará com um selo verde de sucesso!
5. Na tabela de **Campos de Assinatura**, clique em **Assinar** (Subscribe) nos dois eventos vitais:
   * ✅ `comments` (para capturar comentários em posts e Reels)
   * ✅ `messages` (para capturar mensagens diretas e cliques de botões)

---

## 4. Roteiro do Teste Real com o Instagram

Antes de liberar para todo o público, realize o teste com uma conta pessoal de teste.

### ⚠️ Regra Crítica de Segurança da Meta (Modo de Desenvolvimento)
Enquanto o seu aplicativo da Meta estiver em **Modo de Desenvolvimento** (Development Mode):
* A automação **só responderá para contas registradas como Funções/Testadores** no app da Meta.
* Para adicionar sua conta pessoal de teste:
  1. No painel da Meta, vá em **Funções do Aplicativo** (App Roles) › **Funções**.
  2. Em *Testadores do Instagram*, clique em **Adicionar Testadores do Instagram**.
  3. Digite o `@usuario` da sua conta pessoal de teste.
  4. Abra o Instagram no celular com essa conta pessoal, vá em *Configurações › Tipo de Conta e Ferramentas › Aplicativos e Sites › Convites de Testador* e clique em **Aceitar**.

---

### Checklist de Execução do Teste Real

#### 🧪 Teste 1: Automação por Comentário no Post ou Reel
1. Pelo seu perfil profissional, publique um post ou Reel de teste (ou use um já existente).
2. No painel do nosso sistema (`https://seu-projeto.vercel.app/fluxos`), crie ou ative um fluxo com:
   * **Gatilho:** Comentário em post com a palavra-chave **"CASAMENTO"** (ou "QUERO").
   * **Resposta Pública:** "Acabei de te enviar todos os detalhes no Direct! Dá uma olhada lá 💍"
   * **Primeira DM:** Mensagem com **Botão Fixo** [Ver Opções].
3. Pegue a sua conta pessoal de teste e **comente no post**: `CASAMENTO`.
4. **Verificação Esperada:**
   * Em menos de 3 segundos, seu comentário receberá a resposta pública automática.
   * Seu Instagram pessoal receberá uma notificação de nova DM com a mensagem e o botão fixo.

#### 🧪 Teste 2: Clique no Botão Fixo
1. Dentro da DM recebida no celular, toque no botão fixo **[Ver Opções]**.
2. **Verificação Esperada:**
   * O sistema recebe o clique via webhook `POST` (evento `postback`).
   * O sistema localiza o próximo nó do fluxo e dispara a resposta subsequente sem nenhuma intervenção manual.

#### 🧪 Teste 3: Carrossel de Cards Deslizantes
1. Se o fluxo tiver um nó de **Carrossel** configurado a partir do `/catalogo`:
2. **Verificação Esperada:**
   * A DM exibirá os cards horizontais com imagem 1:1, título, subtítulo e botão de ação.
   * Você poderá deslizar para a direita e interagir com cada item do catálogo.

#### 🧪 Teste 4: Conferência no Painel Live
1. Acesse `https://seu-projeto.vercel.app/contatos`:
   * Seu `@usuario` de teste estará listado com a foto de perfil do Instagram, indicador de seguidor e as etiquetas aplicadas (ex: `#interessado-casamento`).
2. Acesse `https://seu-projeto.vercel.app/conversas`:
   * A conversa completa estará gravada na íntegra no painel central.
   * O selo de **Janela de 24h** estará verde ("Janela Ativa: 24h restantes").
   * Você poderá digitar uma mensagem manual de teste direto pelo painel e ela chegará no celular!

---

## 5. Resolução de Problemas Frequentes (Troubleshooting)

### 🔴 1. A Meta dá erro ao salvar a URL do Webhook
* **Causa:** O token `WEBHOOK_VERIFY_TOKEN` não bate exatamente com o cadastrado na Vercel, ou o deploy na Vercel ainda está em andamento.
* **Solução:** Copie o valor do token de `/ajustes` no seu painel e cole no campo da Meta. Verifique se o endereço termina com `/api/webhook/instagram`.

### 🔴 2. Comentei no post, mas não recebi a DM
* **Causa 1:** O app da Meta está em modo de desenvolvimento e a conta que comentou não foi adicionada aos *Testadores do Instagram*.
* **Causa 2:** O token de acesso expirou. Acesse a página `/ajustes` no painel e clique no botão **Renovar Token de Acesso**.
* **Causa 3:** O post que você comentou não é da mesma conta do Instagram conectada ao token.

### 🔴 3. "Janela de 24 horas fechada" ao tentar responder manualmente
* **Causa:** Política oficial da Meta. Perfis empresariais só podem enviar DMs gratuitas dentro de 24 horas a partir da última mensagem ou comentário enviado pelo usuário.
* **Solução:** O lead precisa mandar uma nova mensagem ou comentário para reabrir a janela de 24 horas.

---

## 6. Conclusão do Roadmap de 8 Etapas

Com a Etapa 8 concluída, o seu sistema conta com:
1. ✅ **Banco de Dados Relacional Completo** (Prisma + Supabase).
2. ✅ **Editor Visual de Fluxos** (Canvas com Nós + Construtor Rápido estilo ManyChat).
3. ✅ **Motor de Automação de Alta Resiliência** (Webhooks HMAC-SHA256, deduplicação e execução assíncrona).
4. ✅ **Botões Fixos Nativos (Button Template)** sem quick replies voláteis.
5. ✅ **Carrossel e Catálogo Reutilizável de Produtos/Cards**.
6. ✅ **CRM de Contatos e Live Inbox com Gestão da Janela de 24 Horas**.
7. ✅ **Painel de Configurações da Meta com Auto-Renovação de Token e Scripts para App Review**.
8. ✅ **Deploy em Nuvem na Vercel com Testes Automatizados (46 testes / 100% de cobertura)**.
