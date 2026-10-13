# DECISIONS — Registro de Decisões de Arquitetura (ADRs)

> **Documento:** Architecture Decision Records (ADRs)  
> **Status:** Ativo  
> **Governança:** Start Inc. / Orquestrador de Execução  

---

## ADR-001: Fixação da Porta Operacional `3007`
- **ID:** `ADR-001`
- **DATE:** 2026-09-28
- **CATEGORY:** ENVIRONMENT
- **CONTEXT:** Múltiplas instâncias locais rodando outros serviços nas portas 3000, 3001 e 3002 geravam conflitos de porta frequentes e redirecionamentos indesejados.
- **DECISION:** Fixar permanentemente a porta do projeto Fluxo/Manychat em **`3007`** no `package.json` (`next dev -p 3007` e `next start -p 3007`).
- **RATIONALE:** Garante previsibilidade, testes e acessos diretos sem colisão.
- **IMPACT:** Todos os scripts de dev e testes E2E/QA devem apontar para `http://localhost:3007`.
- **STATUS:** `ACTIVE`
- **SOURCE:** Diretriz explícita do usuário.

---

## ADR-002: Desativação do Basic Auth no Proxy de Desenvolvimento
- **ID:** `ADR-002`
- **DATE:** 2026-09-28
- **CATEGORY:** SECURITY / DX
- **CONTEXT:** O `src/proxy.ts` exigia credenciais HTTP Basic Auth (admin / senha) mesmo em requisições de desenvolvimento local, bloqueando subagentes e ferramentas automáticas de teste.
- **DECISION:** Desativar a exigência de Basic Auth em ambiente de desenvolvimento local, mantendo o proxy funcional para repasse de rotas.
- **RATIONALE:** Elimina atrito desnecessário durante os ciclos de desenvolvimento e auditoria de QA.
- **IMPACT:** Acesso local desimpedido a `/` e `/fluxos`.
- **STATUS:** `ACTIVE`
- **SOURCE:** Decisão de engenharia validada na auditoria técnica.

---

## ADR-003: Uso Estrito de `button template` e Banimento de `quick_reply`
- **ID:** `ADR-003`
- **DATE:** 2026-09-28
- **CATEGORY:** PRODUCT / INTEGRATION
- **CONTEXT:** A Meta oferece dois tipos de botões em DMs do Instagram: `button template` (fixos permanentemente na mensagem) e `quick_reply` (botões efêmeros que desaparecem da conversa assim que o usuário clica ou responde).
- **DECISION:** O Fluxo utilizará **exclusivamente** `button template` em todas as automações com botões. O uso de `quick_reply` está expressamente banido.
- **RATIONALE:** O lead frequentemente precisa clicar novamente no botão de acesso ou rever o catálogo mais tarde. Botões efêmeros reduzem drasticamente a conversão do funil.
- **IMPACT:** Máximo de 3 botões por mensagem e limite de 20 caracteres por título de botão impostos pela Meta.
- **STATUS:** `ACTIVE`
- **SOURCE:** `PRD.md` Seção 5.

---

## ADR-004: Fatiamento Atômico do Seletor de Posts em Nano Tasks
- **ID:** `ADR-004`
- **DATE:** 2026-09-28
- **CATEGORY:** EXECUTION / ARCHITECTURE
- **CONTEXT:** O componente `PostPicker.tsx` foi criado com dados mock estáticos. A feature de seleção visual de publicações reais da conta conectada da Meta precisa ser concluída sem regressões e com suporte offline/mock defensivo.
- **DECISION:** Dividir a feature em 4 Nano Tasks sequenciais e atômicas:
  1. `NANO-001`: Implementar método `InstagramGraphClient.getUserMedia` e endpoint `GET /api/instagram/media` com fallback mock.
  2. `NANO-002`: Criar testes unitários para a rota e cliente de mídia.
  3. `NANO-003`: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')`, adicionando estados de loading e filtro de tipo de mídia.
  4. `NANO-004`: Atualizar o `matcher.ts` e a compilação do gatilho para filtrar eventos de webhook pelo `mediaId` quando `scope === 'specific'`.
- **RATIONALE:** Permite que o próximo agente execute cada tarefa de forma determinística, com escopo restrito de arquivos e validação automatizada.
- **IMPACT:** Elimina risco de regressões e mantém a suíte de testes 100% verde em cada etapa.
- **STATUS:** `ACTIVE`
- **SOURCE:** Master Prompt e Auditoria Inicial.

---

## ADR-005: Adoção Exclusiva da Instagram API with Instagram Login (`graph.instagram.com/v21.0`)
- **ID:** `ADR-005`
- **DATE:** 2026-10-11
- **CATEGORY:** INTEGRATION / META API
- **CONTEXT:** O PRD original (REQ-001) previa "Facebook Login" e dependência de Página do Facebook vinculada, causando fragmentação de endpoints (`graph.facebook.com` vs `graph.instagram.com`), complexidade de permissões de Página e erros em contas que utilizam login direto do Instagram.
- **DECISION:** Adotar **exclusivamente** a **Instagram API with Instagram Login**:
  1. Base unificada fixada em `https://graph.instagram.com/v21.0` com `AbortSignal.timeout(10_000)` e retorno tipado (`GraphResult`).
  2. Escopos de autorização restritos ao Instagram: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments` — sem necessidade de Página do Facebook.
  3. Envio da primeira DM em resposta a comentário via **Private Reply** oficial (`recipient: { comment_id }`), respeitando a janela de 7 dias da Meta e garantindo unicidade atômica via tabela `PrivateReply`.
  4. Janela de 24 horas: verificada estritamente antes de qualquer envio de DM que não seja private reply. Comentários públicos não abrem e não prolongam a janela (`lastInboundAt` atualiza somente via DM ou postback).
  5. Inscrição e roteamento de Webhook: assinatura obrigatória de `comments`, `messages` e `messaging_postbacks`, com roteamento por `entry[].id` (`igUserId`) e descarte defensivo de `is_echo` e comentários da própria conta.
  6. Tratamento estruturado de códigos de erro da Meta:
     - `190`: Token expirado/revogado (`TOKEN_EXPIRED`), alertando o operador.
     - `10`, `2018278`, `2534022`: Janela de 24h fechada ou falta de permissão, pausando o fluxo sem retentativa cega.
     - `4`, `613`, `32`: Rate limit ou falha transitória (`retryable: true`), permitindo retentativa com backoff exponencial na fila.
- **RATIONALE:** Alinha o sistema com a arquitetura moderna recomendada pela Meta para contas Creator/Business, reduzindo atrito de onboarding e eliminando falhas de entrega.
- **IMPACT:** Atualiza `PRD.md` (REQ-001), `PRD_TRACEABILITY.md`, `ARCHITECTURE.md` e `docs/etapa-7-meta-app.md`.
- **STATUS:** `ACTIVE` — restrito ao fluxo do Instagram Login a partir do ADR-006.
- **SOURCE:** Item 03 do Plano de Execução e Especificação Oficial da Meta.

> **Nota (2026-10-12):** o ADR-005 passa a valer **somente para o fluxo do Instagram Login** (`authProvider = INSTAGRAM_LOGIN`). O Facebook Login voltou como segundo caminho de conexão, conforme o ADR-006.

---

## ADR-006: Login Duplo — Instagram Login + Facebook Login
- **ID:** `ADR-006`
- **DATE:** 2026-10-12
- **CATEGORY:** INTEGRATION / META API / SECURITY
- **CONTEXT:** Com só o Instagram Login (ADR-005), a conexão falhava em produção com "Invalid platform app" porque `IG_APP_ID` estava com o ID do App da Meta (o Instagram Login exige o **ID do app do Instagram**, que é outro). O callback ainda tentava o Facebook e, ao falhar, reaproveitava o mesmo `code` no Instagram, escondendo o erro real. Além disso: clientes que gerenciam o Instagram por uma Página do Facebook não tinham caminho próprio; `/conectar` exigia sessão que o cliente não tem; o `state` OAuth tinha um segredo fixo de fallback (fail-open); e o cliente Graph só falava com `graph.instagram.com`, onde o token de Página não funciona.
- **DECISION:** Oferecer **dois caminhos independentes** de conexão ("Entrar com Instagram" e "Entrar com Facebook"), em `/ajustes` e em `/conectar`:
  1. **Credenciais por produto:** `IG_APP_ID` / `IG_APP_SECRET` → Instagram Login (ID do app do Instagram); `META_APP_ID` / `META_APP_SECRET` → Facebook Login. Se `IG_APP_ID` estiver vazio ou **igual** a `META_APP_ID`, o login é recusado antes de ir à Meta, com mensagem clara (`OAuthConfigError`).
  2. **Um callback só** (`${APP_URL}/api/auth/instagram/callback`, cadastrado nos dois produtos), com o **modo** (`instagram` | `facebook`) dentro do `state` assinado.
  3. **Sem fallback cruzado:** o callback despacha só para o fluxo do modo do `state`; se o Facebook falhar, o Instagram não é tentado (e vice-versa). O erro real chega à tela, traduzido para pt-BR.
  4. **Workspace no `state`:** o `state` carrega `mode`, `workspaceId`, `returnTo`, `nonce` e `iat`; é assinado com HMAC-SHA256 (`OAUTH_STATE_SECRET`, ou `TOKEN_ENCRYPTION_KEY` como alternativa), comparado em tempo constante e expira em 15 min. Sem segredo configurado, o login é recusado (fail-closed). O workspace é decidido no início (sessão ou convite) e não muda no callback, o que permite iniciar no `localhost` e receber em produção.
  5. **Convite HMAC para o `/conectar`:** `/conectar?convite=<token>`, com `{ workspaceId, exp }` válido por 7 dias, gerado em `/ajustes`. Usa o mesmo segredo com prefixo de domínio (`invite:`), para que um `state` não valha como convite e vice-versa. Sem convite válido, `/conectar` mostra um aviso e não inicia OAuth anônimo.
  6. **`authProvider` na conta:** `InstagramAccount.authProvider` (`INSTAGRAM_LOGIN` | `FACEBOOK_LOGIN`, padrão `INSTAGRAM_LOGIN`) + `fbPageId` opcional. O cliente Graph escolhe o host por ele (`graph.instagram.com` x `graph.facebook.com`); o cron de renovação pula contas `FACEBOOK_LOGIN` (token de Página não expira).
  7. **Conectar todas as Páginas:** no Facebook Login, todas as contas do Instagram vinculadas às Páginas autorizadas são conectadas de uma vez. Zero contas → erro explicando que é preciso marcar a Página e a conta do Instagram.
  8. **Escopos:** Instagram Login — `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`. Facebook Login — `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `business_management`.
- **RATIONALE:** Os nomes de variável já existiam em todos os ambientes; bastava separar os valores e transformar "Invalid platform app" numa mensagem acionável. Um callback único reduz o cadastro no painel a uma URI. Tirar o fallback cruzado faz o erro verdadeiro aparecer. O convite é o menor passo que torna o link do cliente funcional sem criar contas/sessões de cliente. Gravar o provedor na conta é explícito e testável (em vez de adivinhar pelo formato do token).
- **IMPACT:**
  - A redirect URI precisa estar em **Facebook Login › Configurações › URIs de redirecionamento do OAuth válidos** e em **Instagram › Configurações do login comercial › URLs de redirecionamento do OAuth**.
  - `IG_APP_ID` / `IG_APP_SECRET` precisam ser trocados pelo ID e secret do app do Instagram em `.env` e na Vercel; `APP_URL` e `OAUTH_STATE_SECRET` (ou `TOKEN_ENCRYPTION_KEY`) passam a ser obrigatórios para o login funcionar.
  - Nova coluna/enum no Prisma (`authProvider`, `fbPageId`) com migração.
  - Webhooks: os dois produtos usam `${APP_URL}/api/webhook/instagram` com `WEBHOOK_VERIFY_TOKEN`; a assinatura aceita `IG_APP_SECRET` ou `META_APP_SECRET` (sem mudança).
  - Atualiza `docs/etapa-7-meta-app.md` (seção "Login duplo") e `.env.example`.
- **STATUS:** `ACTIVE` (restringe o ADR-005 ao fluxo do Instagram Login)
- **SOURCE:** `docs/plans/2026-10-12-login-duplo-facebook-instagram.md` (seções 1 a 4, decisões D1–D6).

---

## ADR-007: Ciclo de vida do perfil conectado e callbacks da Meta ("Perfil seguro")
- **ID:** `ADR-007`
- **DATE:** 2026-10-12
- **CATEGORY:** SECURITY / PRIVACY / META API / UX
- **CONTEXT:** A auditoria geral mostrou que (1) não havia callback de desautorização nem de exclusão de dados (bloqueia a revisão do app); (2) o motor usava o token global quando o perfil estava desconectado ou expirado; (3) a tela de falhas listava eventos de todos os clientes e o reenvio aceitava mensagem de outro cliente; (4) "descarregar perfil" só apagava o token local; (5) não existia excluir perfil e dados (LGPD); (6) a tela mostrava estado de conexão errado.
- **DECISION:**
  1. **Descarregar** = cancelar a inscrição de webhooks na Meta (best-effort), apagar a credencial, marcar `DISCONNECTED`/`REVOKED` e encerrar execuções ativas. Fluxos mantêm o estado e voltam sozinhos ao carregar o perfil de novo; o motor não envia nada por perfil não conectado.
  2. **Excluir perfil e dados** = pedido rastreável (`DataDeletionRequest`) com exclusão em lotes retomável (cards de carrossel antes do catálogo, por causa do `RESTRICT`).
  3. **Callbacks** `POST /api/meta/deauthorize` e `POST /api/meta/data-deletion`: assinatura HMAC-SHA256 conferida antes de qualquer acesso ao banco, `issued_at` de até 24 h, perfil reconectado depois do pedido é ignorado, máximo de 20 perfis por pedido. O secret que validou define o provedor. Exclusão via Meta: escopo do negócio no login do Instagram (a pessoa é a conta profissional) e só da pessoa no login do Facebook.
  4. **Motor**: sem fallback para o token global; perfil descarregado ou desconhecido não grava nada; perfil expirado grava contato e mensagem sem disparar gatilho; estado conferido antes de cada envio.
  5. **Isolamento**: tela de falhas e reenvio restritos ao perfil ativo; token de verificação do webhook só para SUPERADMIN.
  6. Novos campos `metaUserId` (ID app-scoped que a Meta manda no `signed_request`) e `connectedAt`.
- **RATIONALE:** Revisão multiagente (cético, guardião de restrições, defensor do usuário, árbitro) registrada em `docs/plans/2026-10-12-perfil-seguro-design.md`.
- **IMPACT:** Migração `20261012180000_perfil_seguro` (aditiva). Novas URLs a cadastrar no painel (ver `docs/etapa-7-meta-app.md` §2.5). Texto de `/privacidade` revisado; retenção dos dados do negócio até pedido de exclusão fica pendente de validação do dono/jurídico.
- **STATUS:** `ACTIVE`
- **SOURCE:** `docs/plans/2026-10-12-perfil-seguro-design.md`, `perfil-seguro.md`.

---

## ADR-008: Planos, equipe e cobrança (venda do instachat)
- **ID:** `ADR-008`
- **DATE:** 2026-10-13
- **CATEGORY:** PRODUCT / BILLING / SECURITY / TENANCY
- **CONTEXT:** Para vender o instachat faltavam login de cliente, equipe por workspace, planos, limites e cobrança. O estudo do STARTCRM (`/Volumes/Vol Macbook/App/STARTCRM`) mostrou o que reaproveitar (planos editáveis no banco, plano efetivo = plano + ajustes do cliente, papel da plataforma separado do papel na empresa, empresa interna fora do MRR, auditoria de ações do admin, pagamento que ativa o plano sozinho) e o que evitar (recurso sem decisão liberado por padrão, limites declarados e não aplicados, plano gravado em 3 lugares, papel gravado 2 vezes, suspensão checada só no navegador, auditoria que pode se perder). Plano completo: `docs/plans/2026-10-13-planos-e-cobranca.md`.
- **DECISION:**
  1. **Dois níveis de papel:** `User.role` (`SUPERADMIN | CLIENT`) continua sendo o da plataforma; dentro do workspace vale `WorkspaceMember.role` (`OWNER | ADMIN | OPERATOR`). Acesso a dados passa a ser por **membro**, não por `ownerId`.
  2. **Login de cliente por e-mail e senha** (hash `scrypt` do Node, sem dependência nova). O link mágico foi descartado por enquanto porque o projeto não tem serviço de e-mail. O operador continua entrando com `SITE_USER`/`SITE_PASSWORD`. Convites de equipe são **links para copiar** (token aleatório, só o hash no banco, 7 dias, uso único).
  3. **Plano no banco** (`Plan`), editável pelo Super Admin; **uma única fonte** do plano e do status por workspace (`Subscription`), com ajustes de limite por cliente (`limitOverrides`). Limite `null` = ilimitado (decisão explícita, não ausência).
  4. **Fechado por padrão:** recurso fora da lista do plano está bloqueado; workspace sem assinatura não envia mensagens nem ativa fluxos. Workspace `INTERNAL` (operação da Start Inc) não tem limites e fica fora do MRR.
  5. **Limites aplicados no servidor:** contas do Instagram (conclusão do OAuth, antes de gravar), membros (convite e aceite), fluxos ativos (`updateFlowStatus`), DMs/mês e status da assinatura (motor, antes de cada envio). O webhook da Meta **nunca** deixa de gravar contato e mensagem por causa de plano.
  6. **Status calculado:** `TRIALING → ACTIVE → PAST_DUE (carência) → SUSPENDED → CANCELED`. Teste vencido e carência vencida são calculados pela data, sem depender de cron.
  7. **Cobrança pelo Stripe** (cliente e webhook já existiam). Webhook idempotente por ID de evento. Checkout só aparece para plano com `stripePriceId` configurado.
  8. **Auditoria** das ações do Super Admin gravada na mesma transação da ação.
- **IMPACT:** Migração `20261013120000_planos_e_equipe` (aditiva, com backfill: dono vira `OWNER`, workspace de Super Admin vira `INTERNAL`, clientes atuais ganham o plano Pro ativo para não pararem no deploy). Novas variáveis: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (já previstas). Preços dos planos ficam a definir pelo dono no `/admin/planos`.
- **PENDENTE DO DONO:** preços; se no limite deve bloquear ou cobrar excedente (implementado: bloquear); retenção após cancelamento (BLK-010; nada é apagado automaticamente).
- **STATUS:** `ACTIVE`
- **SOURCE:** Pedido do dono em 13/10/2026 ("comite o login, depois siga para as outras etapas").
