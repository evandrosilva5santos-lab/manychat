# PROMPT 01 — Segurança: autenticação do painel e rotas públicas

> Prompt fracionado. Funciona sozinho, mas **antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11): as regras inegociáveis, o ciclo planejar → testar → implementar → auditar → corrigir → retestar e o formato do relatório valem aqui.
> Onda A (paralelo com os itens 2, 6a e 8a). Faça merge **antes** do item 2.

## Papel
Você é o responsável pela segurança do "Fluxo" (Next.js 16, `/Users/evandro/Downloads/Manychat`). Feche todas as portas abertas hoje, sem quebrar o webhook da Meta.

## Leitura obrigatória específica
`CLAUDE.md`, `docs/RULES.md`, `docs/DECISIONS.md` (ADR-002 desligou o Basic Auth "só em dev", mas ele ficou desligado em todos os ambientes), `state/BLOCKERS.md` (BLK-001), `docs/deploy-vercel.md`, `PRD_TRACEABILITY.md` (REQ-003, REQ-008, REQ-012).

## Evidências da auditoria (confirme no código)
- `src/proxy.ts:17-20`: `return NextResponse.next()` incondicional. `safeEqual` e a lógica de `SITE_PASSWORD` estão mortas.
- **Server actions são endpoints POST públicos:** `sendManualDirectMessage`, `renewMetaToken`, `subscribeMetaWebhooks`, apagar/editar fluxos, catálogo e etiquetas, e ler contatos.
- **`src/app/api/instagram/media/route.ts`:**
  - sem autenticação;
  - `userId` e `limit` vêm da query string, sem limite;
  - devolve `error.message` ao cliente;
  - gasta a cota da Graph API.
- **`src/app/api/l/[code]/route.ts:13-21`:**
  - redirecionamento aberto via `?to=`;
  - o `code` é ignorado;
  - o `catch` redireciona para a string crua;
  - aceita `javascript:`.
- **Verify token:**
  - padrão fixo `"fluxo_webhook_token"` (`api/webhook/instagram/route.ts:18`);
  - outro padrão em `ajustes/actions.ts:~30` (`"token_verificacao_fluxo_secreto"`);
  - o valor real é enviado ao navegador (`getMetaSettings` → `SettingsClient`).
- `src/lib/meta/webhook.ts:~44-79`: a assinatura HMAC é aceita sem verificação quando o segredo ou o cabeçalho faltam e `NODE_ENV !== "production"`. Também lê só `META_APP_SECRET`; no Instagram Login o segredo é o do app Instagram (`IG_APP_SECRET`).
- `next.config.ts` não define cabeçalhos de segurança. Não há rate limit.
- IDs previsíveis com `Date.now()` e `Math.random` em `fluxos/actions.ts` e `contatos/actions.ts`.
- Validação de entrada desigual: `createContact`, `addTagToContact`, `renameFlow`, `updateFlowStatus` e o catálogo não usam Zod; URLs aceitam `http:` e `javascript:` (`recipe.ts:43,74` só limita o tamanho).
- `npm audit`: `next` 16.3.6 tem avisos de segurança (atualize, se a Fase 0 ainda não fez).

## Tarefas
1. **Autenticação provisória (até o item 8 trazer contas reais):**
   - Reative o HTTP Basic Auth em `src/proxy.ts` com comparação em tempo constante (`crypto.timingSafeEqual` sobre buffers de mesmo tamanho).
   - Em produção, sem `SITE_PASSWORD`, o site fica fechado (503 com mensagem clara).
   - Rotas liberadas: `/api/webhook/*`, `/api/l/*`, `_next/*`, `favicon`, e as futuras páginas legais e callbacks da Meta (`/privacidade`, `/termos`, `/exclusao-de-dados`, `/api/meta/data-deletion`, `/api/meta/deauthorize`).
2. **Defesa em profundidade:**
   - Crie `src/lib/auth/requireAuth.ts` e chame-o na **primeira linha de toda server action** e de toda rota de API privada.
   - O proxy sozinho não é suficiente.
   - Altere só a primeira linha de cada action (o item 2 mexe no corpo).
3. **`/api/instagram/media`:**
   - exigir autenticação;
   - ignorar `userId` da query e usar a conta conectada;
   - limitar `limit` entre 1 e 50;
   - devolver erro genérico ao cliente e registrar os detalhes só no servidor.
4. **`/api/l/[code]`:**
   - Remova o parâmetro `to`.
   - Crie o modelo `TrackedLink` (`code` único e aleatório, `url`, `accountId`, `contactId?`, `flowId?`, `nodeId?`, `clicks`, `firstClickedAt`, `lastClickedAt`) e o modelo `LinkClick` (opcional).
   - Redirecione **somente** para a URL salva, que deve ser `https:`.
   - Registre o clique.
   - Código inexistente → 404.
   - O motor (item 3) vai gerar esses links.
5. **Webhook:**
   - GET verify: sem valor padrão (falta a variável → 500 e log), comparação em tempo constante.
   - POST: falhar fechado sempre que o segredo faltar, exceto com `ALLOW_UNSIGNED_WEBHOOKS=1` **e** `NODE_ENV!=="production"`.
   - Aceitar o segredo correto do app (`IG_APP_SECRET` para Instagram Login; documente).
6. **Ajustes:** nunca enviar o verify token nem segredos ao cliente. Mostre só "configurado / não configurado" ou um valor mascarado.
7. **Cabeçalhos em `next.config.ts`:**
   - CSP com nonce (ou o mais estrita possível sem quebrar o Next) e `frame-ancestors 'none'`;
   - HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`;
   - `Permissions-Policy` com câmera, microfone e geolocalização desligados;
   - imagens de `*.cdninstagram.com` e `*.fbcdn.net` liberadas.
8. **Rate limit:** no webhook (generoso), em `/api/instagram/media`, em `/api/l` e nas actions sensíveis (envio de DM, renovação de token). Use Upstash Ratelimit se o dono aprovar; senão, uma solução simples no Postgres.
9. **IDs e validação:**
   - `crypto.randomUUID()` (ou cuid do Prisma) no lugar de `Date.now()` e `Math.random`.
   - Zod em **todas** as server actions.
   - URLs com `z.url()` + refinamento que aceita só `https:`.
   - `status` validado como enum.

## Arquivos que este item possui
`src/proxy.ts`, `src/lib/auth/*`, `next.config.ts`, `src/app/api/instagram/media/*`, `src/app/api/l/*`, `src/lib/meta/webhook.ts` (parte de assinatura), `src/app/api/webhook/instagram/route.ts` (só o GET verify e a assinatura), `src/app/ajustes/actions.ts` (só o mascaramento), a primeira linha de cada `src/app/**/actions.ts`, e a parte `TrackedLink` do `schema.prisma` (envie ao orquestrador).

## Agentes e skills
- **Agentes:** `security-reviewer` (obrigatório antes e depois), `typescript-reviewer`, `code-reviewer`, `tdd-guide`, `database-reviewer` (migration do `TrackedLink`).
- **Skills:** `security-review`, `top-web-vulnerabilities`, `auth-implementation-patterns`, `secrets-management`, `nextjs-best-practices`, `tdd-workflow`.

## Testes (TDD — escreva antes)
- **Proxy:**
  - sem credencial → 401 com `WWW-Authenticate`;
  - credencial errada → 401;
  - credencial certa → passa;
  - produção sem senha → 503;
  - rotas liberadas passam sem credencial.
- **`requireAuth`:** uma action chamada sem autenticação é rejeitada (teste unitário por action crítica).
- **Webhook:**
  - assinatura válida → 200;
  - inválida → 401;
  - ausente em produção → 401;
  - segredo ausente → 500;
  - GET com token certo → challenge;
  - GET com token errado → 403.
- **Media:**
  - sem autenticação → 401;
  - `limit=999` → limitado a 50;
  - `userId` da query é ignorado;
  - erro da Graph → mensagem genérica.
- **Link:**
  - código válido → 302 para a URL salva e clique registrado;
  - código inválido → 404;
  - nenhum parâmetro `to` é aceito;
  - URL salva `javascript:` ou `http:` é rejeitada ao salvar.
- **Cabeçalhos:** teste de integração verificando a presença de cada cabeçalho.
- **Navegador (DevTools MCP):**
  - abrir `http://localhost:3007` → o navegador pede a senha;
  - depois do login, todas as páginas funcionam e o console não mostra violação de CSP;
  - `curl -I` mostra os cabeçalhos;
  - `curl -X POST` em uma server action sem credencial → bloqueado.
- **Re-auditoria:** rode o `security-reviewer` de novo sobre o diff e sobre o projeto todo. Nenhum achado CRITICAL ou HIGH pode restar.

## Critérios de aceite
- [ ] Nenhuma página ou action privada responde sem autenticação (prova: testes + curl).
- [ ] Webhook da Meta continua funcionando com assinatura válida (prova: teste com payload assinado).
- [ ] Sem redirecionamento aberto; cliques registrados.
- [ ] Nenhum segredo chega ao navegador (prova: busca no HTML/JS servido de `/ajustes`).
- [ ] Cabeçalhos presentes; Lighthouse "Best Practices" ≥ 95; zero erros de CSP no console.
- [ ] tsc, eslint (arquivos tocados), testes e build verdes; `PRD_TRACEABILITY.md` (REQ-012) e `docs/DECISIONS.md` (novo ADR substituindo o ADR-002) atualizados.
