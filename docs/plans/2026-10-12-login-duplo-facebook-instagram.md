# Login Duplo (Facebook + Instagram) — Design e Plano de Implementação

> **Para o Claude:** executar com subagent-driven-development (um subagente por pacote, revisão entre pacotes). Pacotes A e B rodam em paralelo; C depende de A+B; D (docs) roda em paralelo com C; E (operação) é feito pelo orquestrador.

**Objetivo:** o operador (em `/ajustes`) e o cliente (em `/conectar`) conseguem conectar uma conta profissional do Instagram por **dois caminhos independentes** — "Entrar com Instagram" (Instagram Login, sem Página) e "Entrar com Facebook" (Facebook Login, conta ligada a uma Página) — em produção (Vercel), com erros claros.

**Arquitetura:** um par de credenciais por produto (Meta App → Facebook Login; Instagram App → Instagram Login), `state` OAuth assinado que carrega `mode` + `workspaceId` + `returnTo`, um único callback que despacha só para o fluxo do `mode` (sem fallback cruzado), e a conta salva com `authProvider` para o cliente Graph usar o host certo (`graph.instagram.com` x `graph.facebook.com`).

**Stack:** Next.js 16 (App Router, route handlers), Prisma 7 + Postgres (Supabase), Vitest, Zod.

---

## 1. Diagnóstico (evidência)

| Erro na tela | Causa raiz | Onde |
|---|---|---|
| "Meta OAuth Error: Invalid platform app" | `IG_APP_ID` == `META_APP_ID` (ID do App da Meta) em `.env`, `.env.local` e Vercel. O Instagram Login exige o **Instagram App ID** (Painel › Instagram › Configuração da API com login do Instagram › Configurações do login comercial). Além disso, o callback tenta o Facebook e, ao falhar, reaproveita o *mesmo code* no Instagram, mascarando o erro real. | `src/lib/meta/oauth.ts` (`IG_APP_ID \|\| META_APP_ID`), `src/app/api/auth/instagram/callback/route.ts` (estratégia 1→2) |
| "URL bloqueada" | `https://<APP_URL>/api/auth/instagram/callback` não está em "URIs de redirecionamento do OAuth válidos" do Facebook Login (nem do Instagram business login). | Painel Meta |
| "Recurso indisponível — Login do Facebook" | Restrição do lado da Meta no app (ação obrigatória pendente / detalhes do app / modo do app). | Painel Meta |
| (latente) `/conectar` sempre falha | Página pública, mas `/api/auth/instagram/login` exige sessão (`requireActor`) e nenhum código cria sessão de cliente. | `login/route.ts` |
| (latente) produção não salva nada | Vercel sem `DATABASE_URL`, `DIRECT_URL`, `TOKEN_ENCRYPTION_KEY`, `APP_URL`, `CRON_SECRET`. | Vercel env |
| (latente) contas via Facebook não enviam DM | `graph.ts` só usa `graph.instagram.com`; token de Página só funciona em `graph.facebook.com`. | `src/lib/meta/graph.ts` |
| (segurança) `state` assinado com fallback fixo `"meta-secret-state"` | Fail-open se não houver secret. | `oauth.ts` |

## 2. Entendimento confirmado
- App oficial: **1911508559530553** ("[Evandro] [Redes] - Automação"). O `.env.local` deixa de sobrescrever as credenciais Meta.
- O orquestrador configura env vars na Vercel e faz deploy de produção (autorizado).
- O orquestrador configura o painel da Meta pelo Chrome do dono (autorizado).
- Facebook Login com várias Páginas: conectar **todas** as contas IG vinculadas.
- Fora do escopo: motor, fila, Stripe, matcher.

## 3. Premissas
- Redirect URI canônica = `${APP_URL}/api/auth/instagram/callback` (HTTPS de produção), a mesma para os dois produtos. Iniciar no localhost funciona: o retorno volta para o `returnTo` assinado.
- O banco é o mesmo Supabase em local e produção.
- O webhook já aceita assinatura com `IG_APP_SECRET` ou `META_APP_SECRET` (`webhook.ts:198`). Nada muda.
- Escopos do Facebook Login: `instagram_basic, instagram_manage_comments, instagram_manage_messages, pages_show_list, pages_read_engagement, pages_manage_metadata, business_management`.
- Escopos do Instagram Login: `instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments`.

## 4. Decision Log
| # | Decisão | Alternativas | Por quê |
|---|---|---|---|
| D1 | Credenciais separadas: `META_APP_ID/SECRET` → Facebook; `IG_APP_ID/IG_APP_SECRET` → Instagram Login; erro explícito se `IG_APP_ID === META_APP_ID` | Novas vars `INSTAGRAM_APP_*` | Os nomes já existem em todos os ambientes; basta corrigir os valores. A guarda transforma "Invalid platform app" numa mensagem acionável. |
| D2 | Um callback, `mode` dentro do `state` assinado, sem fallback cruzado | Dois callbacks | Uma URI a cadastrar nos dois produtos; erros reais aparecem. |
| D3 | `state` carrega `workspaceId`, assinado com `OAUTH_STATE_SECRET \|\| TOKEN_ENCRYPTION_KEY`, sem fallback fixo (fail-closed), TTL de 15 min | Cookie + sessão no callback | O callback pode estar em outro domínio (localhost → Vercel). O vínculo da conta ao workspace é decidido no início (com sessão ou convite) e é imutável. |
| D4 | `/conectar?convite=<token>`: convite HMAC `{workspaceId, exp 7d}`, gerado em `/ajustes` | Criar contas/sessões de cliente | É o menor passo que torna o link do cliente funcional e seguro (sem OAuth anônimo). |
| D5 | Coluna `InstagramAccount.authProvider` (`INSTAGRAM_LOGIN` \| `FACEBOOK_LOGIN`, default `INSTAGRAM_LOGIN`) + `fbPageId` opcional | Detectar pelo formato do token | Explícito e testável; o cliente Graph escolhe o host por ela. |
| D6 | Conectar todas as contas IG das Páginas autorizadas | Tela de escolha | Decisão do dono; o seletor de conta já existe. |
| D7 | `ecc:angular-developer` não se aplica (o projeto é Next.js/React); usar padrões React/Next | — | Stack real do repositório. |

## 5. Riscos
- "Recurso indisponível" pode depender de revisão da Meta, fora do nosso controle. Mitigação: o app em modo Desenvolvimento + o dono como admin/testador permite logar sem revisão.
- Instagram Login em modo Dev só aceita contas adicionadas como "Testador do Instagram" no app.

---

## Pacote A — Núcleo OAuth (paralelo com B)

**Arquivos:** modificar `src/lib/meta/oauth.ts`, `src/lib/meta/oauth.test.ts`; criar `src/lib/meta/connect-invite.ts` e `src/lib/meta/connect-invite.test.ts`.

### A1. Credenciais por produto (TDD)
Testes (em `oauth.test.ts`) primeiro:
- `getFacebookAppCredentials()` retorna `META_APP_ID/META_APP_SECRET` e lança `OAuthConfigError` se faltar.
- `getInstagramAppCredentials()` retorna `IG_APP_ID/IG_APP_SECRET`; lança `OAuthConfigError` com mensagem contendo "ID do app do Instagram" quando `IG_APP_ID` está vazio **ou é igual a `META_APP_ID`**.
- `getFacebookBusinessLoginUrl` usa `META_APP_ID` (nunca o IG_APP_ID), host `www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`, escopos da §3, sem `extras` por padrão.
- `getInstagramOAuthUrl` usa `IG_APP_ID`.
- `exchangeCodeForShortLivedToken` / `exchangeForLongLivedToken` usam as credenciais do Instagram; `exchangeFacebookCodeForToken` / `exchangeForLongLivedFacebookUserToken` usam as do Facebook.

Implementação: `export class OAuthConfigError extends Error`; trocar todos os `process.env.IG_APP_ID || process.env.META_APP_ID` pelas funções. Importar `GRAPH_API_VERSION` de `./graph` em vez de `"v21.0"` literal.

### A2. State assinado (TDD)
API nova (substitui `generateOAuthState(returnTo)`/`verifyOAuthState`):
```ts
export type OAuthMode = "instagram" | "facebook";
export type OAuthStatePayload = { mode: OAuthMode; workspaceId: string; returnTo: string; nonce: string; iat: number };
export function createOAuthState(input: { mode: OAuthMode; workspaceId: string; returnTo: string }, now = Date.now()): string;
export function readOAuthState(state: string | null | undefined, now = Date.now()): OAuthStatePayload | null; // null se assinatura/TTL/forma inválidos
```
- Secret: `process.env.OAUTH_STATE_SECRET || process.env.TOKEN_ENCRYPTION_KEY`; sem secret → `OAuthConfigError` (fail-closed).
- Formato `base64url(JSON).hex(hmacSHA256)`; comparação com `crypto.timingSafeEqual`; TTL 15 min; payload validado com Zod; `returnTo` precisa ser URL `http(s)` absoluta ou caminho começando com `/` (não `//`).
- Testes: ida e volta; assinatura adulterada → null; expirado → null; secret ausente → lança; `returnTo` `//evil.com` → null.

### A3. Erros amigáveis (TDD)
```ts
export function describeOAuthError(raw: string): string
```
Mapeia: `/invalid platform app/i` → "O ID do app do Instagram está errado. Use o 'ID do app do Instagram' (Painel › Instagram › Configuração da API com login do Instagram), não o ID do App da Meta."; `/redirect_uri|URL bloqueada|URL blocked/i` → "A URL de retorno não está cadastrada no painel da Meta: <redirect>"; `/access_denied|user denied|permissions error/i` → "Autorização cancelada no Instagram/Facebook."; `/código.*(usado|expirad)|code has been used|expired/i` → "Este link de autorização expirou. Clique em conectar novamente."; senão devolve o texto original (máx. 300 chars).

### A4. Convite de cliente — `connect-invite.ts` (TDD)
```ts
export function createConnectInvite(workspaceId: string, now = Date.now(), ttlMs = 7 * 86400000): string; // base64url(JSON{w,exp}).hmac
export function readConnectInvite(token: string | null | undefined, now = Date.now()): { workspaceId: string } | null;
```
Mesmo secret de A2, com prefixo de domínio no HMAC (`"invite:"`) para que um `state` não valha como convite e vice-versa. Testes: ida e volta, expirado, adulterado, state usado como convite → null.

**Verificar:** `npx vitest run src/lib/meta` e `npx tsc --noEmit` verdes. Commit `feat(oauth): credenciais por produto, state assinado com workspace e convite de cliente`.

---

## Pacote B — Conta sabe por qual login entrou (paralelo com A)

**Arquivos:** `prisma/schema.prisma`, nova migração `prisma/migrations/20261012120000_account_auth_provider/migration.sql`, `src/lib/meta/graph.ts`, `src/lib/meta/graph.test.ts`, `src/lib/meta/account-client.ts` (+ teste se existir), `src/lib/meta/token-renewal.ts` (+ teste).

### B1. Schema
```prisma
enum AuthProvider {
  INSTAGRAM_LOGIN // token do Instagram Login → graph.instagram.com, renova a cada 60 dias
  FACEBOOK_LOGIN  // token de Página do Facebook → graph.facebook.com, não expira
}
// em InstagramAccount:
  authProvider   AuthProvider     @default(INSTAGRAM_LOGIN)
  fbPageId       String?          // Página do Facebook (só FACEBOOK_LOGIN)
```
Migração SQL escrita à mão (CREATE TYPE + ALTER TABLE ADD COLUMN com default). Rodar `npx prisma generate`. **Não** rodar `migrate dev` contra o banco (o orquestrador aplica com `migrate deploy`).

### B2. Cliente Graph por provedor (TDD em `graph.test.ts`)
- `new InstagramGraphClient(token, { onExpired, provider: "facebook" })` → requisições para `https://graph.facebook.com/${GRAPH_API_VERSION}/...`; default / `"instagram"` → `graph.instagram.com` (comportamento atual intacto; testes antigos continuam verdes).
- Exportar `graphBaseFor(provider)`.
- `subscribeWebhooks()` com provider facebook: `POST me/subscribed_apps` com `subscribed_fields: ["messages","messaging_postbacks","feed"]` (token de Página → `me` = Página).
- `refresh` continua só para instagram (com facebook retorna falha "Token de Página não precisa de renovação").

### B3. account-client e token-renewal
- `graphClientForAccount` seleciona `authProvider` e passa `provider: authProvider === "FACEBOOK_LOGIN" ? "facebook" : "instagram"`.
- `token-renewal`: pular contas `FACEBOOK_LOGIN` explicitamente (além do `tokenExpiresAt null` existente). Teste novo.

**Verificar:** `npx vitest run src/lib/meta` e `npx tsc --noEmit`. Commit `feat(meta): authProvider na conta e cliente Graph com host por provedor`.

---

## Pacote C — Rotas e telas (depois de A+B)

**Arquivos:** criar `src/lib/meta/connect-account.ts` + `connect-account.test.ts`; reescrever `src/app/api/auth/instagram/login/route.ts` e `callback/route.ts` (+ `src/app/api/auth/instagram/oauth.routes.test.ts`); ajustar `src/app/ajustes/actions.ts`, `src/app/ajustes/SettingsClient.tsx`, `src/app/conectar/page.tsx`, `src/app/conectar/ConectarClient.tsx`.

### C1. `connect-account.ts` (TDD com fetch/prisma mockados)
```ts
export async function connectViaInstagram(code: string, redirectUri: string, workspaceId: string): Promise<string[]> // usernames
export async function connectViaFacebook(code: string, redirectUri: string, workspaceId: string): Promise<string[]>
```
- Instagram: short → long-lived → profile → `subscribeAccountWebhooks` → upsert (`authProvider: INSTAGRAM_LOGIN`, `tokenExpiresAt`, `status CONNECTED`, `tokenStatus ACTIVE`).
- Facebook: code → user token → long-lived user token → `fetchFacebookPagesAndInstagram` → zero contas ⇒ `throw new Error("Nenhuma conta profissional do Instagram vinculada a uma Página do Facebook foi autorizada. Na tela da Meta, marque a Página e a conta do Instagram.")` → upsert de todas (`authProvider: FACEBOOK_LOGIN`, `fbPageId`, `tokenExpiresAt: null`).
- Upsert compartilhado `saveConnectedAccount(...)`: se `igUserId` já pertence a **outro** workspace → erro "Esta conta do Instagram já está vinculada a outro cliente." (manter regra atual).
- Remover o `try{}catch{}` mudo de `fetchFacebookPagesAndInstagram` para a inscrição de webhook: registrar `console.warn` com o pageId (sem token).

### C2. `GET /api/auth/instagram/login`
Query: `mode=instagram|facebook` (default instagram), `from=conectar|ajustes`, `convite=<token>`.
1. Resolve `workspaceId`: se `convite` válido → `readConnectInvite`; senão `getCurrentActor()` → (SUPERADMIN com cookie de impersonação → aquele workspace; senão `getOrCreateWorkspaceForActor`). Nenhum dos dois → redireciona `returnPath?error=` "Link de conexão inválido ou expirado. Peça um novo link." (`/conectar`) ou "Sessão expirada." (`/ajustes`).
2. `returnTo = ${origin}${returnPath}` (+ `?convite=` preservado para `/conectar`).
3. `state = createOAuthState({mode, workspaceId, returnTo})`; URL por modo; `OAuthConfigError` → redireciona com a mensagem (é o que mostra "ID do app do Instagram errado" na tela, sem ir à Meta).
4. Erros sempre voltam para `returnPath` (não para `/ajustes` fixo).

### C3. `GET /api/auth/instagram/callback`
1. `payload = readOAuthState(state)`; inválido → redireciona `${origin}/ajustes?error=` "Sessão de autorização inválida ou expirada. Tente conectar novamente.".
2. `error` da Meta → `returnTo?error=describeOAuthError(...)`.
3. Sem `code` → erro.
4. `mode === "facebook"` ? `connectViaFacebook` : `connectViaInstagram`, com `workspaceId` do state. **Sem fallback cruzado.**
5. Sucesso → `returnTo?connected=true&username=<primeiro>&count=<n>`; erro → `returnTo?error=describeOAuthError(msg)`. Log sem tokens/códigos.
6. Montar URL de retorno com `new URL(returnTo)` + `searchParams.set` (preserva `convite`).

### C4. Telas
- `actions.ts`: `getMetaSettings` passa a devolver `clientConnectUrl` (`${APP_URL}/conectar?convite=<token do workspace atual>`), `oauthRedirectUri` absoluta (`getInstagramRedirectUri()`), e `oauthConfig: { facebookReady: boolean; instagramReady: boolean; instagramIssue?: string }` (sem segredos).
- `SettingsClient.tsx`: o link do cliente usa `clientConnectUrl`; dois botões claros "Entrar com Instagram" / "Entrar com Facebook"; bloco "Configuração do login" mostrando a redirect URI para copiar e o status de cada produto (badge verde/âmbar com `instagramIssue`).
- `conectar/page.tsx` lê `convite` e passa ao client; `ConectarClient` monta `/api/auth/instagram/login?from=conectar&mode=<m>&convite=<t>`; sem convite → aviso "Peça ao seu gestor o link de conexão" e botões desabilitados; os dois botões com rótulos "Entrar com Instagram" e "Entrar com Facebook".
- Manter o estilo visual existente (tokens `bg-surface-*`, `text-ink*`, `fx-btn`).

### C5. Testes de rota (`oauth.routes.test.ts`, mocks de `@/lib/tenancy`, `@/lib/meta/connect-account`)
- login sem sessão e sem convite → redirect com erro para o returnPath; com convite → 302 para `instagram.com/oauth/authorize` com `client_id = IG_APP_ID`; `mode=facebook` → `facebook.com/.../dialog/oauth` com `client_id = META_APP_ID`; `IG_APP_ID === META_APP_ID` → redirect com mensagem "ID do app do Instagram".
- callback state inválido → erro; mode facebook chama só `connectViaFacebook`; falha no facebook **não** chama `connectViaInstagram`; sucesso redireciona com `connected=true`; `error=access_denied` → mensagem amigável.

**Verificar:** `npm test`, `npx tsc --noEmit`, `npx eslint` nos arquivos tocados. Commit `feat(login): login duplo Facebook/Instagram com convite de cliente`.

---

## Pacote D — Documentação (paralelo com C)
- `docs/etapa-7-meta-app.md`: seção "Login duplo" com checklist do painel (Facebook Login › URIs válidas; Instagram › Configuração da API com login do Instagram › Configurações do login comercial › URLs de redirecionamento; onde achar o Instagram App ID/Secret; testadores do Instagram em modo Dev; webhooks dos dois produtos).
- `docs/DECISIONS.md`: ADR-006 "Login duplo" (D1–D5), anotando que ADR-005 passa a valer só para o Instagram Login.
- `.env.example`: comentários explicando `META_APP_*` (Facebook) x `IG_APP_*` (Instagram App ID — diferente!), `OAUTH_STATE_SECRET`, `APP_URL`.
- Commit `docs: login duplo Facebook/Instagram`.

---

## Pacote E — Operação (orquestrador)
1. Painel Meta (Chrome do dono), app 1911…553: pegar o Instagram App ID/Secret; cadastrar a redirect URI no Facebook Login e no Instagram business login; conferir os domínios do app, as URLs de privacidade/termos/exclusão; investigar "Recurso indisponível" (ações obrigatórias, modo do app); conferir as funções de testador.
2. `.env`: `IG_APP_ID/IG_APP_SECRET` = Instagram; remover `META_APP_*`/`IG_APP_*` do `.env.local`.
3. Vercel (production): `DATABASE_URL`, `DIRECT_URL`, `TOKEN_ENCRYPTION_KEY`, `APP_URL`, `CRON_SECRET`, `IG_APP_ID`, `IG_APP_SECRET`, Supabase; deploy `vercel --prod`.
4. E2E com agent-browser: `/ajustes` → "Entrar com Instagram" chega à tela de login do Instagram (sem "Invalid platform app"); "Entrar com Facebook" chega ao diálogo do Facebook (sem "URL bloqueada"); `/conectar?convite=` idem; `/conectar` sem convite mostra o aviso.
5. Teste real com o dono (o login com as credenciais dele é feito por ele).
