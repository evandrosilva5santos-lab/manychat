# GLOSSARY — Dicionário de Termos e Jargões do Sistema

> **Documento:** Glossário Oficial de Termos de Produto e Tecnologia  
> **Status:** Ativo  
> **Objetivo:** Eliminar ambiguidades entre operadores humanos e agentes de IA  

---

### 1. Easy Builder
- **Definition:** Interface de formulário progressivo em linguagem natural (passo a passo) para criar fluxos de automação sem a necessidade de desenhar nós manualmente em um canvas.
- **Context:** Modo de criação padrão para 90% dos criadores de conteúdo.
- **Related Terms:** `SimpleBuilder`, `FlowRecipe`, `compileRecipe`.

---

### 2. Follow Gate
- **Definition:** Mecanismo condicional que verifica se o usuário do Instagram segue a conta comercial antes de liberar o acesso a um link ou entrega de material.
- **Context:** Aumenta a retenção de seguidores ao vincular a entrega do material ao follow.
- **Related Terms:** `followsAccount`, `ConditionNode`, `FOLLOW_GATE`.

---

### 3. Button Template
- **Definition:** Formato de mensagem interativa da Meta Graph API que exibe um texto acompanhado de até 3 botões permanentes na caixa de diálogo do Instagram Direct.
- **Context:** Formato obrigatório adotado pelo Fluxo. Diferencia-se do `quick_reply` por não sumir após o clique.
- **Related Terms:** `postback`, `sendButtonMessage`, `ADR-003`.

---

### 4. IGSID (Instagram Scoped ID)
- **Definition:** Identificador único do usuário do Instagram gerado no escopo específico da conta comercial/página que está interagindo.
- **Context:** Usado como chave primária de identificação do lead em todas as mensagens do Direct. Não é o username e não é o ID público global do Instagram.
- **Related Terms:** `recipient.id`, `sender.id`, `Contact.igsid`.

---

### 5. Janela de 24 Horas (24h Messaging Window)
- **Definition:** Regra estrita da política da Meta que proíbe o envio de mensagens automatizadas para um usuário caso já tenham se passado mais de 24 horas desde sua última mensagem de entrada.
- **Context:** Invariante crítico para evitar banimento da conta de Instagram na Meta.
- **Related Terms:** `lastInboundAt`, `isWithin24hWindow`, `REG-API-003`.

---

### 6. HMAC SHA-256 Signature
- **Definition:** Assinatura criptográfica enviada no cabeçalho `x-hub-signature-256` de cada requisição de Webhook da Meta, calculada sobre o payload bruto utilizando o `META_APP_SECRET`.
- **Context:** Garante que a requisição partiu legitimamente dos servidores do Instagram.
- **Related Terms:** `verifyWebhookSignature`, `META_APP_SECRET`.

---

### 7. PostPicker
- **Definition:** Componente de interface de usuário que permite ao operador visualizar as últimas postagens, vídeos e Reels da conta do Instagram conectada e selecionar um item específico como gatilho da automação.
- **Context:** Componente em `src/components/simple-builder/PostPicker.tsx`.
- **Related Terms:** `mediaId`, `scope: "specific"`, `GET /api/instagram/media`.

---

### 8. Matcher
- **Definition:** Módulo do motor backend responsável por correlacionar o texto de um comentário ou DM recebido com os gatilhos das automações ativas cadastradas no banco de dados.
- **Context:** `src/lib/engine/matcher.ts`.
- **Related Terms:** `Trigger`, `TriggerType`, `COMMENT_KEYWORD`.

---

### 9. FlowRunner
- **Definition:** Executor assíncrono que processa a sequência de nós de uma automação para um contato específico (`FlowRun`), disparando mensagens, tags ou aguardando postbacks.
- **Context:** `src/lib/engine/engine.ts`.
- **Related Terms:** `Node`, `Edge`, `FlowRun`, `executeStep`.
