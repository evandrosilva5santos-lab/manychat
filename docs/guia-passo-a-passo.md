# Como Criar seu Próprio ManyChat — Passo a Passo

por @euguilhermepasin

Esse guia é pra você que assistiu o vídeo e quer construir o seu próprio sistema de automação de conversas — tipo um ManyChat, só que seu. Vou te mostrar a ordem certa de fazer isso, sem enrolação.

## Passo 1 — Decida o que você vai construir

Antes de mexer em qualquer coisa, para e pensa: pra que serve o seu sistema?

- [ ] Qual é o objetivo? Responder gente automaticamente, capturar contatos, vender no automático?
- [ ] Em qual rede vai funcionar primeiro? O foco aqui é o Instagram — é onde a galera do seu público realmente está. Depois dá pra expandir pra WhatsApp ou Messenger.
- [ ] O que ele PRECISA fazer logo de cara: mandar mensagem automática, reconhecer palavras-chave, marcar o contato com uma etiqueta
- [ ] O que pode esperar: relatórios chiques, vários usuários, loja de modelos prontos

## Passo 2 — Escolha as ferramentas

Você não precisa reinventar a roda. Aqui vai uma combinação simples que resolve:

| Pra que serve | O que usar | Em outras palavras |
| --- | --- | --- |
| Site + "cérebro" do sistema | Next.js | A ferramenta que monta a tela E o motor por trás, junto |
| Onde ficam salvos os dados | Banco de dados (Supabase) | Tipo uma planilha gigante e organizada, na nuvem |
| Editor de fluxos arrastando caixinhas | React Flow | O que deixa você montar o fluxo visualmente, sem código |
| Conversar no Instagram | Instagram Messaging API (da Meta) | O canal oficial que seu sistema usa pra mandar e receber DM e responder comentário |
| Colocar no ar | Vercel | Onde seu site fica hospedado, pronto pra qualquer um acessar |

## Passo 3 — Organize as informações

Toda automação de conversa trabalha com as mesmas "peças". Pensa nelas como gavetas separadas:

- **Contato** — a pessoa que está conversando com você
- **Etiqueta** — uma marquinha que você cola no contato (ex: "cliente quente", "já comprou")
- **Fluxo** — a automação em si (ex: "boas-vindas")
- **Passo do fluxo** — cada etapa dentro dele (mandar mensagem, fazer pergunta, esperar um tempo)
- **Gatilho** — o que faz o fluxo começar (a pessoa mandou "oi", clicou num botão)
- **Histórico de conversa** — tudo que já foi trocado com aquele contato

## Passo 4 — Monte o editor de fluxos (a parte visual)

Essa é a parte mais visual do sistema — onde ele começa a parecer um produto de verdade.

- [ ] Deixar a pessoa arrastar "caixinhas" pra tela (mensagem, pergunta, condição, espera)
- [ ] Deixar ligar uma caixinha na outra com uma linha, formando o fluxo
- [ ] Salvar esse desenho pra ele não se perder quando fechar a página
- [ ] Conseguir abrir de novo um fluxo já criado e continuar editando

## Passo 5 — Faça o sistema responder sozinho

Aqui é onde a mágica acontece de verdade: seu sistema passa a conversar sozinho.

- [ ] Seu sistema precisa "escutar" quando chega uma DM ou comentário novo no Instagram
- [ ] Descobrir quem mandou (e cadastrar, se for gente nova)
- [ ] Checar se essa mensagem bate com algum gatilho que você configurou
- [ ] Seguir o fluxo do início ao fim, passo por passo
- [ ] Fazer o que cada passo manda (mandar mensagem, esperar, colocar etiqueta)
- [ ] Mandar a resposta de volta pra pessoa
- [ ] Guardar tudo no histórico da conversa

## Passo 6 — Crie um painel de controle

É o painel onde você (ou o cliente) vai mexer no dia a dia:

- [ ] Lista de todos os contatos, com busca e filtro por etiqueta
- [ ] Clicar num contato e ver a conversa inteira com ele
- [ ] Tela pra criar, editar e ligar/desligar fluxos
- [ ] Números simples: quantos contatos, quantas mensagens, quantos fluxos ativos
- [ ] Um login pra proteger o painel

## Passo 7 — Crie um app no Meta for Developers

Essa parte costuma passar batida, mas é obrigatória: pra mandar e receber mensagem pelo Instagram de forma automática, seu sistema precisa de uma "porta de entrada" oficial da Meta (dona do Instagram e do WhatsApp). Sem isso, não tem como o Instagram confiar no seu sistema e liberar o acesso.

**Por que é necessário:**

- O Instagram não deixa qualquer sistema mandar DM ou responder comentário em nome de um perfil — só libera pra quem tem um "app" cadastrado dentro da plataforma da Meta
- É no app do Meta for Developers que você pega as chaves de acesso (token) que seu sistema vai usar pra conversar com a API do Instagram
- É também ali que você configura o "endereço" (o webhook) pra onde o Instagram vai mandar as DMs e comentários que chegarem

**O que fazer:**

- [ ] Criar uma conta em developers.facebook.com
- [ ] Criar um novo app, do tipo "Business"
- [ ] Dentro do app, adicionar o produto "Instagram"
- [ ] Conectar uma conta profissional do Instagram pra testar (não precisa gastar nada)
- [ ] Copiar o Token de acesso e o ID da conta do Instagram — são as duas chaves que seu sistema vai usar
- [ ] Guardar essas chaves com cuidado, como se fossem uma senha (nunca deixar exposta em código público)

## Passo 8 — Coloque no ar e teste de verdade

- [ ] Publicar o site (deixar ele acessível na internet)
- [ ] Conectar as chaves de acesso do Instagram e do banco de dados
- [ ] Avisar o Instagram onde mandar as DMs e comentários que chegam (o "endereço" do seu sistema)
- [ ] Testar com uma conta real, comentando e mandando DM de verdade
- [ ] Corrigir os perrengues: mensagem fora de hora, contato duplicado, etc.

## Prompt bônus — copia e cola numa IA (tipo Claude ou ChatGPT)

Esse aqui é mais completo, pra deixar a galera empolgada. Cola isso numa conversa com uma IA de código (Claude, ChatGPT, Cursor etc.) e vá pedindo pra ela construir passo a passo com você:

```text
Quero construir, do zero, um sistema de automação de conversas parecido
com o ManyChat, focado em Instagram. Me ajude a construir isso passo a
passo, explicando cada decisão em português simples, como se eu fosse
iniciante. Vá por etapas, uma de cada vez, e só avance pra próxima
quando eu confirmar que entendi e que está funcionando.

CONTEXTO DO PROJETO:
Quero automatizar o atendimento do meu Instagram. As pessoas comentam
em posts/reels, mandam DM, ou clicam em botões dentro de uma conversa,
e quero que meu sistema responda automaticamente seguindo um fluxo que
eu configuro. Especificamente, preciso que ele consiga:

- Criar fluxos de automação arrastando caixinhas numa tela (editor
 visual), sem precisar programar toda vez que eu quiser mudar algo
- Ter gatilhos por: palavra-chave em comentário de post/reel, palavra-
 chave em DM, e clique em botão
- Dentro do fluxo, poder: mandar uma mensagem de texto, fazer uma
 pergunta com botões de resposta fixos (que não somem depois que o
 lead manda outra mensagem), esperar um tempo (delay), decidir um
 caminho diferente dependendo da resposta (condição if/else), colocar
 uma etiqueta (tag) no contato, e mandar um carrossel de cards
 (imagem + título + descrição + botão, vários lado a lado)
- Ter uma etapa de "confirme que já segue o perfil" antes de liberar um
 conteúdo, com um botão fixo tipo "DESBLOQUEAR"
- Ver a lista de contatos, filtrar por etiqueta, e abrir o histórico de
 conversa de cada um
- Guardar um catálogo de cards reutilizável (imagem, título, descrição,
 botão) que eu possa usar em vários fluxos diferentes
- Responder de verdade pelo Instagram (comentário e DM), não só numa
 tela de teste

STACK QUE QUERO USAR:
- Next.js (App Router) + TypeScript para o site e o back-end
- PostgreSQL como banco de dados, usando Prisma como ORM
- Tailwind CSS para o visual
- React Flow para o editor visual de fluxos (arrastar e soltar)
- Instagram Messaging API (da Meta, via app no Meta for Developers)
 para comentário, DM e botões
- Deploy final na Vercel

COMO QUERO TRABALHAR (siga essa ordem, uma etapa por vez):

1. Modelagem do banco de dados (schema Prisma): me explique cada
  tabela antes de criar (Contact, Tag, Flow, Node, Edge, Trigger,
  Message, CatalogItem) e como elas se relacionam.

2. Editor visual de fluxos com React Flow: quero arrastar diferentes
  tipos de "caixinha" pro canvas (mensagem, pergunta com botão fixo,
  condição, delay, aplicar etiqueta, carrossel/catálogo) e ligar uma
  na outra com linhas. Salvar e recarregar o fluxo depois.

3. O "motor" de automação: um endpoint que recebe o evento do
  Instagram (comentário, DM ou clique em botão), identifica o
  contato, descobre qual fluxo deve rodar de acordo com o gatilho, e
  executa cada nó em sequência até o fim, mandando as respostas de
  volta pela API.

4. Os botões: use o formato de botão FIXO na mensagem (button
  template / interactive button), nunca quick reply — quero que todo
  botão do sistema seja desse tipo, sem exceção, porque preciso que
  ele continue visível mesmo depois do lead mandar outras mensagens.

5. O carrossel/catálogo: um novo tipo de nó que manda uma mensagem
  com vários cards deslizantes, cada um com imagem, título, descrição
  e botão (link externo ou próximo passo do fluxo). Os cards vêm de
  uma tabela reutilizável, não são recriados a cada fluxo.

6. Painel com lista de contatos, filtro por etiqueta e histórico de
  conversa de cada um.

7. Configuração do app no Meta for Developers: me explique passo a
  passo como criar o app, adicionar o produto Instagram, conectar uma
  conta de teste e pegar as chaves de acesso (token e ID da conta).

8. Deploy na Vercel e configuração do webhook, com teste real numa
  conta do Instagram.

Em cada etapa, antes de escrever qualquer código, me explique
rapidamente o que vamos fazer e por quê — quero entender o que está
sendo construído, não só copiar e colar. Se alguma decisão minha for
limitada pela própria API do Instagram (tipo limite de botões por
mensagem), me avise antes de eu esbarrar nisso e sugira a alternativa.
```

## Checklist final — resumo rapidinho

- [ ] Já sei exatamente o que meu sistema vai fazer
- [ ] Escolhi as ferramentas e criei o projeto
- [ ] Organizei as "gavetas" de informação (contato, fluxo, etiqueta, gatilho)
- [ ] O editor visual de fluxos está funcionando
- [ ] O sistema já recebe mensagens do Instagram
- [ ] O sistema segue o fluxo sozinho e responde automaticamente
- [ ] Tenho um painel pra ver contatos e fluxos
- [ ] Publiquei e testei com uma conta do Instagram de verdade
- [ ] Criei o app no Meta for Developers e peguei as chaves de acesso
