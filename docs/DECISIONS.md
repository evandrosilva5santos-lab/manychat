# DECISIONS — Registro de Decisões de Arquitetura (ADRs)

> **Documento:** Architecture Decision Records (ADRs)  
> **Status:** Ativo  
> **Governança:** Start Inc. / Orquestrador de Execução  

---

## ADR-001: Fixação da Porta Operacional `3007`
- **ID:** `ADR-001`
- **DATE:** 2026-09-28
- **CATEGORY:** ENVIRONMENT
- **CONTEXT:** Múltiplas instâncias locais rodando outros serviços nas portas 3000, 3001 e 3002 geravam conflitos de porta frequentes e redirecionamentos indesejados.
- **DECISION:** Fixar permanentemente a porta do projeto Fluxo/Manychat em **`3007`** no `package.json` (`next dev -p 3007` e `next start -p 3007`).
- **RATIONALE:** Garante previsibilidade, testes e acessos diretos sem colisão.
- **IMPACT:** Todos os scripts de dev e testes E2E/QA devem apontar para `http://localhost:3007`.
- **STATUS:** `ACTIVE`
- **SOURCE:** Diretriz explícita do usuário.

---

## ADR-002: Desativação do Basic Auth no Proxy de Desenvolvimento
- **ID:** `ADR-002`
- **DATE:** 2026-09-28
- **CATEGORY:** SECURITY / DX
- **CONTEXT:** O `src/proxy.ts` exigia credenciais HTTP Basic Auth (admin / senha) mesmo em requisições de desenvolvimento local, bloqueando subagentes e ferramentas automáticas de teste.
- **DECISION:** Desativar a exigência de Basic Auth em ambiente de desenvolvimento local, mantendo o proxy funcional para repasse de rotas.
- **RATIONALE:** Elimina atrito desnecessário durante os ciclos de desenvolvimento e auditoria de QA.
- **IMPACT:** Acesso local desimpedido a `/` e `/fluxos`.
- **STATUS:** `ACTIVE`
- **SOURCE:** Decisão de engenharia validada na auditoria técnica.

---

## ADR-003: Uso Estrito de `button template` e Banimento de `quick_reply`
- **ID:** `ADR-003`
- **DATE:** 2026-09-28
- **CATEGORY:** PRODUCT / INTEGRATION
- **CONTEXT:** A Meta oferece dois tipos de botões em DMs do Instagram: `button template` (fixos permanentemente na mensagem) e `quick_reply` (botões efêmeros que desaparecem da conversa assim que o usuário clica ou responde).
- **DECISION:** O Fluxo utilizará **exclusivamente** `button template` em todas as automações com botões. O uso de `quick_reply` está expressamente banido.
- **RATIONALE:** O lead frequentemente precisa clicar novamente no botão de acesso ou rever o catálogo mais tarde. Botões efêmeros reduzem drasticamente a conversão do funil.
- **IMPACT:** Máximo de 3 botões por mensagem e limite de 20 caracteres por título de botão impostos pela Meta.
- **STATUS:** `ACTIVE`
- **SOURCE:** `PRD.md` Seção 5.

---

## ADR-004: Fatiamento Atômico do Seletor de Posts em Nano Tasks
- **ID:** `ADR-004`
- **DATE:** 2026-09-28
- **CATEGORY:** EXECUTION / ARCHITECTURE
- **CONTEXT:** O componente `PostPicker.tsx` foi criado com dados mock estáticos. A feature de seleção visual de publicações reais da conta conectada da Meta precisa ser concluída sem regressões e com suporte offline/mock defensivo.
- **DECISION:** Dividir a feature em 4 Nano Tasks sequenciais e atômicas:
  1. `NANO-001`: Implementar método `InstagramGraphClient.getUserMedia` e endpoint `GET /api/instagram/media` com fallback mock.
  2. `NANO-002`: Criar testes unitários para a rota e cliente de mídia.
  3. `NANO-003`: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')`, adicionando estados de loading e filtro de tipo de mídia.
  4. `NANO-004`: Atualizar o `matcher.ts` e a compilação do gatilho para filtrar eventos de webhook pelo `mediaId` quando `scope === 'specific'`.
- **RATIONALE:** Permite que o próximo agente execute cada tarefa de forma determinística, com escopo restrito de arquivos e validação automatizada.
- **IMPACT:** Elimina risco de regressões e mantém a suíte de testes 100% verde em cada etapa.
- **STATUS:** `ACTIVE`
- **SOURCE:** Master Prompt e Auditoria Inicial.
