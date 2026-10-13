# Agendador — Upstash QStash chamando o `/tick`

> Decisão: BLK-006 (fila durável, sem Vercel Pro) + escolha do dono em 12/10/2026: **Upstash QStash**.

## Por que existe

O webhook da Meta processa os eventos com `after()`, que é "melhor esforço". Três coisas só andam quando alguém chama `GET/POST /api/webhook/instagram/tick`:

- eventos de webhook que ficaram na fila (`processDueEvents`);
- execuções paradas num nó **Esperar** cujo prazo venceu (`resumeDueDelays`);
- exclusões de dados em lotes que ficaram pela metade (`resumePendingDeletions`).

No plano Hobby a Vercel só roda cron uma vez por dia. O QStash chama a URL no intervalo que você escolher.

## Redes de segurança que já funcionam sem o QStash

- Cada webhook recebido também retoma esperas vencidas (`after()` no `POST /api/webhook/instagram`).
- O cron diário da Vercel chama o `/tick` às 06:30 UTC (`vercel.json`). Precisa do `CRON_SECRET` na Vercel; a Vercel envia o cabeçalho sozinha.

O QStash serve para as esperas curtas (minutos) andarem mesmo quando o perfil não recebe mensagens. É uma melhoria, não um requisito: sem ele, nenhuma espera fica parada mais de um dia.

> Conferido em 12/10/2026 (`vercel env ls`): `CRON_SECRET` já está cadastrado em Production. Os passos 1 e 2 abaixo já estão feitos; falta só criar a conta e o agendamento no QStash.

## O que o código já faz

- A rota é pública no proxy (prefixo `/api/webhook/`) e exige `Authorization: Bearer <CRON_SECRET>`.
- Sem `CRON_SECRET` em produção, responde **503** (não roda aberta).
- Cada chamada processa no máximo 10 eventos e 10 esperas (`?limit=` até 50) e responde `{ ok, events, delaysResumed, deletionsResumed }`.

## Passo a passo (dono)

1. **Gere o segredo** no seu computador:
   ```bash
   openssl rand -hex 32
   ```
2. **Cadastre na Vercel** (Production e Preview) como `CRON_SECRET` e faça um novo deploy.
3. **Crie a conta** em <https://console.upstash.com> › QStash. Copie o `QSTASH_TOKEN` e a URL da API exibida no console (contas novas usam um endereço regional).
4. **Crie o agendamento** (troque os três valores):
   ```bash
   curl -X POST "<URL_DA_API_QSTASH>/v2/schedules/https://instachat.startinc.com.br/api/webhook/instagram/tick" \
     -H "Authorization: Bearer <QSTASH_TOKEN>" \
     -H "Upstash-Cron: */3 * * * *" \
     -H "Upstash-Forward-Authorization: Bearer <CRON_SECRET>"
   ```
   O cabeçalho `Upstash-Forward-Authorization` chega na rota como `Authorization`.
5. **Confira** no console do QStash (aba Logs) que as chamadas voltam **200** com `"ok": true`.

## Intervalo e cota

- A cada 3 minutos são 480 chamadas por dia. Confira no console se isso cabe na cota diária do plano gratuito; se não couber, use `*/5 * * * *` (288/dia).
- Consequência do intervalo: um nó "Esperar 1 minuto" pode levar até o intervalo do agendador para continuar.

## Se parar de funcionar

| Sintoma no log do QStash | Causa |
| :--- | :--- |
| 401 | `CRON_SECRET` diferente entre Vercel e agendamento |
| 503 `CRON_SECRET não configurado` | variável ausente no ambiente ou deploy antigo |
| 401 com tela de senha | a rota deixou de ser pública em `src/lib/auth/basic.ts` |
