# Builder simples ("automação rápida"), explicado

O builder simples é o equivalente ao **easy builder** do ManyChat. Em vez de montar caixinhas, você preenche uma receita pronta em frases. Ela cobre o caso mais usado:

> Alguém comenta a palavra-chave → recebe uma DM com botão → (se não segue, é pedido pra seguir) → recebe o link → (se não abrir o link) recebe um lembrete.

Em `/fluxos`, clique em **Automação rápida**. O exemplo "[2026] Casamento por DM automático" (criado pelo `npx prisma db seed`) usa os textos dos seus prints.

## A tela

**Esquerda: a receita**, em quatro partes:

| Parte | O que você configura | Limite |
| --- | --- | --- |
| Quando alguém faz um comentário | Qualquer publicação ou Reel, ou uma específica | — |
| E esse comentário possui | Palavras-chave; resposta pública no comentário (liga/desliga) | até **15** palavras e **5** respostas (o sistema sorteia uma) |
| Eles receberão | Mensagem de boas-vindas com botão; "pedir pra seguir antes do link" (liga/desliga) | botão com até **20** caracteres |
| E então, eles vão receber | DM com o link (texto, botão e endereço); lembrete se o link não for aberto (liga/desliga e tempo) | texto com até **1000** caracteres |

**Direita, em duas abas:**
- **Visualização:** um celular mostrando a conversa como o contato vai ver. Ela muda na hora quando você liga ou desliga uma opção.
- **Insights:** Envios, Cliques no link, CTR e E-mails. Por enquanto mostram "—", porque os números só existem quando o motor estiver rodando (Etapa 3).

O salvamento é automático, igual ao do editor avançado.

## Por baixo: a receita vira caixinhas

Cada vez que você salva, o sistema transforma a receita em caixinhas normais. Assim o motor da Etapa 3 só precisa saber rodar caixinhas, seja a automação rápida ou avançada.

```
GATILHO (comentário + palavras + respostas públicas)
  → BOAS-VINDAS [botão]
      → SEGUE O PERFIL?
          sim → DM COM O LINK
          não → "SIGA O PERFIL" [JÁ SEGUI] → (já segue) → DM COM O LINK
  DM COM O LINK → ESPERA (ex.: 1 hora) → ABRIU O LINK?
      não → LEMBRETE [mesmo link]
```

- Com "pedir pra seguir" desligado, o botão da boas-vindas leva direto pro link.
- Com o lembrete desligado, o fluxo termina no link.
- As caixinhas geradas têm **ids fixos**. Editar o texto não "quebra" quem já está no meio da conversa.
- O botão **Abrir no builder avançado** mostra essas mesmas caixinhas no canvas, pra você personalizar à vontade. É **só de ida**: depois disso, o fluxo passa a ser editado só no avançado.

## Limites que você precisa saber

- **Botão com até 20 caracteres.** "QUERO SABER COMO PARTICIPAR", do seu ManyChat, tem 27. O Instagram corta ou recusa botões fixos acima de 20. No exemplo usei "QUERO PARTICIPAR". A tela não deixa passar de 20 e mostra o contador.
- **Lembrete em até 23 horas.** O Instagram só deixa mandar DM até 24h depois da última mensagem do contato. A tela avisa se você colocar mais.
- **"Abriu o link?"** Pra saber se a pessoa abriu o link, o botão não pode apontar direto pro WhatsApp. Ele precisa passar antes por um endereço nosso, que conta o clique e redireciona. Isso entra junto com o motor (Etapa 3). Até lá, o lembrete fica configurado, mas ainda não dispara.
- **"Uma DM pedindo o e-mail"** (a opção desligada nos seus prints) ainda não existe. Ela precisa de uma caixinha nova, que espera a resposta, confere se é um e-mail e guarda no contato. Fica pra depois da Etapa 3.

## Onde está o código

| Arquivo | O que faz |
| --- | --- |
| `src/lib/flow/recipe.ts` | A receita: formato, limites, avisos e o "compilador" `compileRecipe` que gera as caixinhas |
| `src/lib/flow/recipe.test.ts` | Testes da receita (`npm test`) |
| `src/components/simple-builder/` | A tela (`SimpleBuilder`) e a prévia da conversa (`DmPreview`) |
| `src/components/ui/` | Campos e salvamento automático usados pelos dois editores |
| `src/app/fluxos/actions.ts` | `saveRecipe`, `createFlow` (rápida ou avançada) e `convertToAdvanced` |
| `prisma/migrations/*_simple_builder` | `Flow.recipe` e as respostas públicas múltiplas (`Trigger.publicReplies`) |
