# Item 3 — Execução parcial em 2026-10-10

Status: PARCIAL / BLOQUEADO. Não está pronto para produção.

## Autorização e escopo
O usuário pediu executar `docs/prompts-execucao/03-api-meta-instagram-login.md`.
Branch criada: `item-03-meta-instagram-login`. Alterações preexistentes foram preservadas; não houve commit de checkpoint de todo o workspace nem merge.

## Alterações desta execução
- `src/lib/engine/matcher.ts`: comparação por palavras completas, normalização de pontuação/acentos/emoji/caracteres invisíveis, lista vazia não ativa CONTAINS/EXACT; mídia ausente não satisfaz gatilho de post específico.
- `src/lib/meta/webhook.ts`: parsing com Zod, rejeição de remetente ausente, ecos e destinatário divergente; entrada inválida não elimina outras entradas válidas; assinatura HMAC estrita mesmo em desenvolvimento; token de verificação vazio recusado pela função utilitária.
- `src/lib/meta/window.ts`: datas futuras/inválidas não abrem janela; comentário da função corrigido (comentário público não abre janela).
- `src/lib/flow/schema.ts` e `lint.ts`: DELAY entre 1 segundo e 23 horas.
- `src/lib/engine/meta-contract.test.ts`: 15 testes de regressão.

A rota ainda usa token padrão, a conta global e processamento síncrono. A alteração do utilitário HMAC não resolve esses problemas da rota. A função de janela ainda precisa ser aplicada em todos os envios do motor; `contacts.ts` ainda atualiza `lastInboundAt` em comentários. Não houve migração de API, private reply ou mudança de PRD nesta etapa.

## Evidências
- TDD inicial: 10 falhas e 3 aprovações nos primeiros 13 casos, antes das correções.
- `npx vitest run src/lib/engine/meta-contract.test.ts src/lib/engine/engine.test.ts src/lib/flow/flow.test.ts`: 3 arquivos, 50 testes aprovados (inclui controles positivos preexistentes de HMAC, comentário, DM e postback).
- ESLint de webhook.ts, window.ts, schema.ts, lint.ts e meta-contract.test.ts: aprovado.
- ESLint de matcher.ts: 3 erros preexistentes de `any` permanecem; arquivo não atende ao gate global.
- `npx tsc --noEmit`: falhou em `src/lib/auth/requireAuth.test.ts`, que referencia módulo `./requireAuth` ausente no instante da execução.
- `npm test` numa cópia isolada em `/tmp/fluxo-item03-verification` (sem copiar .env ou .data): 101 aprovados, 9 falhas, 2 suítes não carregadas; 4 arquivos de teste falharam e 6 passaram. A cópia evita que store.test.ts grave no .data do usuário.
- Falhas da cópia: 5 testes preexistentes de graph.test.ts; 4 testes de webhook.test.ts surgidos durante esta execução; módulos requireAuth e csp ausentes nas duas suítes sem carregamento. O workspace estava recebendo arquivos de outro trabalho, portanto a cópia representa apenas aquele instante.
- Build, QA de Ajustes, Postgres e teste real Meta não executados; nenhum envio real ou migration realizado.

## Revisão independente
Agente `meta_research`: pesquisa oficial e revisão das alterações em comparação com snapshots anteriores, salvos em `/tmp/fluxo-item03-before`.
Achado P2: um entry inválido descartava o lote. Corrigido com validação por entry e teste de lote misto. Teste de mediaId ausente também adicionado. Sem revisão final do programa completo.

## Pesquisa
A coleção oficial da Meta confirma Instagram Login sem Página do Facebook, escopos instagram_business_basic/manage_messages/manage_comments e envio em graph.instagram.com/{version}/{ig-account-id}/messages:
https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00
Templates (até 3 botões): https://www.postman.com/meta/instagram/folder/rl2amj3/templates
Os seis links developers.facebook.com do prompt retornaram HTTP 429 ao pesquisador. Versão estável mais recente, templates em private replies e limites de 640 caracteres/1000 bytes não foram confirmados em documentação acessível nesta execução.

## Bloqueios e trabalho restante
1. Confirmação explícita de Instagram Login pendente. O próprio prompt exige confirmar a escolha antes de alterar o contrato Facebook Login do PRD.
2. Item 2 não está concluído no código observado: fallback local permanece no motor/contatos/matcher. O modelo TrackedLink exigido do Item 1 não existe no schema observado.
3. Banco de teste, conta profissional de teste, testers e app Meta em Desenvolvimento ainda não foram identificados pelo dono. Não pedir valores secretos no chat.
4. Outro trabalho escreve no mesmo diretório: surgiram auth, security e webhook.test.ts durante a execução. Coordenar propriedade de webhook.ts e das rotas antes de prosseguir.
5. Restam: Graph único e por conta, private reply, limites dos templates, erros tipados, EXPIRED, roteamento de conta, contexto e pausas do motor, lastInboundAt, postbacks codificados, links/cliques, cooldown e persistência de negativas, testes por nó, documentação definitiva e homologação real.
6. Nenhum critério global de aceite foi declarado concluído; manter REQ-001 e REQ-009 a REQ-018 sob revisão até validação completa. As marcações históricas IMPLEMENTED não comprovam funcionamento de ponta a ponta.
