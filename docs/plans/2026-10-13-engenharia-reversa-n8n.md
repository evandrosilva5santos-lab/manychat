# Engenharia reversa — fluxos n8n do Instagram → instachat

> **Data:** 13/10/2026 · **Status:** análise concluída; implementação aguardando escolha do dono (seção 6).
> **Fontes analisadas** (arquivos do dono em `~/Downloads`, lidos como dados):
> `01- InstaFluxo - Configuração + Forms - alunos.json` (10 nós) · `01 - Fluxo V3.json` (31) · `02 - Follow-up.json` (23) · `🙎♂️ [Template V2] - Agente de IA no IG.json` (92).

> ⚠️ **Segurança:** o arquivo do *Agente de IA* contém um **token real do Instagram** no nó `Edit Fields1` (campo `token`). Se o JSON foi compartilhado, revogue o token (reconectar o perfil gera outro).

---

## 1. O que cada fluxo faz

### 1.1 Configuração + Formulário (`InstaFluxo`)
`GET /webhook/instafluxo-process` devolve uma página HTML (Tailwind) com um formulário; o `POST` salva uma linha em `palavras_chaves_ig`:

| Campo do formulário | Coluna | Uso no fluxo principal |
| :--- | :--- | :--- |
| Palavras-chave | `palavras` | gatilho (comentário e DM) |
| Mensagem do Direct | `mensagem_direct` | texto do template com botão |
| Resposta ao comentário | `resposta_comentario` | resposta pública |
| Link do botão | `link_botao` | URL do botão "CLIQUE PARA ACESSAR 🟢" |

### 1.2 Fluxo principal (`01 - Fluxo V3`)
```
Webhook (GET) ──► devolve hub.challenge (verificação da Meta)
Webhook (POST) ─► extrai campos ─► lê TODAS as palavras-chave ─► Switch
   ├─ field = "comments"
   │    └─ ignora comentário do próprio perfil (from.id ≠ entry.id)
   │       └─ comentário == palavra (igualdade, minúsculas)
   │            ├─ responde o comentário (resposta_comentario)
   │            ├─ private reply (recipient.comment_id): "Clique no botão abaixo…"
   │            │    com quick_reply = a própria palavra  ← faz a pessoa "falar" e abrir a janela
   │            └─ grava/atualiza lead: enviou_direct = true, ultimaatividade = agora
   └─ messaging[0].sender.id existe (DM)
        └─ texto == palavra
             └─ GET /{igsid} (is_user_follow_business)
                  ├─ segue  ─► template com botão web_url (link_botao) ─► lead.enviou_material = true
                  └─ não segue ─► template "Primeiro precisa me seguir…" + botão para o perfil
                                  (a pessoa digita a palavra de novo depois de seguir)
```

### 1.3 Follow-up (`02 - Follow-up`)
Dois agendamentos sobre a tabela `followup_clientes`:

| Agendamento | Quem recebe | Mensagem | Marca |
| :--- | :--- | :--- | :--- |
| a cada 30 min | `enviou_direct` e **não** `enviou_material`, sem follow-up 1/2, última atividade há > 30 min | "Conseguiu ver o Material?" | `Follow-up 1` |
| a cada 1 h | `enviou_material`, sem `Follow-up 2`, última atividade há > 30 min | "Curtiu o material? 🔥" | `Follow-up 2` |

Envio item a item com espera entre eles (laço + `Wait`).

### 1.4 Agente de IA (`Template V2`)
```
POST ─► extrai campos ─► Switch (comentário | DM)
  COMENTÁRIO (exceto do próprio perfil)
    ├─ é palavra-chave (regex exata: Imagem, Instagram, Facebook, Flow…)
    │    └─ responde comentário + private reply "Digite 'X' aqui embaixo…"
    └─ NÃO é palavra-chave ─► vai para a IA (resposta PÚBLICA gerada pela IA)
  DM (exceto do próprio perfil)
    ├─ é palavra-chave ─► checa se segue ─► link do material (WhatsApp, YouTube, Kiwify…) | pedir para seguir
    └─ NÃO é palavra-chave ─► entrada da IA:
         texto ─────────────┐
         áudio ─► baixa ─► transcreve (OpenAI) ─┤
                                                ▼
         BUFFER (Redis, chave = usuário): empilha, espera 8 s,
         só continua se a última mensagem da lista é a desta execução
         (= a pessoa parou de digitar) ─► junta tudo ─► apaga a lista
                                                ▼
         Agente (gpt-4.1-mini) + memória Postgres (10 últimas, por usuário)
         prompt: papel, tom, objetivos, regras ("uma pergunta por vez", "sem emoji"),
                 dados da empresa (nome, horário, endereço, valores, diferenciais)
                                                ▼
         comentário ─► responde o comentário com a saída da IA
         DM ─► 2º LLM divide em mensagens curtas (JSON {messages:[…]}, > 300 chars quebra)
               ─► envia uma a uma com 2 s entre elas
```
Também cria (mas **não usa**) uma base vetorial (`documents` + `match_documents`, embeddings 1536) — RAG preparado e não ligado.

---

## 2. A lógica de negócio, sem o n8n

1. **Gatilho por palavra** em comentário ou DM, ignorando o próprio perfil.
2. **Resposta pública** no comentário + **private reply** no Direct.
3. **Abrir a janela de 24 h**: a primeira DM só pode ser a private reply; para conversar depois, a pessoa precisa interagir (o n8n pede para ela *digitar a palavra*).
4. **Portão de seguidor** (`is_user_follow_business`): segue → material; não segue → pedido para seguir e tentar de novo.
5. **Entrega do material** por botão com link.
6. **Estado do lead** (`enviou_direct`, `enviou_material`, `ultimaatividade`) para **follow-ups** temporizados.
7. **IA** para tudo o que não é palavra-chave, com *debounce* de mensagens, áudio → texto, memória curta e respostas fatiadas.

---

## 3. Mapa n8n → instachat

| Capacidade do n8n | No instachat hoje | Situação |
| :--- | :--- | :--- |
| Formulário de configuração (palavra, mensagem, resposta, link) | Automação rápida (construtor) com prévia do celular | ✅ **Melhor** (vários botões, variações de resposta, post específico) |
| Verificação do webhook (`hub.challenge`) | `GET /api/webhook/instagram` | ✅ |
| Validação de assinatura HMAC | Sim, falha fechada | ✅ (n8n **não valida**) |
| Ignorar o próprio perfil | Sim | ✅ |
| Palavra-chave em comentário/DM | `COMMENT_KEYWORD`/`DM_KEYWORD` com `EXACT`/`CONTAINS`/`ANY`, sem acento, palavras negativas, prioridade, cooldown | ✅ **Melhor** |
| Resposta pública ao comentário | Com variações (anti-spam) | ✅ |
| Private reply (`recipient.comment_id`) | Sim, 1 por comentário, até 7 dias, deduplicada | ✅ |
| Abrir a janela | Botão *postback* ("QUERO SABER") na private reply — o clique abre a janela | ✅ **Melhor** (n8n usa `quick_replies`, que o ADR-003 proíbe, ou "digite a palavra") |
| Portão de seguidor | `FOLLOW_GATE` + condição `follows` (`is_user_follow_business`) | ✅ |
| Link do material com botão | Botão `web_url` com **link rastreado** (`/api/l/[code]`) | ✅ **Melhor** (sabe se clicou) |
| Estado do lead | `Contact`, `FlowRun`, `Message`, `TrackedLink`, etiquetas | ✅ (mais completo; flags derivam dos dados) |
| Follow-up "não pegou o material" | Lembrete da receita: só "não clicou no link" após X | 🟡 **Parcial** — falta "não passou do portão / parou no meio" |
| Follow-up "curtiu o material?" | — | ❌ **Falta** |
| Envio em lote com pausa | Fila com *backoff* | ✅ |
| Respeitar janela de 24 h nos follow-ups | Motor bloqueia fora da janela | ✅ (n8n **ignora** e toma erro da Meta) |
| Opt-out ("PARAR") | Sim | ✅ (n8n não tem) |
| DM de **áudio / imagem** | **Descartada** no `parseInstagramWebhookPayload` (só texto) | ❌ **Falta** — nem registra, nem abre a janela |
| Agente de IA (DM e comentário) | Página `/ai` "Em breve"; PRD exclui IA generativa do MVP | ❌ **Falta** (decisão de escopo) |
| Buffer de mensagens (8 s) | — | ❌ (parte da IA) |
| Memória de conversa | Histórico `Message` por contato já existe | 🟡 base pronta |
| Base de conhecimento (RAG) | — | ❌ (o n8n também não usa) |
| Fatiar resposta longa em várias DMs | — | ❌ (parte da IA) |
| Multi-perfil e multiempresa | Sim (workspaces) | ✅ (n8n: um token fixo por fluxo) |

---

## 4. O que **não** copiar do n8n

| Problema no n8n | Risco | No instachat |
| :--- | :--- | :--- |
| Token fixo no nó (e um real exportado no JSON) | Vazamento de acesso | Token criptografado por perfil |
| Sem validação de assinatura | Qualquer um dispara envios | HMAC obrigatório |
| Sem idempotência | Reentrega da Meta = DM duplicada | Fila idempotente |
| `quick_replies` | Somem da tela (ADR-003) | Só *button template* |
| JSON montado por interpolação (`"text": "{{ $json.output }}"`) | Aspas/quebras da IA quebram o envio | Corpo serializado |
| Regex de lookahead negativo repetida em 3 `switch` | Palavra nova esquecida num deles | Gatilhos no banco, um lugar só |
| Follow-up sem janela de 24 h nem opt-out | Erro da Meta / reclamação | Motor checa os dois |
| Versões da Graph misturadas (v19, v23, v25) | Quebra em datas diferentes | Uma versão central |
| IA respondendo **comentário público** sem revisão | Resposta errada visível para todos | Desligado por padrão (ver P4) |
| Botões "apagar tudo" (`delete from …`) | Perda total de dados | Exclusão por perfil/contato com confirmação |
| Prompt fala de "WhatsApp" e "ajudar a ouvir melhor" | Template copiado sem revisar | Prompt por perfil, editável |

---

## 5. Plano de implementação (pacotes)

### P1 — Mídia no Direct (áudio, imagem, vídeo) · pequeno · sem dependência
- `src/lib/meta/webhook.ts`: aceitar `message.attachments[]` sem `text`; evento `message` com `attachments: {type, url}[]` e `text` vazio.
- `worker`: registrar `Message` (`kind` = `AUDIO`/`IMAGE`/`VIDEO`/`FILE`, `payload` com as URLs); `lastInboundAt` atualiza (abre a janela). Gatilhos `DM_KEYWORD` continuam só com texto.
- `Conversas`: mostrar o anexo (player de áudio / miniatura).
- Testes: payload real de áudio, imagem, figurinha; dedup por `mid`.
- Schema: só novos valores em `MessageKind` (migration aditiva).

### P2 — Follow-ups por etapa do funil · médio · depende do agendador (QStash) para atrasos de 30 min
Na receita (construtor rápido), duas opções novas, desligadas por padrão:
1. **"Não terminou"**: se a pessoa recebeu a DM mas não chegou ao link em X min → mensagem (ex.: "Conseguiu ver o material?"), com o botão do passo onde parou.
2. **"Depois da entrega"**: X min depois de clicar no link → mensagem (ex.: "Curtiu o material? 🔥").
- Compila em `DELAY` + `CONDITION` (`link_clicked` / novo `reached_node`) + `MESSAGE`, reaproveitando o motor.
- Sempre dentro da janela de 24 h e nunca para quem fez opt-out (o motor já garante).
- **Atenção:** com só o cron diário, um atraso de 30 min pode virar horas. Ative o QStash (`docs/agendador-qstash.md`) antes.

### P3 — Visão de funil e palavras-chave · pequeno
- Página "Palavras-chave": todas as palavras de todas as automações do perfil, com conflitos (mesma palavra em duas automações) — o que o switch manual do n8n tenta resolver.
- Em Contatos, coluna "Etapa" derivada: *Recebeu DM* → *Passou do portão* → *Clicou no link* → *Follow-up enviado* (substitui as flags `enviou_direct`/`enviou_material`).

### P4 — Agente de IA no Direct · grande · **depende de decisões do dono**
Arquitetura proposta (sem Redis, usando o que já existe):
- **Quando roda:** DM que não casou com nenhum gatilho e sem execução esperando resposta; perfil com IA ligada; contato sem opt-out; dentro da janela.
- **Buffer:** grava a mensagem e agenda uma tarefa para `agora + 8 s` na fila do Postgres; ao rodar, só responde se não chegou mensagem mais nova do mesmo contato (mesma lógica do Redis, durável).
- **Áudio:** depende do P1; transcrição antes de ir para o modelo.
- **Contexto:** últimas N mensagens do histórico `Message` (não precisa de tabela de memória separada).
- **Configuração por perfil (página `/ai`):** nome do agente, tom, regras, dados da empresa, quando passar para humano; botão "pausar IA para este contato" em Conversas.
- **Saída:** resposta estruturada `{ messages: string[] }` em uma chamada (dispensa o 2º LLM), cada uma ≤ 1.000 caracteres, enviadas com 2 s de intervalo.
- **Comentários:** IA respondendo em público fica **desligada por padrão**.
- **Base de conhecimento (RAG):** fase 2, só se o texto da empresa não couber no prompt.
- **Limites:** teto de mensagens de IA por contato/dia e por perfil/mês; registro de custo.

---

## 6. Decisões do dono

| # | Decisão | Por quê | Sugestão |
| :--- | :--- | :--- | :--- |
| 1 | Ordem dos pacotes | — | P1 → P2 → P3 → P4 |
| 2 | Tirar a IA da lista "fora do escopo" do PRD (ISSUE-009) | `PRD.md` §4 e REG-SCOPE-001 proíbem IA generativa no MVP | Publicar PRD v1.1 com a IA como módulo opcional |
| 3 | Provedor do modelo e de transcrição (OpenAI como no n8n, Anthropic Claude, outro) e quem paga a chave | Custo e contrato | Decidir antes do P4 |
| 4 | IA pode responder comentários em público? | Risco de imagem | Não, no começo |
| 5 | Ativar o QStash | P2 precisa de atrasos de minutos | Sim, antes do P2 |
