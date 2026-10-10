# PROMPT 07 — Mobile, acessibilidade (WCAG 2.2 AA) e UX

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> Onda D. Roda **em paralelo** com os itens 3, 4 e 5, mas mexe só em interface, sem alterar a lógica de dados. Comece depois do merge do item 2, porque ele mexe no PostPicker, no Painel e na Sidebar.

## Papel
Você deixa o "Fluxo" usável e bonito no celular, no tablet e no desktop, acessível (WCAG 2.2 AA) e claro para um dono de pequeno negócio sem conhecimento técnico, seguindo o design system oficial.

## Leitura obrigatória específica
`DESIGN.md` → `docs/DESIGN.md` (tokens, PostPicker, DmPreview, regras de responsividade), a pasta `design-system/`, a pasta `design/`, `docs/GLOSSARY.md` (termos em pt-BR), `docs/etapa-2-editor.md`, `docs/etapa-2b-builder-simples.md`, `docs/etapa-6-contatos-conversas.md`, `PRD.md` (perfil do usuário).

**Skill obrigatória para o editor avançado:** `react-flow` (instalada em `~/.claude/skills/react-flow`). Leia `SKILL.md`, `references/accessibility.md`, `references/performance-and-styling.md` e `references/advanced-patterns.md`.

## Evidências da auditoria (QA de navegador + `a11y-architect` + `react-reviewer`)
**Mobile (375 e 768)**
- Sidebar fixa de 68px (`Sidebar.tsx:109`) com `body` em `overflow-hidden flex-row` (`layout.tsx:32`): sobram ~307px.
- Inbox com 3 colunas de 320px ou mais (`InboxClient.tsx:185,525`).
- Construtor com `w-[500px]` fixo (`SimpleBuilder.tsx:492`); cabeçalho sobreposto em 375. **"Interromper" fica fácil de tocar sem querer e desliga uma automação ativa.**
- Editor avançado: Palette com `w-60` e Inspector com `w-[360px]` (`Inspector.tsx:490,541`); o canvas some.
- Botões cortados em `/fluxos`, `/` e `/ajustes`; tabela de contatos com 1046px.

**Acessibilidade**
- Tokens `accent` e `accent-muted` indefinidos: o botão "+ Novo Contato" fica branco sobre branco (`ContactsClient.tsx:148,164`).
- Cores fixas com contraste baixo: `emerald-500`, `amber-500`, `rose-500` e `white/70` (`ContactsClient:194,362,375,482`; `InboxClient:227,281,345,442`; `SimpleBuilder:346,391,462`).
- Modais sem `role="dialog"`, foco preso, tecla Esc ou retorno de foco (`PostPicker:191`, `ContactsClient:414,461`, `InboxClient:630`). Uso de `window.confirm`, `prompt` e `alert` (`SimpleBuilder:300,440,457,482,1157`).
- Botões só com ícone e sem nome (PostPicker, Contatos, Inbox, Sidebar). Controles que só aparecem no hover (remover etiqueta).
- `<div onClick>` no lugar de botão (`PostPicker:214`, `SimpleBuilder:498`).
- Inputs sem `label` ou `htmlFor`. Falta `aria-pressed` e `role="tab"` nos filtros. Falta `aria-live` nos erros e toasts.
- Áreas de toque menores que 24px. Nenhum `prefers-reduced-motion`.
- Falta `<main>`, link "Pular para o conteúdo" e `aria-label` no `nav`.
- Editor avançado: conexões só por arraste (critérios 2.1.1 e 2.5.7).
- Chaves React duplicadas (`tag-test`) e chaves por índice em listas editáveis.

**UX e textos**
- Jargão e inglês: "Live Inbox", "Follow Gate", "Broadcast", "IGSID", "CRM", "Leads Quentes"; o comando `npx prisma db seed` aparece para o usuário (`Inspector:386`).
- "AO VIVO" em vermelho, que lê como erro.
- Termos inconsistentes: "automação" × "fluxo".
- Datas em inglês ("24 SEP") e `toLocale*` sem `"pt-BR"`.
- Inbox fora de ordem e sem separador de data.

**Bugs de interface**
- `useAutosave.tsx:26-58`: não tenta de novo após erro; não salva ao sair da página.
- Autosave + "Salvar" na rota `novo` criam fluxos duplicados (`SimpleBuilder:188-195,283-297`).
- Aviso falso de "alterações não salvas" (`:1151-1160`).
- Atualização otimista sem rollback (`:262-272,440-446,457-459`).
- Editor avançado: `EditorContext.Provider value` recriado a cada render (`FlowEditor.tsx:~225`); snapshot e lint recalculados a cada movimento do arraste (`:106-107`); `isValidConnection` depende de todos os nós; `FlowEditor` importado junto com o `SimpleBuilder`.
- `<img>` sem `next/image`.
- `/ai` e `/direct` são telas "Em breve" no menu. Decida com o dono: esconder ou marcar claramente como "em breve" (sem fingir funcionalidade).

## Tarefas
1. **Layout responsivo:**
   - abaixo de `md`: Sidebar vira barra inferior ou menu (drawer);
   - Inbox mostra um painel por vez no celular (lista → conversa → detalhes);
   - construtor com `w-full lg:w-[500px]` e cabeçalho que quebra linha;
   - "Interromper" separado e com confirmação acessível;
   - editor avançado com Palette e Inspector em drawers;
   - tabelas viram cards no celular.
2. **Componentes base acessíveis:**
   - `Modal` (`<dialog>` nativo ou Radix: foco preso, Esc, retorno de foco, título ligado) substituindo os 4 modais e todo `confirm`/`prompt`/`alert`;
   - `Toast` com `role="status"`;
   - `IconButton` com `aria-label` obrigatório.
3. **Cores e tokens:**
   - definir ou substituir `accent`;
   - trocar cores fixas por tokens semânticos do `docs/DESIGN.md` (`success`, `warning`, `danger`);
   - contraste mínimo de 4.5:1 em texto e 3:1 em elementos gráficos.
4. **Semântica:**
   - `<main>`, link "Pular para o conteúdo", `nav` com `aria-label`, `h1` por página;
   - `label`/`htmlFor` em todos os campos;
   - `aria-pressed` ou abas nos filtros;
   - `aria-live` nos erros;
   - controles de hover também visíveis com `focus-visible`;
   - `<div onClick>` → `button` ou `radio`;
   - áreas de toque ≥ 44px nos principais;
   - `prefers-reduced-motion` global.
5. **Editor avançado (skill `react-flow`):**
   - painel para **conectar caixinhas pelo teclado**, com a mesma validação do arraste;
   - `ariaLabelConfig` em pt-BR;
   - `deleteKeyCode={['Backspace','Delete']}`;
   - `ariaLabel` nos nós;
   - memorizar o valor do contexto;
   - não recalcular snapshot e lint durante o arraste;
   - `isValidConnection` estável;
   - prevenção de ciclos com `getOutgoers` (alinhada com o motor);
   - `next/dynamic` para o `FlowEditor`.
6. **Autosave:**
   - nova tentativa com backoff;
   - `flush()` ao navegar e desmontar;
   - criar o fluxo uma única vez na rota `novo`;
   - comparar com o último estado salvo;
   - rollback com mensagem nas atualizações otimistas.
7. **Textos (pt-BR):**
   - glossário aplicado ("Conversas", "Trava de seguidor", "Transmissão", "Etiquetas");
   - sem IDs técnicos para o usuário;
   - "AO VIVO" em verde;
   - datas com `Intl.DateTimeFormat('pt-BR')`;
   - inbox em ordem cronológica, com separador de dia;
   - mensagens de erro com instrução do que fazer.
8. `next/image` com `remotePatterns` dos CDNs do Instagram.

## Arquivos que este item possui
`src/components/**` (apresentação), `src/app/**/*Client.tsx` (marcação e estilo), `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*` (novos componentes base), `src/components/ui/useAutosave.tsx`, `src/components/flow-editor/*`. Não altere actions, motor ou schema.

## Agentes e skills
- **Agentes:** `a11y-architect` (antes e depois), `react-reviewer`, `performance-optimizer`, `code-simplifier`, `e2e-runner`, `general-purpose` com Chrome DevTools MCP para o QA visual.
- **Skills:** `react-flow`, `accessibility`, `wcag-audit-patterns`, `fixing-accessibility`, `screen-reader-testing`, `mobile-design`, `tailwind-design-system`, `react-best-practices`, `react-performance`, `ux-copy` / `design:ux-copy`, `browser-qa`, `ui-visual-validator`.

## Testes
- **Playwright + axe** em todas as páginas: zero violações sérias ou críticas.
- **Rolagem horizontal** em 320, 375, 768, 1024, 1440 e 1920: `scrollWidth <= clientWidth` em todas as páginas.
- **Lighthouse mobile** (DevTools MCP) em todas as páginas: Acessibilidade ≥ 95, Boas práticas ≥ 95.
- **Teclado:**
  - percorrer cada página só com Tab, Shift+Tab, Enter, Esc e setas;
  - criar e conectar nós no editor avançado sem mouse;
  - abrir e fechar todos os modais.
- **Leitor de tela:** fluxo principal com VoiceOver (macOS) — criar automação, escolher post, publicar.
- **Autosave:**
  - testes do hook (nova tentativa, `flush`, sem duplicata);
  - E2E: editar, navegar logo em seguida e conferir que nada se perdeu.
- **Screenshots** antes e depois, por página e por largura (evidência no relatório).

## Critérios de aceite
- [ ] Todas as páginas usáveis em 375, 768 e 1440, sem cortes nem rolagem horizontal (screenshots).
- [ ] axe sem violações sérias; Lighthouse de Acessibilidade ≥ 95 em todas as páginas.
- [ ] Editor avançado operável só pelo teclado.
- [ ] Nenhum `window.confirm`/`prompt`/`alert`; nenhuma chave React duplicada no console.
- [ ] Autosave sem perda e sem duplicação, comprovado por teste.
- [ ] Textos em pt-BR consistentes com o `docs/GLOSSARY.md`; `docs/DESIGN.md` atualizado se surgir componente novo.
