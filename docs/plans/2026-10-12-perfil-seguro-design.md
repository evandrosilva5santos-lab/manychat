# Pacote "Perfil seguro" — design (brainstorming multiagente)

Data: 2026-10-12 · Branch: `feat-novas-implementacoes` · Pasta: `../Manychat-novas-implementacoes`

## 1. Levantamento geral (o que existe × o que falta)

Fonte: três auditorias de leitura (telas, backend, documentação) + conferência no código e no banco (leitura).

### Já implementado e funcionando
- Funil principal: comentário → resposta pública → DM com botão fixo → condição "segue?" → link rastreado → espera. Editor simples (receita) e avançado (React Flow).
- Inbox (`/conversas`) com envio manual dentro da janela de 24h, contatos com etiquetas e filtros, catálogo de cards.
- Fila de webhooks durável e idempotente (`WebhookEvent`), HMAC obrigatório, reprocessamento com backoff e estado DEAD.
- Tokens criptografados (AES-256-GCM), renovação diária do token de 60 dias (cron), conta por provedor (Instagram × Facebook).
- Login duplo (Instagram e Facebook), convite assinado para o cliente (`/conectar`), workspaces, troca de perfil no cabeçalho, `/admin` com saúde das contas e "ver como cliente".
- Páginas `/privacidade` e `/termos`.

### Implementado pela metade
- **Descarregar perfil** (trabalho não commitado): apaga o token local, mas não avisa a Meta, não para o motor e usa `window.confirm`.
- **Login do Instagram**: troca do token longo falha com "Unsupported request - method type: get" (nenhuma conta entrou por esse caminho até hoje).
- **Renovar token manual** (`renewMetaToken`): chama a Meta e **não salva** o token novo.
- Itens 05–08 do roadmap: espera (DELAY) depende de tráfego (rota `/tick` sem agendador), sem Sentry/CI/E2E, faturamento só com webhook stub, `/ai` e `/direct` são "Em breve".

### Nunca discutido, mas necessário (achados desta auditoria)
| # | Lacuna | Risco |
|---|---|---|
| L1 | Não há callback de **desautorização** nem de **exclusão de dados** da Meta; `/exclusao-de-dados` não existe (a rota já está liberada no proxy) | Bloqueia a revisão do app pela Meta |
| L2 | Motor usa o **token global** quando o perfil está desconectado/expirado (`runner.ts:142`, `worker.ts:161`) e roteia webhook de conta desconhecida para "a conta atual" (`worker.ts:120`) | Mensagem enviada com o token errado / dado de um cliente caindo em outro |
| L3 | Tela de falhas: `listDeadEvents` sem filtro de conta e `retryFailedSend` aceita mensagem de qualquer cliente (IDOR); `revealWebhookVerifyToken` liberado para qualquer sessão | Vazamento entre clientes |
| L4 | Desconectar não cancela execuções em espera, não para de processar webhooks e o perfil desconectado pode voltar como ativo (`getTenantContext` pega `narrowed[0]`) | Política de privacidade promete revogação imediata — hoje é falso |
| L5 | Não existe **excluir perfil e dados** (LGPD) | Pedido de titular sem caminho |
| L6 | Status do perfil errado na tela: lista sempre verde, "Configurado no .env" para token do banco, banner verde "Canal conectado" mesmo expirado, sem aviso quando o cron marca EXPIRED | Operador não percebe que as automações pararam |
| L7 | CTA "Conectar Instagram" do operador leva a `/conectar` sem convite (botões desabilitados); "Reconectar" do `/admin` monta link sem convite | Beco sem saída |
| L8 | `/conectar` promete "Acesso renovado automaticamente" e "Webhooks inscritos" sempre | Promessa falsa para conta do Facebook |
| L9 | Sem login/logout de cliente, sem papéis, sem trilha de auditoria, sem rate limit, eventos de anexo/story mention descartados, retry de evento não reexecuta o fluxo | Backlog |

## 2. Understanding Lock (fechado pelo líder — o dono pediu execução sem consulta)

- **Objetivo:** o operador e o cliente controlam o ciclo de vida do perfil conectado (carregar, ver o estado real, reconectar, descarregar, excluir dados) e o Fluxo cumpre o que promete à Meta e na política de privacidade.
- **Usuários:** operador (agência, entra pelo Basic Auth = SUPERADMIN) e cliente (abre `/conectar` com convite).
- **Fora do escopo:** login de cliente com senha, papéis, faturamento, IA, transmissão, agendador do `/tick`, observabilidade. Ficam no backlog priorizado (seção 8).
- **Restrições:** pt-BR, design system em `design-system/README.md` (sem gradiente, um azul, erro = o que houve + consequência + saída), Graph v21.0, chamadas à Meta só em `src/lib/meta/`, Zod nas rotas, sem dados falsos, nunca mandar DM para seguidor real em teste, não desconectar as contas reais (`loveu.sunset`, `movingfestival`) durante a validação.
- **Rótulos:** mantém "Carregar perfil" / "Descarregar perfil" (escolha recente no código, possivelmente do dono); o diálogo explica em linguagem clara que isso desconecta o Instagram do Fluxo.

## 3. Design inicial

> A seção 7 (design final consolidado) prevalece sobre esta seção onde houver conflito.


### D1 — Núcleo do ciclo de vida (`src/lib/meta/account-lifecycle.ts`)
- `disconnectAccount(accountId, { reason, notifyMeta })`:
  1. Se `notifyMeta`, tenta cancelar a inscrição de webhooks na Meta (Instagram: `DELETE graph.instagram.com/v21.0/me/subscribed_apps`; Facebook: `DELETE graph.facebook.com/v21.0/{fbPageId}/subscribed_apps`). Falha só vai para o log — a desconexão local nunca depende da Meta.
  2. Transação: conta → `DISCONNECTED` / `REVOKED`, `accessTokenEnc = null`, `tokenExpiresAt = null`; execuções `RUNNING`/`WAITING_*` dos fluxos da conta → `FAILED` com erro "Perfil descarregado".
  3. Fluxos ficam como estão (LIVE continua LIVE): ao carregar o perfil de novo, as automações voltam sozinhas. O motor não envia nada enquanto o perfil não estiver `CONNECTED` (D3).
- `deleteAccountData(accountId, { notifyMeta })`: cancela a inscrição (se possível) e apaga a conta — contatos, mensagens, fluxos, etiquetas, cards e links caem em cascata; eventos de webhook da conta são apagados explicitamente.

### D2 — Ações da tela (`src/app/ajustes/actions.ts`)
- `disconnectCurrentInstagramProfile()` → usa D1 com `notifyMeta: true`, depois escolhe outro perfil `CONNECTED` como ativo (ou limpa o cookie).
- `deleteCurrentInstagramProfile(confirmation)` → exige `confirmation === username` do perfil ativo; usa D1.
- `renewMetaToken()` → passa a salvar o token renovado (criptografado) e a nova validade; para conta do Facebook responde que o token não expira.
- `revealWebhookVerifyToken()` → só SUPERADMIN.
- `getTenantContext()` → sem cookie, prefere perfil `CONNECTED`.

### D3 — Motor só fala com a Meta com o token do próprio perfil
- Remove o fallback para `defaultGraphClient` em `runner.ts` e `worker.ts`: sem cliente da conta, a execução falha com "Perfil desconectado ou com token expirado — reconecte em Ajustes".
- `resolveAccount` deixa de cair em `getCurrentAccount()`: webhook de conta desconhecida é descartado (erro permanente com motivo).
- Webhook de perfil não `CONNECTED`: não registra contato/mensagem, não dispara gatilho (evento marcado como processado, com motivo no log).
- `resumeDueDelays` ignora execuções de perfis não conectados.

### D4 — Isolamento entre clientes (`conversas/falhas/actions.ts`, `/tick`)
- `listDeadEvents` filtra por `accountId` do perfil ativo.
- `retryFailedSend` exige `message.accountId === perfil ativo`.
- `/api/webhook/instagram/tick` compara o segredo em tempo constante.

### D5 — Conformidade Meta
- Migração aditiva: `InstagramAccount.metaUserId String?` (índice) e modelo `DataDeletionRequest { code @unique, metaUserId, status PENDING|COMPLETED, accountsDeleted, createdAt, completedAt }`.
- Ao conectar, grava `metaUserId` (Instagram: `user_id` da troca do código; Facebook: `id` de `/me` do usuário).
- `src/lib/meta/signed-request.ts`: valida `signed_request` (HMAC-SHA256, tenta `META_APP_SECRET` e `IG_APP_SECRET`, comparação em tempo constante, `algorithm` obrigatório).
- `POST /api/meta/deauthorize`: acha contas por `igUserId` ou `metaUserId` e chama `disconnectAccount(..., { notifyMeta: false })`.
- `POST /api/meta/data-deletion`: grava o pedido, apaga os dados das contas encontradas, responde `{ url, confirmation_code }`.
- Página pública `/exclusao-de-dados`: como pedir a exclusão e, com `?codigo=`, o status do pedido.
- `docs/etapa-7-meta-app.md`: URLs a cadastrar no painel (Instagram › Configurações do login comercial e Login do Facebook).

### D6 — Telas (`/ajustes`, cabeçalho, painel, `/conectar`, `/admin`)
- Componente `ConfirmDialog` acessível (`<dialog>` nativo, foco no botão seguro, Esc fecha, variante com digitação do @ para excluir). Substitui o `window.confirm` de Ajustes.
- Card "Perfil carregado" com estado real (Conectado / Token expirado / Descarregado), provedor, validade ("Renova sozinho até …" ou "Não expira") e área "Zona de risco" com "Descarregar perfil" e "Excluir perfil e dados".
- Lista de perfis com selo de estado real; "Status do Token" deixa de dizer "Configurado no .env" quando o token está no banco.
- Faixa de alerta no topo do app quando o perfil ativo não está conectado: "Token de acesso da Meta expirou — as automações estão pausadas. Reconectar" (texto do design system).
- Painel (`/`) só mostra "Canal Instagram conectado" quando o perfil está `CONNECTED`.
- Botão do Instagram sem gradiente (regra do design system).
- Links "Conectar Instagram" do operador apontam para `/ajustes`; "Reconectar" do `/admin` gera link com convite; `/conectar` deixa de prometer renovação/webhooks que podem não valer.

### D7 — Login do Instagram (troca do token longo)
- Mantém `GET` (documentado) e, se a Meta responder "Unsupported request - method type", repete uma vez com `POST` (form-urlencoded). Log com `code`, `error_subcode` e `fbtrace_id` (sem token).

## 4. Decision Log

| # | Decisão | Alternativas | Objeções | Resolução |
|---|---|---|---|---|
| 1 | Fluxos continuam LIVE ao descarregar; o motor bloqueia por estado da conta | Pausar todos os fluxos (STOPPED) | Ao reconectar o operador teria de religar um por um | Bloqueio pelo estado da conta (D3); diálogo informa que as automações ficam paradas até carregar de novo |
| 2 | Desconexão local nunca depende da Meta | Falhar se o DELETE da Meta falhar | Token pode já estar inválido; o usuário ficaria preso | Best-effort + log |
| 3 | Não chamar `DELETE /me/permissions` | Revogar a permissão do usuário | Token de Página (Facebook) não revoga o usuário; o Instagram Login não expõe esse endpoint de forma estável | Cancelar a inscrição de webhooks + apagar o token; a pessoa pode remover o app no Instagram/Facebook (o callback D5 trata) |
| 4 | `metaUserId` novo no banco | Casar só por `igUserId` | No login do Facebook o `user_id` do signed_request é do usuário do Facebook, que não guardamos | Guardar e casar pelos dois |
| 5 | Não configurar as URLs no painel da Meta automaticamente | Configurar via Chrome | Alterar configuração de conta exige autorização explícita do dono | Documentar e entregar a lista |
| 6 | Manter "Carregar/Descarregar perfil" | Voltar para "Conectar/Desconectar" (design system) | Rótulo pode ter sido pedido pelo dono; U1: "Descarregar" é pouco claro | Manter, com subtítulo "Desconecta o Instagram do Fluxo", estado em palavras e variantes "Carregar perfil de novo" / "Adicionar outro perfil" |
| 7 | Perfil EXPIRADO continua gravando contato e mensagem, sem gatilho | Descartar tudo que não for CONNECTED | S5: perderia histórico e janela de 24h | Só descarregado/inexistente descarta |
| 8 | Escopo da exclusão via Meta: BUSINESS no login do Instagram, PERSON no login do Facebook | Apagar sempre tudo | S7: um admin de Página apagaria vários negócios | Dados do negócio do login do Facebook só saem por "Excluir perfil e dados" ou e-mail |
| 9 | Proteção contra pedido antigo: `connectedAt` > `issued_at` ignora; `connectedAt` nulo aplica | Sem proteção | S8 | Campo novo `connectedAt` |
| 10 | Teste da exclusão em lotes só unitário | Semear 50 mil mensagens | G3: sem banco de teste; proibido dado falso no banco real | Mantido pelo árbitro |
| 11 | Retenção dos dados do negócio até pedido de exclusão | Prazo fixo de retenção | G6: decisão do dono (controlador) | **Item aberto, não bloqueia**: o texto honesto da privacidade descreve o comportamento atual e fica marcado para revisão do dono/jurídico |
| 12 | Preencher `accountId` dos eventos antigos na migração | Deixar nulo | Árbitro: eventos antigos sumiriam da tela de falhas | Feito na migração |
| 13 | Troca automática de perfil só dentro do mesmo workspace | Qualquer perfil conectado | S9 | 7.2.1 |
| 14 | Pior caso de 24 h para exclusão pendente | Prometer "alguns minutos" | G10: o cron é diário | Texto dos diálogos e da página |

## 5. Revisões

Disposição final do árbitro: **APPROVED** após as 8 edições textuais pedidas na rodada de arbitragem (aplicadas neste documento).


### 5.1 Cético (12 objeções) — resposta do designer

| # | Objeção | Resolução (revisão do design) |
|---|---|---|
| S1 | Eventos DEAD/FAILED ficam com `accountId = null` → filtro esvazia a tela e a exclusão não apaga o `payload` | `enqueueEvent` passa a resolver `accountId` pelo `igUserId` na entrada. Consultas de escopo e exclusão usam `accountId = X OR idempotencyKey começa com "{igUserId}:"` (chave já tem o prefixo) |
| S2 | `CarouselCard → CatalogItem` é `RESTRICT`: apagar a conta pode falhar conforme a ordem da cascata | `deleteAccountData` apaga em ordem explícita dentro de uma transação: cards de carrossel → fluxos → cards do catálogo → eventos → conta. Validado por checagem somente leitura das chaves estrangeiras (`information_schema`) + teste unitário da ordem de exclusão; nenhuma escrita nas contas reais |
| S3 | Execução em andamento continua enviando após descarregar; `runId` reabre FAILED | Runner confere o estado da conta antes de cada envio e encerra com "Perfil descarregado"; gravações de estado da execução passam a ser condicionais (não reabrem FAILED fora do reenvio); `retryFailedSend` recusa perfil não conectado |
| S4 | Cron de renovação / `markExpired` / `onExpired` sobrescrevem DISCONNECTED ou lançam P2025 se a conta foi apagada | Todas as gravações viram `updateMany` condicionadas a `status = CONNECTED` |
| S5 | Perfil só EXPIRADO perderia histórico e janela de 24h | Revisado: perfil EXPIRADO continua registrando contato e mensagem (sem disparar gatilho nem enviar). Só DESCARREGADO/inexistente descarta |
| S6 | ID do `signed_request` não verificado; contas antigas sem `metaUserId`; 0 resultados com `confirmation_code` mentiroso | Instagram: guardar o `id` app-scoped de `/me` (é o que vem no `signed_request`, assinado com o secret do app do Instagram). Facebook: `id` de `/me` do usuário (secret do App da Meta). O secret que validou define o provedor e o campo comparado. 0 resultados → pedido registrado como "Nenhum dado encontrado", texto honesto na página de status. Contas antigas: casam na próxima reconexão (limitação documentada) |
| S7 | No login do Facebook, um administrador de Página apagaria os dados de vários negócios | Revisado: o callback de exclusão apaga **os dados da pessoa** (credenciais, IDs da Meta) e descarrega as contas ligadas a ela. Os dados do negócio (contatos e conversas dos seguidores) só são apagados quando a própria conta profissional pede: login do Instagram (a pessoa é a conta) ou "Excluir perfil e dados" no app |
| S8 | `signed_request` antigo ou repetido apaga uma conta reconectada depois | Novo campo `connectedAt`; conta reconectada depois do `issued_at` é ignorada. `issued_at` obrigatório |
| S9 | Operador cai no perfil de outro cliente ao trocar automaticamente | Troca só para perfil conectado **do mesmo workspace** |
| S10 | Repetir com POST pode esconder a causa real | Aceito em parte: a sondagem mostrou que o endpoint aceita GET e POST; a repetição só roda com essa mensagem exata. O log passa a guardar `code`, `error_subcode`, `fbtrace_id` e o método usado, e a tela mostra uma mensagem com a próxima ação (testador do Instagram / secret). Se o POST funcionar, o token é válido — não há o que esconder |
| S11 | Fluxo "Ao vivo" em perfil desconectado engana | Painel e lista de automações mostram "Pausado — perfil desconectado" quando o perfil ativo não está conectado |
| S12 | Conta com token no `.env` continua com token | Fora do escopo (configuração do operador); a proteção é o estado da conta. Documentado |

### 5.2 Guardião de restrições (10 achados) — resposta do designer

| # | Achado | Resolução |
|---|---|---|
| G1 | Callbacks públicos sem controles suficientes | Aceito: body form-urlencoded com limite de 8 KB, `sig.payload` com exatamente um ponto, HMAC sobre o segmento recebido, `timingSafeEqual` com tamanhos iguais, `algorithm`/`user_id`/`issued_at` obrigatórios (Zod), assinatura conferida **antes** de tocar no banco, 400 genérico, log só com código do motivo, `maxDuration = 60`, exclusão em `after()` |
| G2 | Idempotência e código de confirmação | Aceito: código `randomBytes(16)` base64url; chave única = SHA-256 do `signed_request` (repetição da Meta devolve o mesmo código); página de status mostra só estado e data, nenhum dado pessoal, `noindex` (código de 128 bits torna a enumeração inviável; o texto para código desconhecido da seção 7.4 vale) |
| G3 | Exclusão grande estoura a transação | Aceito: tabelas pesadas (mensagens, execuções, contatos, eventos) apagadas em lotes de 5.000 fora da transação, com orçamento de ~40 s; passos estruturais finais numa transação com `timeout: 15000`; retomável (pedido fica PENDING). **Rejeitado** só o teste com 50 mil mensagens semeadas: não há banco de teste e a regra do projeto proíbe dados falsos no banco real — coberto por teste unitário do laço em lotes |
| G4 | `accountId` na fila e consulta por prefixo | Aceito: `@@index([accountId])`; prefixo real é `ig:{igUserId}:`; consulta pelo `igUserId` único com cache por requisição; falha na consulta não derruba o webhook (`accountId = null`); a tela de falhas filtra só por `accountId`; o prefixo é usado apenas no job de exclusão, em lotes |
| G5 | Checagem de estado por envio | OK: só em nós que chamam a Meta |
| G6 | Promessa de privacidade e retenção | Aceito: página de privacidade passa a dizer "credencial removida do Fluxo e webhooks cancelados" e explica a retenção (dados do negócio ficam até "Excluir perfil e dados" ou pedido por e-mail). `DataDeletionRequest` guarda o hash do ID da Meta, não o ID. **Pendente do dono:** confirmar a retenção por tempo indeterminado até o pedido de exclusão |
| G7 | Autorização das ações | OK: ações usam só o perfil ativo resolvido pelo servidor; confirmação do @ conferida no servidor; exclusão durante "ver como cliente" exige SUPERADMIN e registra o ator no log |
| G8 | Migração | OK: só colunas anuláveis, tabela e índices novos |
| G9 | Abuso dos callbacks | Aceito: `issued_at` no máximo 24 h no passado e não no futuro; limite de 20 contas por pedido |
| G10 | Exclusão falhando em silêncio | Aceito: estados PENDING / COMPLETED / FAILED com `attempts` e `lastError` sem dado pessoal; o cron diário e o `/tick` retomam pedidos pendentes há mais de 5 minutos |

### 5.3 Defensor do usuário (10 achados) — resposta do designer

| # | Achado | Resolução |
|---|---|---|
| U1 | "Descarregar" não é entendido; três palavras para a mesma saída | Rótulos mantidos (Decision Log #6), mas o botão leva o subtítulo "Desconecta o Instagram do Fluxo"; o estado aparece em palavras ("Descarregado — automações paradas"); "Carregar perfil" vira "Carregar perfil de novo" quando o perfil não está conectado e "Adicionar outro perfil" quando está; o seletor do cabeçalho distingue "Token expirado" de "Descarregado" |
| U2 | Diálogos sem texto fixo | Aceito: texto exato da seção 7.4 |
| U3 | Confirmação do @ | Aceito: "@" opcional, sem diferença de maiúsculas e espaços nas pontas; botão desabilitado com motivo em `aria-describedby`; aviso de que pode levar alguns minutos antes de confirmar; card mostra "Excluindo…" |
| U4 | Zona de risco escondida | Aceito: card "Perfil carregado" no topo de Ajustes com o estado em palavras e a zona de risco no fim dele, com borda `danger` e separada dos botões de rotina |
| U5 | Um banner não serve para as duas causas | Aceito: duas variantes (seção 7.4), `role="status"`, ícone + texto, não dispensável enquanto o estado persistir |
| U6 | "Pausado — perfil desconectado" contradiz "Descarregar" | Aceito: "Pausado — perfil descarregado" ou "Pausado — token expirado", com link "Ver motivo" para Ajustes |
| U7 | Texto da página pública de exclusão | Aceito: texto da seção 7.4 |
| U8 | `/conectar` no celular | Aceito: sucesso = "Pronto, @usuario está conectado. Você pode fechar esta página e voltar ao WhatsApp." sem checklist técnico; aviso de convite acima dos botões; texto mínimo de 12px |
| U9 | Contraste e selos | Aceito: sem gradiente; selos com palavra em pt-BR (nunca o enum cru) e tokens `success`/`warning`/`danger` |
| U10 | Armadilhas do `<dialog>` | Aceito integralmente (foco inicial no botão seguro ou no campo; Esc fecha e devolve o foco; `aria-labelledby` + `aria-describedby`; destrutivo nunca é o padrão; clique no fundo não fecha; alvos ≥ 44px; `aria-busy`; resultado em `role="status"`; sem `window.location.reload()`) |

Observação aceita: o fallback `getCurrentAccount()` do worker é praticamente inerte (rota pública sem ator), então removê-lo é limpeza de baixo risco, não correção de vazamento.

## 7. Design final consolidado (vale sobre a seção 3 quando houver conflito)

### 7.1 Banco (uma migração aditiva)
- `InstagramAccount`: `metaUserId String?` (índice), `connectedAt DateTime?`.
- `WebhookEvent`: `@@index([accountId])` + preenchimento único do `accountId` dos eventos existentes pelo prefixo `ig:{igUserId}:` (na própria migração; tabela pequena).
- `DataDeletionRequest`: `id`, `code @unique` (128 bits, base64url), `requestKey @unique` (SHA-256 do `signed_request`, ou `app:{accountId}:{timestamp}` no pedido feito pelo app), `source` (`META_CALLBACK` | `APP`), `provider` (`INSTAGRAM_LOGIN` | `FACEBOOK_LOGIN` | null), `metaUserIdHash String?`, `scope` (`PERSON` | `BUSINESS`), `accountIds String[]`, `status` (`PENDING` | `COMPLETED` | `FAILED`), `accountsAffected Int`, `attempts Int`, `lastError String?`, `createdAt`, `completedAt`.

### 7.2 Regras de negócio
1. **Descarregar** (`disconnectAccount`): DELETE de inscrição na Meta (best-effort) → conta `DISCONNECTED`/`REVOKED`, token e validade nulos → execuções ativas `FAILED` ("Perfil descarregado"). Fluxos mantêm o estado. Troca o perfil ativo só para outro conectado **do mesmo workspace**.
2. **Excluir perfil e dados** (app): confirmação do @ no servidor → descarrega → cria pedido `APP`/`BUSINESS` → exclusão em lotes (mensagens, execuções, contatos, eventos por `accountId` e por prefixo `ig:{igUserId}:`) → transação final (cards de carrossel, fluxos, catálogo, etiquetas, links, conta) com `timeout: 15000` → `COMPLETED`. Se o orçamento de ~40 s acabar, fica `PENDING` e o cron diário/`/tick` continua.
3. **Callback de desautorização**: assinatura válida → contas do provedor do secret que validou, casando `metaUserId` (e `igUserId` no Instagram), ignorando as conectadas depois do `issued_at` (`connectedAt` nulo = conta antiga, o callback se aplica) → `disconnectAccount(notifyMeta: false)`. Máximo de 20 contas.
4. **Callback de exclusão**: mesma validação → pedido `META_CALLBACK` → escopo `BUSINESS` para conta do login do Instagram (a pessoa é a conta profissional), `PERSON` para o login do Facebook (descarrega e apaga `metaUserId`; dados do negócio ficam) → responde `{ url, confirmation_code }` na hora e trabalha em `after()`. Repetição da Meta devolve o mesmo código.
5. **Motor**: sem fallback para token global; webhook de conta inexistente ou descarregada é descartado sem gravar nada; conta EXPIRADA grava contato e mensagem mas não dispara gatilho; checagem do estado antes de cada envio; gravações de estado condicionais (`updateMany`).
6. **Tela de falhas**: escopo por `accountId`; reenvio só de mensagem do perfil ativo e conectado.
7. **Token**: renovação manual salva o token; cron, `markExpired` e `onExpired` só alteram conta `CONNECTED`.
8. **Login do Instagram**: GET documentado; repete com POST só diante de "Unsupported request - method type"; log com método, `code`, `error_subcode`, `fbtrace_id`; grava `metaUserId` (`id` de `/me`) e `connectedAt`.

### 7.3 Telas
- `ConfirmDialog` acessível (U10) em `src/components/ui/ConfirmDialog.tsx`.
- Ajustes: card "Perfil carregado" no topo (estado em palavras, provedor, validade, ações de rotina) com "Zona de risco" ao final; "Descarregar perfil" com subtítulo "Desconecta o Instagram do Fluxo"; botão de login vira "Carregar perfil de novo" (perfil não conectado) ou "Adicionar outro perfil" (conectado); lista de perfis com selo em pt-BR; sem gradiente; "Status do Token" correto.
- `AccountStatusBanner` no layout (duas variantes).
- Painel e lista de automações: "Pausado — …" quando o perfil ativo não está conectado.
- Seletor do cabeçalho: "Token expirado" × "Descarregado"; link "Conectar Instagram" do operador → `/ajustes`.
- `/admin` "Reconectar": link com convite.
- `/conectar`: sucesso sem promessas técnicas, aviso acima dos botões, texto ≥ 12px, convite de workspace inexistente com mensagem honesta.
- `/exclusao-de-dados` pública, `noindex`; `/privacidade` com o texto revisado (G6).

### 7.4 Textos exatos
- **Diálogo descarregar** — título "Descarregar @{usuario}?"; corpo "Isto desconecta o Instagram do Fluxo. Enquanto o perfil estiver descarregado, as automações ficam paradas: ninguém recebe respostas nem mensagens. Execuções em andamento são encerradas. Seus fluxos, contatos e conversas continuam guardados."; desfazer "Para voltar, clique em Carregar perfil de novo e entre com o Instagram. As automações voltam a funcionar sozinhas."; botões "Cancelar" (foco inicial) e "Descarregar perfil".
- **Diálogo excluir** — título "Excluir @{usuario} e todos os dados?"; corpo "Isto não pode ser desfeito. Serão apagados para sempre: contatos, conversas, fluxos, etiquetas, cards e links deste perfil. Nada é apagado no seu Instagram nem nos perfis de outros clientes. A exclusão acontece em partes e costuma levar alguns minutos (até 24 horas em perfis muito grandes); você pode sair desta tela."; campo "Para confirmar, digite o nome do perfil: @{usuario}"; botões "Cancelar" e "Excluir perfil e dados".
- **Faixa, token expirado** — "O acesso do Instagram expirou — as automações de @{usuario} estão pausadas." + link "Reconectar".
- **Faixa, descarregado** — "@{usuario} está descarregado — as automações estão paradas. Seus dados continuam guardados." + link "Carregar perfil".
- **`/exclusao-de-dados`** — título "Como apagar seus dados do Fluxo"; "Se você removeu o Fluxo do seu Instagram ou do Facebook, apagamos seus dados de acesso em alguns minutos (no máximo 24 horas) e deixamos de acessar sua conta. Os dados do negócio (contatos e conversas) são apagados quando a conta profissional pede a exclusão, no app ou por e-mail."; com código: "Código de acompanhamento: {codigo} · Estado: Em andamento | Concluído | Nenhum dado encontrado"; código desconhecido: "Não encontramos um pedido com este código. Se você acabou de pedir, aguarde alguns minutos."

## 8. Backlog priorizado (fora deste pacote)
1. Agendador para `/api/webhook/instagram/tick` (esperas e retentativas hoje dependem de tráfego).
2. Retry de evento que não reexecuta o fluxo (execução presa em RUNNING).
3. Login de cliente (senha ou link mágico), logout, papéis e trilha de auditoria (inclui "ver como cliente").
4. Rate limit (`/api/l`, OAuth, envio por conta).
5. Webhooks descartados: anexos, menções em story, objeto `page` do Facebook.
6. Faturamento (planos, limites, checkout) — hoje só webhook stub.
7. Observabilidade (Sentry, health check, CI, Playwright, cobertura ≥ 80%).
8. `/ai` e `/direct` (placeholders).
9. Ações do `/admin` só no primeiro perfil do cliente; faixa visível de "ver como cliente" com botão de sair.
10. Limite de 200 contatos/conversas sem "carregar mais"; inbox sem atualização ao vivo.
