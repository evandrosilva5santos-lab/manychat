# Etapa 1 — O banco de dados, explicado

O banco é onde o Fluxo guarda tudo: quem conversou com você, quais automações existem, como cada uma está desenhada e o que já foi dito. Pense numa planilha gigante com várias abas; cada aba é uma **tabela**. O arquivo que descreve essas abas é o `prisma/schema.prisma`. O **Prisma** lê esse arquivo e cria as tabelas no PostgreSQL pra você. Ele também dá ao código um jeito seguro de ler e gravar os dados.

## O mapa

```
InstagramAccount ─┬─ Contact ──┬── ContactTag ── Tag
                  │            ├── Message (histórico)
                  │            └── FlowRun (em que ponto do fluxo a pessoa está)
                  ├─ Flow ─────┬── Trigger (o que faz começar)
                  │            ├── Node (caixinhas) ── CarouselCard ── CatalogItem
                  │            └── Edge (linhas entre caixinhas)
                  └─ CatalogItem (cards reutilizáveis)
```

Todas as tabelas "penduram" numa **InstagramAccount**. Hoje você tem uma conta só. Se a agência atender vários perfis depois, os dados de um cliente não se misturam com os de outro.

## As tabelas pedidas no prompt

| Tabela | O que é | Liga com |
| --- | --- | --- |
| **Contact** | A pessoa que comentou, mandou DM ou clicou. Guarda o IGSID, que é o ID que o Instagram dá pra ela *dentro da sua conta*. Também guarda @, nome, foto, se segue o perfil e quando falou com você pela última vez. | Etiquetas, mensagens, execuções. "Entrou por" = o fluxo que trouxe a pessoa. |
| **Tag** | A etiqueta ("lead-quente", "já-comprou"). | Contatos, pela tabela **ContactTag**. Um contato tem várias etiquetas e uma etiqueta está em vários contatos. A ContactTag também anota *quando* e *qual fluxo* colocou a etiqueta. |
| **Flow** | A automação: nome, pasta, status (Rascunho / Ao vivo / Parado), modo (builder simples ou avançado) e o zoom da tela do editor. | Tem caixinhas, linhas, gatilhos, execuções e mensagens. |
| **Node** | Uma caixinha do editor. O `type` diz o que ela faz: MESSAGE, QUESTION (com botões), CONDITION, DELAY, ADD_TAG, CAROUSEL, FOLLOW_GATE ("confirme que segue" + DESBLOQUEAR) e NOTE (anotação). O conteúdo de cada tipo fica em `data` (em formato JSON), então dá pra criar tipos novos sem mudar o banco. Também guarda a posição x/y na tela. | Pertence a um Flow. Linhas saem e chegam nela. |
| **Edge** | A linha que liga uma caixinha à próxima. O `sourceHandle` diz **de qual saída** ela sai: o botão clicado, o card do carrossel, "yes"/"no" na condição ou "unlock" no DESBLOQUEAR. É assim que cada botão leva a um caminho diferente. | Liga dois Nodes do mesmo Flow. |
| **Trigger** | O que faz o fluxo começar: palavra-chave em **comentário**, em **DM**, em **resposta de story**, ou **clique em botão**. Pode valer pra qualquer post ou só pra um (`mediaId`). Pode responder o comentário em público ("Te mandei no direct!"). Também diz em qual caixinha o fluxo começa. | Pertence a um Flow e aponta pra um Node. |
| **Message** | O histórico: cada coisa que entrou (IN) ou saiu (OUT). O `kind` diz o tipo: texto, botões, carrossel, clique, comentário, resposta de story. O `igMessageId` é único, então se a Meta mandar o mesmo evento 2 vezes, ele não é gravado duplicado. | Contato e, quando saiu de uma automação, o fluxo/caixinha que mandou. |
| **CatalogItem** | Um card do catálogo: imagem, título, descrição e botão. O botão pode ser um link externo ou o próximo passo do fluxo. Você edita num lugar só e todo carrossel que usa o card é atualizado. | É usado pelos carrosséis através de **CarouselCard**. |

## Duas tabelas de apoio (e por quê)

- **CarouselCard**: diz qual card aparece em qual carrossel e em que ordem. É ela que faz o card ser *reutilizado* em vez de copiado. Um card que está em uso **não pode ser apagado** (o banco bloqueia). Assim nenhum fluxo fica com carrossel quebrado.
- **FlowRun**: uma "passada" de um contato por um fluxo. O motor (Etapa 3) precisa lembrar **onde a pessoa parou**: esperando 10 minutos (`resumeAt`) ou esperando ela clicar num botão. Sem isso, cada espera ou clique recomeçaria o fluxo do zero.

## Limites do Instagram que já estão no desenho

Estes limites vêm da própria API da Meta. O banco já foi pensado em volta deles:

| Limite | Consequência | Alternativa |
| --- | --- | --- |
| **Máx. 3 botões por mensagem** | QUESTION aceita no máximo 3 botões. | Precisa de mais opções? Use um carrossel (até 10 cards, cada um com seu botão) ou encadeie duas perguntas. |
| **Máx. 10 cards por carrossel** | CarouselCard limitado a 10 por caixinha (a tela vai validar). | Divida em dois carrosséis. |
| **Título e descrição do card: 80 caracteres**; rótulo do botão: curto (≈20) | Campos do CatalogItem. | Texto longo vai numa mensagem antes do carrossel. |
| **Botões sempre fixos** (button template / generic template), **nunca quick reply** | Por isso não existe tipo "quick reply" no banco. | — |
| **Janela de 24 horas**: você só pode mandar DM até 24h depois da última mensagem *da pessoa* | `Contact.lastInboundAt` guarda isso; o motor não manda nada fora da janela. | Uma Espera longa (ex.: 2 dias) não vai conseguir mandar. Mantenha as esperas curtas ou peça um clique antes, porque o clique reabre a janela. |
| **Resposta privada a comentário**: 1 DM por comentário, em até 7 dias | O gatilho de comentário manda a 1ª mensagem como resposta privada. Depois que a pessoa responde ou clica, a conversa segue normal. | — |
| **Não existe aviso de "novo seguidor"** na API | O banco não tem gatilho "novo seguidor". | A tela "Cumprimente novos seguidores" vai precisar de outra estratégia (ex.: DM quando a pessoa interage pela 1ª vez). Vamos decidir isso na Etapa 3. |
| **"Segue o perfil?"** vem do perfil do usuário na API (`is_user_follow_business`) | `Contact.followsAccount` (null = ainda não consultado). | — |

## Como testar

```bash
cp .env.example .env              # coloque a DATABASE_URL e DIRECT_URL do Supabase
npm install
npx prisma migrate dev            # cria as tabelas
npx prisma db seed                # cria o fluxo de exemplo "Captação story Astrix"
npx prisma studio                 # abre uma tela pra ver as tabelas no navegador
```

O seed (`prisma/seed.ts`) monta o fluxo desenhado em `design/Fluxo.dc.html`: gatilho de story "EU QUERO" → "confirme que segue" (DESBLOQUEAR) → condição "Segue o perfil?" → sim: carrossel com 3 cards do catálogo → etiqueta `lead-quente`; não: espera 10 minutos e pede de novo.
