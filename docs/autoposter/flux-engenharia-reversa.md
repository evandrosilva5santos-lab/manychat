# Engenharia reversa — Reportei Flux (flux.reportei.com)

Referência para o clone do Autoposter. Capturado em 2026-10-13 com a conta do dono logada.
Prints em `docs/autoposter/prints/`.

## Stack observada
- Backend Laravel (rotas expostas via Ziggy, filas Horizon, MCP próprio em `/mcp/v1`).
- Frontend Vue 3 + Vite (`/build/assets/*.js`), vue-i18n, Tailwind.
- Ícones: Font Awesome 6.4.2 (CDN). Fonte: **Inter**.
- Mídia: Cloudflare R2 com URL assinada, servida via `/file/{id}/proxy`.
- Dados da página vêm no HTML; não há XHR de dados no carregamento de `/company`.

## Tokens visuais
| Token | Valor | Uso |
|---|---|---|
| fundo da página | `#F9FAFB` | body |
| topbar | `#421E66` (classe `bg-flux`), altura 56px, padding 12px 40px | barra roxa do topo |
| botão ativo na topbar | `#6E35A7`, raio 12px, 40px de altura | "Meus projetos" |
| primária | `#1876F2` | botão "Novo projeto", "Agendados", links "+ Novo post" |
| título / outline | `#0054C2` | `h1-title` 32px/700, botão "Gerenciar equipe" (borda 2px) |
| texto forte | `#212B30` (gray-900) | nomes, números |
| texto fraco | `#78909C` (gray-600) | "posts", "Ver detalhes" |
| roxo publicado | `#6E35A7` (purple-800) | "Publicados" |
| vermelho | `#F63535` (red-600) | "Não concluídos" |
| input | fundo `#ECF0F1`, raio 12px, 40px, 14px, padding 0 40px (ícone à esquerda) | busca |
| card | branco, raio 12px, `shadow-sm` → hover `shadow-lg`, padding 16px 20px, gap 12px | card de projeto |
| botão | `r-btn` padding 8px 16px, raio 12px, 16px/500, borda 2px | todos |

Grid de projetos: `grid gap-x-6 gap-y-[34px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Container útil ~1140px centralizado.

## Tela 01 — Meus projetos (`/company`)
Print: `prints/01-meus-projetos.jpg`
- Topbar roxa: logo flux, botão "Meus projetos", logo reportei, ícone de upgrade, sino com badge "99+", avatar + nome da empresa com dropdown.
- Cabeçalho: logo da empresa (círculo 48px) + "Meus projetos" (32px, `#0054C2`) + botão primário "+ Novo projeto".
- Seletor de período (texto 11px, fundo azul claro): "Últimos 7 dias | 07 - 13 Out 2026".
- Bloco de resumo (4 colunas, separadas por divisória vertical, hover cinza):
  - **Aprovação**: X aguardando revisão · X com pedidos de ajuste · X aprovados
  - **Agendados**: número grande (20px/700) + "posts"
  - **Publicados**: número + "posts"
  - **Não concluídos**: X posts não publicados · X posts com falha
  - Cada coluna: link "Ver detalhes →".
- Barra: busca "Buscar projeto" · "Ordenar por **Último post criado** ▾" · botão outline "Gerenciar equipe".
- Card de projeto: avatar circular 64px, nome (16px/700), ícones das redes conectadas, 3 linhas (12px): "N posts agendados", "N posts publicados", "N falhas nos últimos 7 dias", link "+ Novo post".

- Hover no card: sombra maior + menu "⋮" no canto superior direito (`prints/01b-meus-projetos-card-hover.jpg`).
- Link do card → `/project/{id}`. Link "+ Novo post" → `/project/{id}/network-select`.

## Tela 02 — Projeto / Calendário (`/project/{id}` → redireciona para `/project/{id}/calendar?type=weekly&startDate=…&endDate=…`)
Prints: `prints/02-calendario-semanal.jpg`, `prints/02a-calendario-semanal-carregando.jpg` (skeleton), `prints/03-calendario-mensal-carregando.jpg`
- **Sub-header branco** (64px, `shadow`, padding 16px 40px): seta voltar · avatar do projeto · "Posts de {Nome}" (20px/700, `#0054C2`, `h2-title`) · divisória · ícones das redes conectadas (+N) · botão "Gerenciar integrações" (variante tertiary: texto `#5A7582`, borda 2px `#CFD8DC`) · à direita: botão lápis (editar projeto) · "✨ Criar post com IA" (`#6E35A7`) · "+ Novo post" (`#1876F2`).
- **Abas** (14px, padding 8px 12px, raio 12px): Calendário de posts · Meus posts · Grupos de aprovação · Dashboard · Impulsionar posts (selo "Novo" azul `#1876F2`, 12px/600, raio 9px).
  - Ativa: texto `#CD37B4`, fundo `#F9E6F6`, 500. Inativa: `#78909C`, 400, fundo transparente.
- **Caixa do calendário**: branco, raio 12px, padding inferior 40px.
  - Toolbar: "Outubro, 2026" (20px/700) · botões ← Hoje → (outline cinza, raio 12px) · toggle **Semanal / Mensal** (ativo com borda azul e texto azul) · select "Conta" (ícones das redes) · select "Formato" (Feed, Story, Reels…) · botão "Compartilhar" (ícone de link externo, gera link público `/calendar-share/{token}`).
  - Semanal: 7 colunas (dom→sáb), cabeçalho "seg 12" (12px/700 `#5A7582` + número em círculo 28px fundo `#F9FAFB`); **hoje** = círculo `#CD37B4` com texto branco. Colunas separadas por divisória vertical cinza.
  - Mensal: grade 7×N, número do dia no canto superior direito, dias fora do mês em cinza claro ("30 de set."), hoje em círculo rosa; posts aparecem como pílulas (skeleton enquanto carrega).
  - URL guarda o estado: `?type=weekly|monthly&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
- **Card de post no calendário** (fundo `#F9FAFB`, raio 12px, padding 8px, ~165×200px):
  - Topo: ícones das redes (círculos) + "+N" e menu "⋮".
  - Miniatura da primeira mídia (raio, com sobreposições): hora "10:00" em pílula branca no canto superior esquerdo; ✓ verde no canto superior direito = aprovado; "!" laranja = problema.
  - Base: pílula de formato ("Feed") e pílula de status com bolinha colorida.
  - Status → cor: **Publicado** `#6E35A7` · **Agendado** `#1876F2` · **Não publicado** `#FF7A51` (o card inteiro ganha borda 2px `#FFB59E`).
  - Card sem mídia mostra spinner de carregamento.

### API do calendário
`GET /api/posts?project_id={id}&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&calendar=true&no_medias=true&per_page=100&page=1`
Também chamados: `GET /api/posts/posts-for-placeholders?project_id&start_date&end_date`, `GET /api/notifications/unread-count`.

Formato de cada item (um item = um post numa rede):
```
id, project_id, asset_group_id, review_group_uuid, review_group_id, review_group_name,
asset_group_title, asset_group_categories[], type, status, schedule_at, token, logo,
connect_uuid, network, account_id, account_name, format_type,
options { review_verified, scheduleAndReview, review_verified_at, canPostOnlyIfApproved,
          previous_status, review_schedule_at, failure_reason,
          pre_schedule_warning_sent, pre_schedule_warning_sent_at },
integration_status, integration { logo, network, network_slug, source_id, source_name, status },
medias[], first_media[], schedule { date, time }, review_status
meta { current_page, from, last_page, path, per_page, to, total, sortBy, descending }
```
Valores vistos (259 posts de 4 projetos):
- `status`: `reviewing`, `reviewing_approved`, `approved`, `published`, `not_published` (outros prováveis ainda não confirmados: rascunho, agendado, falha).
- `type` / `format_type`: `feed`, `reels` (o filtro da UI também lista Story).
- `network`: `instagram`, `instagram_business`, `facebook`, `linkedin`, `linkedin_personal`, `tiktok`, `google_my_business`.
- `review_status`: `approved`. `integration_status`: `active`.
- `options.canPostOnlyIfApproved` = só publica se aprovado; `scheduleAndReview` = agenda e envia para revisão junto; `failure_reason` guarda o erro de publicação.

### Calendário mensal (`prints/03-calendario-mensal.jpg`)
- Cada post vira uma **pílula** de uma linha: bolinha de status · ícones das redes (+N) · hora à direita · ✓ verde (aprovado) ou ! laranja (problema).
- Fundo da pílula pela cor do status: roxo claro (publicado), azul claro (agendado), laranja claro com borda laranja (não publicado), lilás apagado (dia passado).
- Clicar na pílula abre o modal e acrescenta na URL `&assetGroupId={id}&postIds={id|id|…}` (link direto para o post).

## Tela 03 — Modal "Detalhes do post"
Prints: `prints/04-detalhe-post-acoes.jpg`, `prints/05-detalhe-post-historico.jpg`, `prints/06-detalhe-post-outras-acoes.jpg`
- Modal branco ~950px, raio ~24px, título "Detalhes do post" (24px/700 `#0054C2`), × no canto.
- **Carrossel de variações** no topo: chip "Todos" (ícones das redes +N; branco, raio 12px, sombra `#00449D/0.08`) e um chip por rede: miniatura + ícone da rede + formato ("Feed") + nome da conta, com ✓ verde se aprovado. Seta › para rolar.
- Coluna esquerda: **prévia** do post como na rede (avatar + @conta, mídia, legenda).
- Coluna direita, abas sublinhadas (16px/700; ativa `#0054C2` com sublinhado, inativa `#78909C`):
  - **Ações pendentes**: caixa azul clara com ícones das redes · "Agendado para: 14/10/2026 às 17:30" · pílula de status · ✓. Aviso verde (fundo `#DFF7E6`, texto `#0A9B38`, raio 8px, padding 10px 12px): "Estes posts estão aprovados e **serão publicados** na data do agendamento se continuarem como aprovados." Botões pequenos (12px/500, borda 2px `#CFD8DC`, raio 12px, padding 4px 12px): **Alterar data/hora** · **Enviar para aprovação** · **Outras ações ▾**.
  - Menu "Outras ações": Marcar como · Publicar · Cancelar agendamento · Editar · Excluir (ícone + texto 14px `#212B30`).
  - **Histórico**: ícones das redes, o mesmo aviso verde e uma lista de eventos: "07/10/26 às 10:06 · [ícone rede] Feed · ● Aprovado", avatar com a inicial + e-mail do revisor em caixa alta + "aprovou o post", e o link "Não reconhece essa revisão? **Invalidar**." Eventos ligados por uma linha vertical.
- Rodapé: botão lixeira · seletor do grupo de aprovação (ícone de pasta + "Posts {Cliente}" ▾) · botão "✏️ Editar".

### API da linha do tempo
`GET /api/asset-group/{id}/timeline` →
```
[{ messages: { code, text, params: { actor{icon,name,color,email,type,logo}, target{id,icon,label},
   comments, invalid, invalidated_at, review_id } }, created_at, created_at_timestamp }]
```
Códigos de evento vistos (= máquina de estados real):
`post.created.reviewing_scheduled` → `review.approved` → `post.status_changed.ready` → `post.status_changed.scheduled` → `post.status_changed.publishing` → `post.status_changed.published` | `post.status_changed.not_published`; além de `post.schedule_updated` e `post.edited`.

## Tela 04 — Meus posts (`/project/{id}/posts?tab=all`)
Prints: `prints/07a-meus-posts-filtros.jpg`, `prints/07-meus-posts-grade.jpg`
- Chips de filtro por status (outline, raio 12px; ativo com borda azul), com contador em bolinha colorida:
  **Todos · Rascunho · Aguardando revisão · Pedido de ajuste · Aprovado (verde) · Agendado (azul) · Publicado · Não publicado · Falha**. Seta › para rolar. À direita: selects "Conta" e "Formato".
- **Esta é a lista oficial de status do produto.** Mapeamento para o clone: `draft`, `reviewing`, `needs_adjustment`, `approved`, `scheduled`, `published`, `not_published`, `failed` (+ internos `ready`, `publishing`).
- Grade de 7 cards por linha (156px de largura), o mesmo card do calendário com data completa "12/10/2026 16:00", ícone de pasta (grupo) e ⋮. Paginação numérica centralizada numa caixa branca.

## Tela 05 — Grupos de aprovação (`/project/{id}/review-group`)
Prints: `prints/08a-grupos-aprovacao.jpg`, `prints/08-grupos-aprovacao-tabela.jpg`
- Cabeçalho "Grupos de aprovação" + botão outline "+ Criar novo grupo".
- Cards dos grupos: **mosaico** (1 capa grande em cima + 3 pequenas embaixo, raio 12px), nome truncado (16px/700), contador em pílula cinza ("13"), data "2026-09-23 23:39:23".
- "Todos os grupos": select **Status** + busca "Buscar grupo…". Tabela: **Nome do grupo · Conteúdo** (avatares sobrepostos das capas + "+5") **· Última atualização ▾** ("23/09/26 às 23:39") **· Status** (pílulas com contagem: "● 31 Publicado" roxo, "● 18 Aprovado" verde, "● 8 Não publicado" laranja) · ações: 🔗 copiar link de aprovação e 🗑 excluir.
- Um grupo = um link para o cliente (`/review/{review_group_uuid}`).

## Tela 06 — Portal do cliente: boas-vindas (`/review/{uuid}` → `/review/{uuid}/welcome`)
Prints: `prints/09a-portal-cliente-boas-vindas.jpg`, `prints/09b-portal-cliente-boas-vindas-botao.jpg`
- Página pública, sem topbar. Fundo `#F9FAFB`, tudo centralizado numa coluna estreita.
- Logo da agência (círculo 64px) + nome da agência ("Start Inc. | Kondensa MKT", 20px, Quicksand).
- "Olá!" (Quicksand 24px/700, `#0054C2`) · "Você recebeu **posts** para aprovação".
- Ilustração em traço azul (homem segurando celular com ✓ verde, brilhos rosa).
- Botão primário "Vamos lá →" (`#1876F2`, raio 12px, 16px/500, 129×41).
- Clicar cria um revisor (`POST /api/reviewer/create`). **Não foi clicado em projeto de cliente.**
- Telas seguintes (pela rota, ainda não vistas): `/posts/{reviewer}` → `/feedback/{reviewer}` → `/send/{reviewer}` → `/congratulations/{reviewer}`.

## Tipografia (correção)
- **Títulos**: Quicksand 700 (classes `font-main`, `h1-title` 32px, `h2-title` 20px). **Texto**: Inter.

## Tela 07 — Dashboard do projeto (`/project/{id}/dashboard`)
Print: `prints/10-dashboard-tablet.jpg` (largura de tablet: topbar com ☰, botão "+" redondo e ⋮ no lugar dos botões)
- Chips de conta: "Visão Geral" (todas as redes, +N) e um chip por conta conectada · seletor de período com comparação ("13 Set - 12 Out 2026 / COMPARAÇÃO: 14 AGO - 12 SET 2026") · botão de atualizar.
- Banner azul claro "Quer ver mais métricas? Acesse o Reportei…" com botão verde "Ver mais métricas" e mockup de gráfico.
- O painel em si é embutido do Reportei ("Carregando dashboard…", `POST /api/dashboard/session`). **No clone: substituir por métricas próprias da Graph API ou deixar para depois.**

## Tela 08 — Novo post, passo 01. Formatos (`/project/{id}/network-select`)
Prints: `prints/11-novo-post-01-formatos.jpg`, `prints/11b-novo-post-sem-redes.jpg`
- Sub-header com stepper à direita: **01. Formatos · 02. Conteúdo · 03. Conclusão** (ativo em azul com sublinhado; inativos cinza claro).
- "Onde você gostaria de criar seus posts?" (Quicksand, `#0054C2`) + "Selecione abaixo os tipos de posts das redes conectadas".
- Grade de cards brancos (5 por linha, ~195×195, raio 12px): ícone + nome da rede + @conta truncada; lista de formatos com checkbox redondo à esquerda e ícone à direita (imagem ou play).
  - Instagram/Facebook: Feed · Story · Reels. LinkedIn: Feed. TikTok: Feed · Photo. YouTube: Shorts. Threads, Pinterest, Google Meu Negócio: Feed.
  - Rede sem conta conectada: card esmaecido; ao clicar vira "Você ainda não integrou nenhuma conta nesta rede." + botão "Integrar agora".
- Rodapé fixo branco com botão "Continuar".

## Tela 09 — Novo projeto (`/project/create`)
Print: `prints/12-novo-projeto.jpg`
- Cabeçalho: avatar com a inicial (círculo rosa) + "Novo projeto".
- Duas colunas: esquerda "Personalize seu projeto" + explicação; direita "Detalhes do projeto": **Nome** · **Idioma** (select, "Português do Brasil") · **Fuso horário** (select, "(UTC-03:00) America, Sao_Paulo") · **Formato de data** (rádio DD/MM/YYYY ou MM/DD/YYYY, com exemplo da data de hoje).
- Inputs com rótulo flutuante na borda, raio 12px, borda azul 2px no foco.
- Botões: "Cancelar" (outline) à esquerda, "Continuar" (primário) à direita.
- Ao salvar → abre o **Reportei Connect** (`connect.reportei.com/customer-integrations/session/{uuid}`), print `prints/13-reportei-connect-integracoes.jpg`: faixa roxa com logo flux e "Você está integrando suas redes no projeto X através do Reportei Connect", "Adicionar integrações", busca, cards por rede ("Nenhuma conta · Integrar"), barra flutuante inferior com "← Voltar para X" e "Finalizar integrações" (verde). Ao voltar → `/project/{id}/network-select?refresh_sync=1`.
- **No clone**: o equivalente é a conexão Instagram/Facebook já existente no instachat (OAuth Meta).

## Projeto de teste
- Criado com autorização do dono: **"TESTE Clone Autoposter"** (id 36760), sem redes conectadas. Usar só ele para fluxos que alteram dados. **Nunca aprovar, enviar nem editar nada de projeto de cliente.**

## Tela 10 — Editar projeto (`/project/{id}/edit*`)
Layout comum: cabeçalho com avatar 64px + "Editar projeto" (Quicksand 32px). Menu lateral esquerdo (~265px) com ícone + texto, item ativo com fundo azul claro `#DCEBFC`-ish e texto `#0054C2`:
**Dados do projeto · Variáveis · Hashtags · Assinaturas · Categorias · Diretrizes gerais · Regras de publicações**. Conteúdo à direita com título Quicksand `#0054C2`.

- **Dados do projeto** (`prints/14-editar-projeto-dados.jpg`): logo (círculo 64px) + "Escolher logo" (verde) + "Remover" (outline) · Nome · Idioma · Fuso horário · Formato de data · Cancelar/Continuar.
- **Variáveis** (`prints/15`): aviso cinza "Para criar novas variáveis, acesse Configurações da conta." · busca · lista de variáveis com valor por projeto · Cancelar/Salvar. (Variáveis são globais da conta, com valor por projeto; ex.: {{site}}, {{whatsapp}}.)
- **Hashtags** (`prints/16`, `16b`): busca + "+ Criar novo grupo" · tabela Nome do grupo | Hashtags · vazio: "Nenhum grupo de hashtags encontrado". Modal: Nome do grupo + textarea Hashtags ("Separe as hashtags por vírgula e utilize o símbolo #.") · Cancelar/Salvar.
- **Assinaturas** (`prints/17`): mesmo padrão; tabela Nome da assinatura | Conteúdo. (Texto fixo adicionado ao fim da legenda.)
- **Categorias** (`prints/18`, `18b`): mesmo padrão; tabela "Nome da categoria ▾". Modal "Criar categoria": nome + paleta de 10 cores (marrom, vermelho, laranja-escuro, laranja, verde, ciano, azul-claro, azul, roxo, rosa) · Cancelar/Salvar.
- **Diretrizes gerais** (`prints/19`) — questionário da marca (alimenta a IA):
  - Objetivo: principal objetivo (Fortalecer a marca · Gerar vendas · Gerar autoridade · Educar o público · Criar relacionamento) · ação que os posts devem provocar (select).
  - Público: público-alvo · dores e desejos · familiaridade (Leigo · Intermediária · Especialista).
  - Cores: primária · destaque/CTA · até 6 secundárias ("Adicionar cor") · aplicação (Seguir sempre a identidade · Pode variar por campanha) · cor proibida.
  - Estilo visual: tipo de imagem (Fotografia realista · Ilustração · 3D · Mockup UI · Gráfico/infográfico · Misto) · pessoas (Fotos reais · Produto sem pessoas · Sem pessoas · Indiferente) · texto na imagem (Mínimo · Equilibrado · Bastante).
  - Tom: percepção desejada (até 5 de 20 adjetivos: Moderna, Sofisticada, Premium, Acessível, Humana, Próxima, Divertida, Criativa, Inovadora, Confiável, Especialista, Minimalista, Elegante, Energética, Jovem, Técnica, Inspiradora, Organizada, Prática, Exclusiva) · educar x vender (3 opções) · liberdade criativa (5 níveis).
  - Restrições: como NÃO parecer (até 5 de 15) · elemento a não repetir · elemento obrigatório · mensagem que sempre deve transmitir.
  - Botão "Salvar diretrizes do projeto".
- **Regras de publicação** (`prints/20`):
  - Texto explicativo + aviso: falha definitiva ou conta para reconectar → aviso por e-mail.
  - **Retentativas**: "Em falhas comuns, tentamos automaticamente 3x com intervalos de 1 minuto." Opções: tentar de novo quando estabilizar, se a espera for de até X · ou não tentar e só avisar por e-mail.
  - **Preferência de agendamento** (padrão ao enviar para aprovação com data): "Publicar somente se for aprovado" (= `options.canPostOnlyIfApproved`) · "Publicar mesmo sem aprovação".
  - Botão "Salvar preferências".

## Tela 11 — Criar post com IA (`/project/{id}/flux-ai` → `/flux-ai/briefing`)
Print: `prints/21-criar-post-com-ia.jpg`
- "Crie seu primeiro post em segundos" + subtítulo. Caixa lilás "✨ Primeiros passos · Inclua imagens de referência e briefing" com ilustração.
- 1. Formato do conteúdo: cards Quadrado 1:1 (Feed) · **Retrato 4:5** (Feed, padrão) · Vertical 9:16 (Story).
- 2. Briefing: Apenas uma imagem / Post estático / Carrossel (quantidade 2–10) + texto obrigatório.
- 3. Imagens de referência (até 5): "Selecionar imagens do meu projeto" ou "Fazer upload".
- Dica "mantenha seus guidelines atualizados" + botão "CrIAr post agora".
- **No clone: fase 2** (usar Diretrizes gerais + referências → geração de imagem/legenda).

## Tela 12 — Impulsionar posts (`/project/{id}/ads`)
Print: `prints/22-impulsionar-posts.jpg`
- Estado vazio ilustrado: "Impulsione posts publicados ou automatize os próximos" · passos: Conecte o Instagram e a conta do Meta Ads · Defina critérios, objetivo e investimento. **No clone: fora do escopo inicial.**

## Tela 13 — Configuração da empresa (`/company/edit/*`)
Print: `prints/23-empresa-equipe.jpg`
- Menu lateral: Dados da empresa · Equipe · API e MCP · Webhooks.
- Equipe: campo "E-mail do novo membro" + botão "Convidar" (desabilitado até digitar) · lista de membros: avatar, nome, papel ("Administrador"), avatares dos projetos a que tem acesso (+N), ✏️ e 🗑 · paginação.

## Tela 14 — Notificações (`/notifications`)
Print: `prints/24-notificacoes.jpg`
- Cabeçalho: logo da empresa · "← Voltar" · "Notificações" · botões "Marcar todas como lida" (outline azul) e "Excluir todas".
- Filtros: Todas · Não lidas (contador) · select Projeto (avatares) · busca.
- Card: miniatura do post com selo ✕ vermelho · título ("Agendamento cancelado no projeto X") · ícone da rede + conta · mensagem ("O post não foi publicado porque não foi aprovado a tempo.") · data · botão "Reagendar post →" · bolinha vermelha = não lida.
- Regra de negócio confirmada: **post com "publicar só se aprovado" que não foi aprovado até a hora → cancelado + notificação**.

## Tela 15 — Compartilhar calendário
Prints: `prints/25-modal-compartilhar-calendario.jpg`, `prints/26-calendario-publico.jpg`
- Modal "Compartilhar calendário": explica que quem tiver o link vê **posts agendados e publicados**, sem editar; pode desativar a qualquer momento. Campo com o link `https://flux.reportei.com/calendar-share/{uuid}` + ícone copiar · "Desativar link" (outline vermelho) · "Copiar link" (primário). O link é criado ao abrir o modal.
- Página pública `/calendar-share/{uuid}`: sem topbar; avatar + nome do projeto (pequeno, cinza) + "Calendário de posts" (Quicksand 32px); mesma caixa do calendário (Semanal/Mensal, Conta, Formato), sem botões de ação. Vazio: "Nenhum post para essa semana".

## Ainda falta capturar (precisa de uma conta NÃO-cliente conectada ao projeto de teste)
- Novo post passo **02. Conteúdo** (editor: mídia, legenda por rede, hashtags/assinaturas/variáveis, primeiro comentário, localização, música) e **03. Conclusão** (agendar, grupo de aprovação, "publicar só se aprovado").
- Portal do cliente após "Vamos lá": identificação do revisor, lista de posts, feedback por post (aprovar / pedir ajuste com comentário), envio e tela de parabéns.
- `/media-upload/{linkId}` (link para o cliente subir mídia).
- Fluxo "Novo post": `network-select` → `post/create` → `schedule` → `finish`.
- "Criar post com IA", "Gerenciar integrações", editar projeto (placeholders, hashtags, assinaturas, categorias, diretrizes, regras de publicação).
- Portal do cliente `/review/...` (welcome → posts → feedback → congratulations).
- `/calendar-share/{token}`, `/media-upload/{linkId}`, notificações, Gerenciar equipe, /company/edit, /settings.

## Mapa de rotas (Ziggy) — páginas
```
/company                                  Meus projetos
/company/edit | /edit/team | /edit/api | /edit/webhooks
/import/projects | /import/integrations | /import/team-members
/project/create  (POST /project/store)
/project/{id}                             visão do projeto
/project/{id}/edit
/project/{id}/edit-placeholders | edit-hashtag-groups | edit-signatures
/project/{id}/edit-post-categories | edit-general-guidelines | edit-publish-rules
/project/{id}/calendar                    calendário editorial
/project/{id}/posts                       lista de posts
/project/{id}/connect-session | network-select | conclusion
/project/{id}/dashboard | ads
/project/{id}/review-not-approved
/project/{id}/review-group[/{rg}][/schedule]
/project/{id}/asset-group/{ag}/schedule
/post/{project}/create | /post/{project}/schedule | POST /post/{project}
/post/{project}/finish/{ag} | /post/{ag}/edit | PUT /post/{ag}/update
/project/{p}/flux-ai[/briefing|/select-posts-to-analyze|/studio/{uuid}]
/settings/personal-data | account-info | password-change | privacy
/plan/* | /placeholder/* | /notifications
/google-drive/connect | /oauth/canva/connect
/calendar-share/{token}                   calendário público compartilhado
/media-upload/{linkId}                    link para o cliente subir mídia
```

### Portal do cliente (aprovação pública)
```
/review/{review_group_uuid}                         grupo de posts para revisar
/review/{rg}/welcome/{reviewer_uuid?}               boas-vindas / identificação do revisor
/review/{rg}/posts/{reviewer}                       lista de posts
/review/{rg}/feedback/{reviewer}                    feedback
/review/{rg}/send/{reviewer}  POST /store           envio da decisão
/review/{rg}/congratulations/{reviewer}             tela final
/review/only/{asset_group_token}/...                mesmo fluxo para um post só
/review/invalidate-review/{reviewer_uuid}
```

## API (modelo de dados inferido)
- **asset-group** = um post (pode ter várias redes). Ações: `timeline`, `publish-now`, `schedule`, `cancel-schedule`, `rollback-status-to-review`, `change-posts-statuses`, `send-to-review`, `review-group`, `counts-by-status`.
- **post** = a versão do asset-group em uma rede. `GET /posts`, `total-pending`, `generate-first-comment`, `search-locations`, `individual-approval`.
- **review-group** = lote enviado ao cliente. CRUD + `order` + `share/email`.
- **reviewer** = pessoa do cliente que revisa (`POST /reviewer/create`); **reviews** podem ser invalidadas.
- Por projeto: `hashtag-groups`, `post-categories`, `signatures` (CRUD), `placeholders` (variáveis), `external-calendar-share`.
- Integrações: instagram (followers, music, audio), tiktok (privacy, music), youtube (categories), pinterest-boards.
- Outros: notifications (unread-count, mark-all-read), alerts, control-center (stats/posts/projects), flux-ai (16 rotas), canva, google-drive, webhooks, team-member.
