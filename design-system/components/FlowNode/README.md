Caixinha do editor visual (custom node do React Flow).

- Cinco tipos, cada um com sua cor de categoria: `fx-node-trigger` (Gatilho), padrão (Mensagem), `fx-node-condition` (Condição if/else), `fx-node-delay` (Espera), `fx-node-action` (Ação: tag, campo, webhook, planilha). A cor aparece só no quadrado do ícone e no rótulo de tipo — o corpo é sempre `surface-200`.
- O consumidor fornece: tipo, nome editável, conteúdo resumido e as portas (`fx-handle-in` à esquerda; `fx-handle-out` em cada botão ou saída — cada botão da DM é uma saída própria).
- Selecionado: `aria-selected="true"` (contorno `node-edge-active`). Métricas por nó (enviadas/entregues/cliques) só em fluxos publicados.
- Linhas de conexão: `node-edge`, 2px, curva bezier; selecionada/em execução: `node-edge-active`.
