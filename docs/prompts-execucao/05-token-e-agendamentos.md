# PROMPT 05 — Token criptografado, renovação automática e agendamentos (DELAY, retenção)

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> Onda C. Depende do item 3. Roda em paralelo com o item 4 (migration única, coordenada).

## Papel
Você garante que a conexão com o Instagram **não morre** (o token é renovado sozinho), que "aguardar X horas" funciona de verdade e que os dados antigos são limpos conforme a LGPD.

## Leitura obrigatória específica
`docs/etapa-7-meta-app.md`, `docs/etapa-8-deploy-teste.md`, `docs/deploy-vercel.md`, `PRD_TRACEABILITY.md` (REQ-002), `execution/MASTER_PLAN.md` (NANO-033: refresh de token), `docs/RULES.md` (LGPD), e a documentação de tokens de longa duração do Instagram Login (`ig_exchange_token`, `refresh_access_token`; o refresh exige token com pelo menos 24h e validade de 60 dias).

## Evidências da auditoria
- **Token:**
  - só existe em `IG_ACCESS_TOKEN`, lido uma vez no import (`graph.ts:54`);
  - `InstagramAccount.accessTokenEnc` e `tokenExpiresAt` existem no schema (`schema.prisma:36-37`), mas nunca são usados.
- **`renewMetaToken`** (`ajustes/actions.ts:79-95`) obtém um token novo e **descarta**. Não há cron, e o token morre em 60 dias.
- **Refresh:** coloca `access_token` na query string (`graph.ts:~305,452`), o que pode vazar em logs.
- **DELAY:** grava `WAITING_DELAY` e `resumeAt` (`runner.ts:370-384`), e nada retoma. Não existe `vercel.json` nem `/api/cron`. No plano Hobby da Vercel, o cron roda só 1 vez por dia.
- **Sem retenção:** `Message`, `FlowRun` e o `payload` (que contém dados pessoais) crescem sem limite.

## Tarefas
1. **Criptografia** (`src/lib/crypto/tokens.ts`):
   - AES-256-GCM com chave `TOKEN_ENCRYPTION_KEY` (32 bytes em base64, validada no `env.ts`) e campo de versão da chave;
   - funções `encryptToken`/`decryptToken`;
   - nunca logar o token.
2. **Persistência:**
   - salvar `accessTokenEnc`, `tokenExpiresAt` e `tokenStatus` (ACTIVE, EXPIRING, EXPIRED, REVOKED) por conta;
   - o cliente Graph obtém o token pela conta (decifra sob demanda);
   - migração única: importar o `IG_ACCESS_TOKEN` atual do ambiente para o banco e depois deixar de ler do ambiente.
3. **Renovação:**
   - job diário que renova os tokens que expiram em menos de 10 dias (e têm mais de 24h);
   - grava o token novo e a nova validade;
   - em falha: `EXPIRING` ou `EXPIRED` + alerta (Sentry) + banner em Ajustes e no Painel ("Reconecte seu Instagram");
   - o botão "Renovar agora" em Ajustes usa a mesma função e **persiste** o token.
4. **Agendador de DELAY:**
   - usar a fila durável escolhida no item 4 (mensagem atrasada, `sleep` ou agendamento por run);
   - na hora: reivindicação atômica (`WAITING_DELAY → RUNNING`);
   - checar a janela de 24h **no momento de retomar**; se fechada, marcar `SKIPPED_WINDOW` com motivo;
   - idempotente contra execução dupla;
   - **plano B** se não houver fila: cron a cada minuto (exige Vercel Pro) para `resumeAt <= now`, com o mesmo bloqueio atômico.
5. **Rotas de cron:**
   - `src/app/api/cron/*` protegidas por `CRON_SECRET` (cabeçalho `Authorization: Bearer`);
   - `vercel.json` com os horários.
6. **Retenção (LGPD):**
   - job que apaga ou anonimiza mensagens mais antigas que N dias (configurável; padrão a combinar com o dono);
   - limpa os `FlowRun` finalizados;
   - limpa os `WebhookEvent` processados.
7. **Health check:** `/api/health` (privado ou com segredo) checa o banco e a validade do token de cada conta; o monitor de uptime (item 6) usa essa rota.

## Arquivos que este item possui
`src/lib/crypto/*`, `src/lib/meta/token.ts` (novo), o trecho de token de `src/lib/meta/graph.ts`, `src/app/ajustes/actions.ts` (renovar), `src/app/api/cron/*`, `src/app/api/health/*`, `vercel.json`, a parte de schema de token e status (envie ao orquestrador) e o agendamento do DELAY no `runner.ts` (coordene com o item 4).

## Agentes e skills
- **Agentes:** `security-reviewer` (criptografia e cron), `database-reviewer`, `typescript-reviewer`, `silent-failure-hunter`, `tdd-guide`, `code-reviewer`.
- **Skills:** `secrets-management`, `security-review`, `upstash-qstash` / `inngest` / `trigger-dev`, `vercel-deployment`, `privacy-by-design`, `tdd-workflow`.

## Testes
- **Criptografia:** ida e volta; texto cifrado adulterado → erro; chave errada → erro; versão da chave respeitada.
- **Renovação** (`fetch` simulado):
  - token com 5 dias restantes → renovado e persistido;
  - token com menos de 24h → não renova;
  - erro 190 → EXPIRED + alerta;
  - o token não aparece em nenhum log (capturar os logs no teste).
- **DELAY:**
  - retoma na hora certa (relógio falso);
  - duas execuções simultâneas → só uma processa;
  - janela fechada → SKIPPED_WINDOW, sem envio.
- **Cron:** sem `CRON_SECRET` → 401; com o segredo → executa.
- **Retenção:** apaga só o que passou do prazo.
- **Navegador:** Ajustes mostra o status e a validade do token; o banner de reconexão aparece quando o token está EXPIRED (simulado no banco de teste).
- **Real:** renovação manual com a conta de teste → a nova validade aparece em Ajustes.

## Critérios de aceite
- [ ] Nenhum token em texto puro no banco, nos logs ou no ambiente de produção (depois da migração).
- [ ] Renovação automática testada; expiração gera alerta visível.
- [ ] Um fluxo com DELAY retoma de verdade (evidência com a conta de teste, usando um atraso curto).
- [ ] Crons protegidos e agendados; retenção configurada.
- [ ] `PRD_TRACEABILITY.md` (REQ-002) atualizado; NANO-033 concluída.
