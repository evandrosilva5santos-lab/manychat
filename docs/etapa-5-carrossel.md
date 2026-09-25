# Etapa 5 — O Carrossel e Catálogo de Cards (Generic Template)

> **Resumo em português simples:**  
> Nesta etapa, construímos o envio de **Carrosséis interativos no Direct do Instagram** e uma central de **Catálogo de Cards Reutilizáveis**.  
> Em vez de desenhar cards soltos que se perdem em cada fluxo, você cadastra o card uma única vez no Catálogo (com imagem 1:1, título, descrição e botão) e pode adicioná-lo em qualquer carrossel de qualquer fluxo.

---

## 1. O que é o Carrossel no Instagram Direct?

Na API oficial da Meta (Instagram Messaging API), o carrossel é chamado de **Generic Template**.  
Ele permite enviar uma mensagem com **cards lado a lado que o seguidor arrasta para o lado** no Direct (rolagem horizontal).

Cada card possui quatro elementos principais:
1. **Imagem:** Foto em destaque, preferencialmente quadrada (1:1, 1080×1080).
2. **Título:** O nome do produto, serviço ou categoria em destaque.
3. **Subtítulo / Descrição:** Detalhes breves sobre o que está sendo oferecido.
4. **Botão Fixo:** Botão nativo que fica colado no rodapé do card e nunca some da conversa.

---

## 2. Regras e Restrições Rígidas da Meta Graph API

A Meta possui regras estritas de formatação para carrosséis. Se alguma regra for violada, a API recusa o envio com erro `400 Bad Request`:

| Elemento | Limite Oficial da Meta | Como Nosso Sistema Trata |
| :--- | :--- | :--- |
| **Quantidade de Cards** | Mínimo 1, Máximo 10 cards | Limitado a 10 cards por nó no editor e no motor |
| **Título do Card** | Máximo **80 caracteres** | Validação no formulário e corte defensivo automático (`.slice(0, 80)`) |
| **Subtítulo / Descrição** | Máximo **80 caracteres** | Validação com contador visual `0/80` no cadastro |
| **Proporção da Imagem** | Proporção recomendada **1:1** (quadrada) | Exibição em container `aspect-square` no painel e preview |
| **Texto do Botão** | Máximo **20 caracteres** | Forçado em **CAIXA ALTA** para máxima legibilidade no celular |
| **Tipo de Botão** | `web_url` (Link) ou `postback` (Próximo Passo) | Suporte nativo a ambos os tipos no catálogo |

---

## 3. Catálogo Reutilizável vs Cards Avulsos

### Por que um Catálogo Central?
Se você tem 10 fluxos de automação diferentes e altera o preço de um serviço ou a foto de um produto, você teria que abrir os 10 fluxos um a um.  
Com o **Catálogo de Cards**:
1. Você cadastra o card uma única vez em `/catalogo`.
2. Vários fluxos inserem esse mesmo card no nó de carrossel.
3. Se você atualizar o título, a foto ou o link no Catálogo, **todos os fluxos que usam o card são atualizados instantaneamente**.

### Proteção Contra Exclusão Acidental (`onDelete: Restrict`)
O banco de dados e a Server Action bloqueiam a exclusão de qualquer card que esteja sendo utilizado em fluxos ativos:
- Se você tentar excluir um card em uso, o sistema avisa exatamente em quais fluxos ele está presente.
- Isso impede que leads fiquem sem resposta ou que o Instagram quebre o carrossel por falta de dados.

---

## 4. Comportamento no Editor Visual (React Flow)

No Canvas do editor de fluxos:
- **Card com Link Externo (`URL`):** Abre um link (como WhatsApp, site ou checkout). Não gera saída de linha no canvas, pois o lead é direcionado para fora do Instagram.
- **Card com Próximo Passo (`POSTBACK`):** Gera uma **saída dedicada (bolinha na direita)** no nó do carrossel com o nome do card.
  - Se o lead arrastar o carrossel e clicar em *"Pacote VIP"*, o fluxo segue para o nó conectado a essa saída específica!
  - Se clicar em *"Pacote Básico"*, segue para outro caminho.

---

## 5. Como o Motor de Automação Executa o Carrossel

No arquivo `src/lib/engine/runner.ts`:
1. Quando a automação atinge o nó `CAROUSEL`, busca os cards ordenados por posição (`position: "asc"`).
2. Dispara a chamada `sendCarouselMessage` para a Graph API da Meta (ou simula em modo Mock se estiver sem chaves).
3. Grava no histórico de conversa com `kind: "CAROUSEL"`.
4. **Verificação de Parada Inteligente:**
   - Se **nenhum** card tiver botão `POSTBACK` (todos forem links externos), o motor segue imediatamente para a próxima caixinha conectada.
   - Se **pelo menos um** card tiver botão `POSTBACK`, o motor pausa a execução em `WAITING_CLICK` e aguarda o clique do seguidor.
5. Quando o lead toca no botão do card, o webhook recebe o payload `card:{cardId}` e a função `resumeFlowOnClick` retoma o fluxo exatamente no ramo conectado àquele card.

---

## 6. Telas e Arquivos Criados nesta Etapa

- `src/lib/meta/graph.ts`: Método `sendCarouselMessage` com formatação do `generic template`.
- `src/lib/engine/runner.ts`: Execução do nó `CAROUSEL` e retomada por `payload.startsWith("card:")`.
- `src/app/catalogo/actions.ts`: Server Actions (`listCatalogItems`, `createCatalogItem`, `updateCatalogItem`, `deleteCatalogItem`).
- `src/app/catalogo/page.tsx`: Página Server Component de catálogo.
- `src/app/catalogo/CatalogClient.tsx`: Painel interativo com listagem em grade, métricas, filtros, modal de edição e **preview em tempo real do Instagram Direct**.
- `src/components/layout/Sidebar.tsx`: Adição do item `Catálogo` no menu lateral principal.
- `src/lib/engine/engine.test.ts`: Testes unitários com 100% de sucesso para templates de carrossel e saídas dinâmicas.
