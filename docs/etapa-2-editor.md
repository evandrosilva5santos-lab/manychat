# Etapa 2 — O editor visual, explicado

Agora dá pra montar um fluxo **arrastando caixinhas** e ligando uma na outra com linhas, sem programar. Tudo é salvo sozinho, e quando você reabre o fluxo ele volta igualzinho.

Abra `http://localhost:3000/fluxos`. Clique em **Novo fluxo** ou abra o fluxo de exemplo "Captação story Astrix".

## As três áreas da tela

| Área | O que faz |
| --- | --- |
| **Esquerda: paleta** | As caixinhas disponíveis. Arraste uma para o canvas, ou clique para ela aparecer ao lado da caixinha selecionada. |
| **Meio: canvas** | Onde o fluxo é desenhado. Dá pra arrastar o fundo pra se mover e usar a roda do mouse (ou os botões + e −) pra dar zoom. No canto, um minimapa mostra o fluxo inteiro. |
| **Direita: painel** | Clique numa caixinha e o conteúdo dela aparece aqui pra editar. Sem nada selecionado, o painel mostra um passo a passo rápido. |

## Três palavras que o React Flow usa

- **Nó (node)**: cada caixinha. No banco, é uma linha da tabela `Node`.
- **Linha (edge)**: a ligação entre duas caixinhas. É uma linha da tabela `Edge`.
- **Bolinha (handle)**: os pontos de encaixe. A bolinha da **esquerda** é a entrada; as da **direita** são as saídas. Pra ligar, puxe uma bolinha da direita até a bolinha da esquerda de outra caixinha.

## Por que cada botão tem sua própria bolinha

Numa "Pergunta com botões", cada botão leva a um caminho diferente. Tocou em "EMPRESA", vai pra um lado; tocou em "CARREIRA", vai pra outro. Por isso cada botão é uma **saída própria**. O mesmo vale para:

- **Condição**: saída "Sim" e saída "Não".
- **Confirme que segue**: a saída do botão "DESBLOQUEAR".
- **Carrossel**: uma saída pra cada card cujo botão é "próximo passo do fluxo". Um card com link externo não tem saída, porque a pessoa sai do Instagram.

Cada saída aceita **uma linha só**. Se você ligar de novo, a linha antiga é trocada pela nova. Se você apagar um botão, a linha que saía dele some junto.

## O gatilho também é uma caixinha

A caixinha verde **Gatilho** diz *quando* o fluxo começa:
- comentário em post ou Reel;
- DM;
- resposta ao story;
- clique num botão.

Também diz com quais palavras-chave. A linha que sai dela aponta pra primeira caixinha do fluxo. No banco isso vira o campo `Trigger.startNodeId`, e não uma linha na tabela `Edge`. Um fluxo pode ter mais de um gatilho: por exemplo, um para comentário e outro para DM, levando à mesma mensagem.

Para o gatilho aparecer no lugar certo no canvas, a tabela `Trigger` ganhou `positionX` e `positionY`. Essa é a migração `trigger_position`.

## Como o salvamento funciona

1. Você mexe em algo: move uma caixinha, escreve, liga uma linha.
2. O editor espera 1 segundo sem mudanças e manda o fluxo inteiro pro servidor. É a função `saveFlow` em `src/app/fluxos/actions.ts`.
3. O servidor **confere tudo de novo**, com os limites do Instagram. Assim, mesmo que alguém burle a tela, nada inválido entra no banco.
4. Tudo é gravado de uma vez, numa *transação*: ou salva tudo, ou nada. No topo aparece "Salvando…" e depois "Salvo agora mesmo".

Só mudanças de verdade contam. Selecionar uma caixinha não gera salvamento. Mover o zoom você mesmo gera, porque o zoom é guardado pra reabrir do mesmo jeito.

## Limites do Instagram que a tela já impõe

| Limite | Na tela |
| --- | --- |
| Máx. **3 botões** por mensagem | "Botões (3 de 3)" e o botão "Adicionar botão" fica desativado |
| Rótulo do botão com até **20 caracteres** | Contador ao lado e o texto vira CAIXA ALTA sozinho |
| DM com até **1000 caracteres** | Contador embaixo do texto |
| Máx. **10 cards** por carrossel, sem repetir card | Contador "(n de 10)" e a lista esconde os cards já usados |
| Link do botão precisa ser **https://** | Aviso na caixinha |
| DM só até **24h** depois da última mensagem do contato | Aviso na caixinha de Espera |

Todo botão é **fixo** (button template), nunca "resposta rápida". Por isso ele continua visível mesmo depois que o lead manda outras mensagens.

## Avisos (o triângulo amarelo)

Se falta alguma coisa, a caixinha mostra um ⚠️. O topo mostra "N avisos". Exemplos: mensagem vazia, gatilho sem palavra-chave, gatilho sem ligação, etiqueta não escolhida.

Os avisos **não impedem salvar**, porque dá pra montar aos poucos. Na Etapa 6, o botão **Publicar** só vai funcionar com zero avisos.

## O que ainda não existe (e em que etapa chega)

- **Etapa 3:** o fluxo ainda não responde ninguém. Quem executa as caixinhas é o motor.
- **Etapa 5:** a tela pra criar e editar os cards do catálogo. Por enquanto, os cards vêm do `npx prisma db seed`.
- **Etapa 6:** login, Publicar/Pausar e lista completa de automações.
  - ⚠️ **Não coloque o site na internet antes da Etapa 6.** Sem login, qualquer pessoa com o link consegue editar os fluxos.

## Onde está o código

| Arquivo | O que faz |
| --- | --- |
| `src/lib/flow/types.ts` | O que cada caixinha guarda e os limites (`LIMITS`) |
| `src/lib/flow/nodes.ts` | Nome, cor e saídas de cada tipo de caixinha |
| `src/lib/flow/schema.ts` | A conferência que o servidor faz antes de salvar |
| `src/lib/flow/convert.ts` | Tradução banco ↔ editor |
| `src/lib/flow/lint.ts` | Os avisos |
| `src/components/flow-editor/` | A tela: `FlowEditor` (canvas), `StepNode` (caixinha), `Palette`, `Inspector` (painel) |
| `src/lib/flow/flow.test.ts` | Testes (`npm test`) |
