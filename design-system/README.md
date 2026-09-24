Fluxo é a interface de uma ferramenta de automação de conversas para Instagram (comentário → DM → botão → tag), feita para agências e negócios B2B. O sistema é neutro e calmo por fora — off-white, cinza-escuro, um único azul — para que a cor fique reservada ao que importa: o estado das automações e os tipos de caixinha no editor de fluxos.

## Conteúdo e voz

- Escreva em português do Brasil, tratando o usuário por **você**. Frases curtas, verbo na frente: "Publicar", "Adicionar gatilho", "Conectar Instagram".
- Rótulos da interface em *sentence case* ("Minhas automações", "Próximo passo"). Caixa alta só em dois lugares: badges de status (via CSS, estilo `caption`) e botões **dentro da DM** ("QUERO ME INSCREVER", "DESBLOQUEAR").
- Descreva gatilhos como uma frase completa que o cliente entende: "O usuário deixa um comentário em uma publicação ou Reel que inclui “casamento”".
- Datas relativas ("há 5 minutos"), números no padrão pt-BR (`1.234`, `67%`). Sem dado ainda: "—", nunca "N/D".
- Emoji é permitido **no conteúdo das mensagens** que o cliente escreve (é a voz da marca dele), nunca na interface do Fluxo.
- Erros dizem o que aconteceu, a consequência e a saída: "Token de acesso da Meta expirou — as automações estão pausadas. Reconectar".

## Cor

- Fundo do app: `surface-100`. Cards, nós, inputs e painéis: `surface-200`. Hover, item ativo e áreas rebaixadas: `surface-300`. Canvas do editor: `canvas` com grade de pontos `canvas-dot` a cada 16px.
- Texto: `ink` (principal), `ink-muted` (labels, descrições), `ink-subtle` (metadados e contadores). Todos passam 4,5:1 em `surface-100/200` nos dois temas.
- `primary` é o único azul: ação primária, link, aba ativa, foco, seleção e nó de Mensagem. Um botão primário por área. Texto sobre ele sempre `on-primary`.
- Divisórias: `border` (decorativo). Contorno de qualquer controle (input, toggle, botão secundário): `border-strong` (≥3:1).
- Status: `success` (Ao vivo), `danger` (Parado, erro, destrutivo), `warning` (atenção). Sempre com palavra ou ícone junto — nunca só cor. Fundos de badge/banner: as variantes `-soft`.
- Categorias do editor: `node-trigger` (Gatilho), `node-message` (Mensagem), `node-condition` (Condição), `node-delay` (Espera), `node-action` (Ação). A cor aparece só no quadrado do ícone e no rótulo do tipo; o corpo do nó é sempre `surface-200`. Linhas: `node-edge`; selecionada/em execução: `node-edge-active`.
- Proibido: gradientes, fundos coloridos em página inteira, cores da marca do cliente na interface.

## Tipografia

- Família `sans` (Plus Jakarta Sans, Google Fonts) para toda a interface; `mono` (JetBrains Mono) só para variáveis `{{first_name}}`, IDs, tokens e URLs de webhook.
- `display` = título da página (um por tela). `title` = seções do builder ("Quando alguém faz um comentário"). `heading` = nome de automação/card. `body` = texto e mensagens. `body-strong` = botões. `small` = descrições e resumos de gatilho. `caption` = badges e tipo de nó. `stat` = números dos StatCards.

## Espaço, forma e profundidade

- Grade de 4px: `space-3` dentro de nós e inputs, `space-4` em cards e linhas, `space-5` entre StatCards, `space-6` em painéis e margens de página, `space-8` entre seções.
- Raios: `radius-sm` badges/chips/botões da DM, `radius-md` botões, inputs e nós, `radius-lg` cards e linhas da lista, `radius-full` toggles, avatares e portas do nó.
- Sombras discretas: `shadow-card` em cards e linhas, `shadow-node` nos nós do canvas, `shadow-pop` em menus e tooltips. Nada além disso.
- Foco: anel sólido 2px `focus` com 2px de afastamento em todo elemento interativo.
- Movimento: 150ms ease-out em hover, toggle e seleção; sem animação decorativa. No canvas, zoom/pan são do React Flow.

## Layout do app

- Shell: `Sidebar` de ícones (72px) à esquerda; cabeçalho com breadcrumb (Automações › pasta › nome) e ações à direita; `AlertBanner` acima de tudo quando houver problema de conexão com a Meta.
- Lista de automações: `AutomationRow` em coluna, colunas Nome · Execuções · CTR · Modificado.
- Builder simples: painel esquerdo (~440px) com a receita "Quando alguém faz um comentário → E esse comentário possui → Eles receberão", usando `Input`, `Toggle` e chips; à direita `Tabs` (Insights / Visualização) com `StatCard`s ou `DmPreview`.
- Builder avançado: canvas em tela cheia com `FlowNode`s, controles de zoom no canto inferior direito, painel de propriedades à direita ao selecionar um nó.

## Iconografia

- Ícones de traço, 1.75px, cantos arredondados, 20–22px — padrão Lucide (open source, MIT). Não há conjunto próprio ainda; use Lucide até existir um.
- Ícones herdam `currentColor`; na sidebar `ink-muted`, ativo `primary`.
- Sem emoji na interface.

## Marca

- Ainda não há logo: escreva "Fluxo" em `sans` 700. Não use marcas, cores ou ícones de ferramentas concorrentes; ícones de rede (Instagram, WhatsApp) só nas telas de conexão de canal, no formato oficial fornecido pela Meta.

## Implementação (Next.js + Tailwind + React Flow)

- Importe o `tokens.css` gerado no layout raiz e aponte o tema do Tailwind para as variáveis: `colors: { primary: 'var(--primary)', ink: 'var(--ink)', surface: { 100: 'var(--surface-100)', … } }`, `borderRadius: { md: 'var(--radius-md)' }`.
- Tema escuro: `data-theme="dark"` no `<html>`.
- Cada tipo de caixinha é um *custom node* do React Flow renderizando a estrutura de `FlowNode`; `Handle` recebe a classe `fx-handle`. Cada botão da mensagem é um `Handle` de saída próprio (`id` = id do botão).
- Botões de DM são sempre *button template* (fixos), nunca *quick reply*; a UI limita a 3 botões por mensagem e 10 cards por carrossel.
