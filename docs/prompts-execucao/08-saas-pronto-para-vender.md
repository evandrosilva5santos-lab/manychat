# PROMPT 08 — Pronto para vender: contas, multiempresa, OAuth, cobrança, legal/LGPD e App Review da Meta

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> **8a (legal e callbacks)** entra na Onda A, porque a revisão da Meta leva semanas. O restante (8b a 8h) entra na Onda F, **em sequência**, depois dos itens 1 a 6.

## Papel
Você transforma o "Fluxo" de ferramenta de um dono só em **SaaS multiempresa** vendável, em conformidade com a LGPD e pronto para passar no App Review da Meta.

## Leitura obrigatória específica
`PRD.md`, `PRD_TRACEABILITY.md` (REQ-001 e REQ-002), `README.md`, `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/RULES.md` (exige fluxo de exclusão LGPD), `docs/PRD_ISSUES.md` (ISSUE-002: escopo de mídia), `docs/deploy-vercel.md`, `docs/etapa-7-meta-app.md`, `docs/etapa-8-deploy-teste.md`, `docs/guia-passo-a-passo.md`, a pasta `design/` (telas Conectar, Conta e Verificação já desenhadas), `execution/MASTER_PLAN.md` (NANO-031 e NANO-033).

## Decisões do dono (bloqueantes; pergunte antes da etapa correspondente)
- Provedor de autenticação: Auth.js, Supabase Auth ou Clerk.
- Pagamento: Stripe (internacional), Asaas ou Mercado Pago (PIX/boleto), ou ambos.
- Planos, preços e limites (contatos, DMs por mês, contas Instagram por empresa, automações ativas).
- Modelo de venda: SaaS hospedado (recomendado) ou white-label para agências. Licença self-hosted **não** é recomendada: cada comprador precisaria do próprio app Meta e do próprio App Review.
- Dados da empresa para as páginas legais: razão social, CNPJ, endereço, e-mail do encarregado (DPO).

## Evidências da auditoria
- Não há modelo de usuário, empresa ou sessão. `getCurrentAccount()` pega a primeira conta. Muitas actions não filtram por conta (IDOR):
  - `contatos/actions.ts:215,250`;
  - `catalogo/actions.ts:327`;
  - `conversas` (já corrigido);
  - `runner.ts:38,426`.
- Não há OAuth; o token é global no ambiente.
- Não há páginas de Privacidade, Termos ou exclusão de dados; não há callbacks de exclusão ou desautorização; não há opt-out ("parar"); não há política de retenção.
- Não há cobrança, limites de plano nem painel administrativo.
- O script `vercel-build` (`package.json:15`) roda `migrate deploy` em qualquer build, inclusive de preview, possivelmente no banco de produção.

## Etapas
### 8a — Legal, LGPD e callbacks da Meta (Onda A, paralelo)
1. Páginas públicas `/privacidade`, `/termos` e `/exclusao-de-dados`, em pt-BR, linkadas no rodapé e liberadas no proxy. **Textos-base gerados devem ser marcados para revisão por advogado.**
2. `POST /api/meta/data-deletion`:
   - valida o `signed_request` com o segredo do app;
   - agenda a exclusão dos dados do usuário;
   - responde `{ url, confirmation_code }`;
   - a página de status consulta o código.
3. `POST /api/meta/deauthorize`: marca a conta como REVOKED, apaga o token e para as automações.
4. **Opt-out:** palavras "parar", "sair", "stop" e "cancelar" → contato marcado `optedOut`, que bloqueia qualquer envio automático; mensagem de confirmação dentro da janela; reativação se a pessoa escrever de novo (definir com o dono).
5. **Direitos do titular:** exportar e excluir um contato pelo painel (e por `igsid`); retenção configurável (o job é do item 5); modelo de DPA (o cliente é o controlador, o Fluxo é o operador).

### 8b — Contas e empresas (workspaces)
- Modelos `User`, `Workspace`, `Membership` (papéis owner, admin, agent), `Session`.
- `InstagramAccount` pertence a um `Workspace`; toda consulta é filtrada por `workspaceId` (helper `requireWorkspace()` em toda action e rota).
- Substitui o Basic Auth do item 1 por login real: e-mail e senha ou link mágico, recuperação de senha e verificação de e-mail via Resend.
- Cookies httpOnly e `SameSite=Lax`; checagem de origem nas actions; limite de tentativas no login.
- Testes de isolamento: a empresa A **não consegue** ler nem alterar nada da empresa B (um teste por action e rota).

### 8c — OAuth do Instagram por cliente
- Fluxo: `https://www.instagram.com/oauth/authorize` (escopos `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`) → callback com `state` anti-CSRF → `api.instagram.com/oauth/access_token` → `ig_exchange_token` (60 dias) → token criptografado (item 5) → `POST /me/subscribed_apps` com os campos certos → salvar `igUserId` e `username`.
- Desconectar e reconectar; várias contas por empresa conforme o plano; webhook roteado por `entry.id` (o item 3 já faz).
- Usar as telas Conectar, Conta e Verificação da pasta `design/`.

### 8d — Cobrança e limites
- Checkout e portal do cliente com o provedor escolhido.
- Webhooks de pagamento com assinatura verificada e idempotência.
- Status da assinatura (trial, ativa, inadimplente, cancelada) e política de inadimplência (aviso → bloqueio só de novos disparos, nunca perda de dados).
- Limites por plano medidos no banco e aplicados no motor e na interface, com mensagem clara e convite para upgrade.
- Testes com o modo de teste do provedor (cartões e PIX de teste).

### 8e — Painel administrativo
Lista de empresas, saúde dos tokens, envios com falha, eventos DEAD, uso por plano, e acesso como cliente (impersonação) com registro de auditoria. Disponível só para o papel superadmin.

### 8f — Ambientes, deploy e backup
- Staging e produção separados: banco, app Meta de teste e app de produção, variáveis na Vercel.
- `vercel-build` roda `migrate deploy` **só** quando `VERCEL_ENV==="production"` (preview usa banco próprio ou nenhum).
- Backups e restauração (PITR) testados uma vez, com evidência.
- Domínio próprio com HTTPS.

### 8g — App Review da Meta (entregável para o dono executar)
Gere `docs/meta-app-review.md` com o passo a passo:
- Business Verification;
- Advanced Access para cada permissão, com justificativa em inglês, e roteiro dos screencasts mostrando o uso real de cada escopo (comentário → private reply; DM → resposta; postback);
- URLs de Privacidade, Termos e Exclusão de dados e de desautorização;
- usuário de teste para o revisor;
- Tech Provider, se for atender clientes;
- mudar o app para Live.

Inclua também um checklist de reprovações comuns e como evitá-las. **Não submeta nada em nome do dono.**

### 8h — Onboarding e suporte
- Checklist dentro do app: conectar o Instagram → criar a primeira automação → testar com a própria conta.
- Página de ajuda (FAQ: janela de 24h, por que a DM não chegou, limites).
- E-mails transacionais.
- Página de status.

## Agentes e skills
- **Agentes:** `architect` (desenho multiempresa antes de codar), `planner`, `database-reviewer`, `security-reviewer` (autenticação, OAuth, cobrança, isolamento), `typescript-reviewer`, `react-reviewer`, `tdd-guide`, `e2e-runner`, `general-purpose` (documentação oficial da Meta e do provedor de pagamento).
- **Skills:** `auth-implementation-patterns`, `nextjs-supabase-auth` / `clerk-auth`, `stripe-integration` / `payment-integration` / `billing-automation`, `privacy-by-design`, `ADV-Compliance-legislacao` (só rascunho), `saas-mvp-launcher`, `pricing-strategy`, `onboarding-cro`, `vercel-deployment`, `database-migrations`, `instagram-automation`.

## Testes
- Isolamento entre empresas (automatizado, todas as actions e rotas).
- OAuth de ponta a ponta com a conta de teste no Chrome real: conectar → token salvo cifrado → webhook assinado → desconectar.
- `signed_request` de exclusão: válido → processa e devolve o código; inválido → 400.
- Desautorização → conta REVOKED e automações paradas.
- Opt-out → nenhum envio automático depois de "parar".
- Cobrança no modo de teste: assinar → ativar → falha de pagamento → inadimplente → regularizar; webhook duplicado não duplica nada.
- Limites: ao estourar o limite do plano, o motor não envia e a interface explica.
- **E2E completo (Playwright):** cadastro → verificação de e-mail → conectar Instagram (OAuth simulado no nível da rede) → criar automação → assinar plano → painel.
- QA de navegador (DevTools MCP) nas telas novas em 375, 768 e 1440, com Lighthouse.

## Critérios de aceite
- [ ] Duas empresas de teste totalmente isoladas (prova automatizada).
- [ ] Um cliente novo consegue se cadastrar, conectar o Instagram, criar uma automação e pagar, sozinho e sem ajuda técnica (vídeo ou screenshots).
- [ ] Páginas legais, exclusão de dados, desautorização e opt-out funcionando; textos marcados para revisão jurídica.
- [ ] Staging e produção separados; backup restaurado com sucesso uma vez.
- [ ] `docs/meta-app-review.md` entregue; `PRD.md`, `PRD_TRACEABILITY.md`, `README.md` e `docs/ARCHITECTURE.md` atualizados para o modelo multiempresa.
- [ ] **Gate final:** re-auditoria com os 10 ângulos do prompt mestre, sem CRITICAL nem HIGH, e relatório final ao dono, com o que depende só da aprovação da Meta.
