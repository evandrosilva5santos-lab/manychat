# CURRENT_TASK — Autorização Operacional de Execução (ECC Standard)

> **Documento:** Autorização Formal de Execução  
> **Status:** `READY_FOR_EXECUTION`  
> **Framework:** Everything Claude Code (ECC)  
> **Agente Autorizado:** `CLAUDE` (Claude Code)  
> **Orquestrador Emissor:** `ANTIGRAVITY`  

---

## 🎯 Tarefa Autorizada

- **TASK ID:** `NANO-001`
- **TITLE:** Adicionar método `getUserMedia` em `src/lib/meta/graph.ts` e criar rota `GET /api/instagram/media` com fallback mock defensivo.
- **RISK LEVEL:** `HIGH`
- **EPIC:** `EPIC-001` (Seletor Visual de Publicações do Instagram)
- **FASE:** `FASE 2` (Editor Visual & Seletor de Mídia)
- **STATUS:** `READY`

---

## 📋 Escopo e Arquivos Permitidos

### Arquivos Permitidos (`ALLOWED FILES`):
1. `src/lib/meta/graph.ts`
2. `src/app/api/instagram/media/route.ts`

### Arquivos Proibidos (`FORBIDDEN FILES`):
- `PRD.md` (Imutável)
- `src/components/simple-builder/PostPicker.tsx` (Alterado apenas na NANO-003)
- `src/lib/engine/engine.ts`
- `prisma/schema.prisma`
- `package.json`
- Qualquer outro arquivo fora dos permitidos acima.

---

## 🔍 Pesquisa Prévia (Research-First)
- **Fontes a Inspecionar Antes de Escrever Código:**
  - `src/lib/meta/graph.ts`: Analisar como os métodos existentes (`getUserProfile`, `validateConnection`) lidam com fallback quando `!this.accessToken || process.env.NODE_ENV === "test"`.
  - Documentação da Meta Graph API v21.0: O endpoint `GET /{ig-user-id}/media` aceita os campos `id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count`.

---

## ⚡ Ação de Implementação (Implementation Action)

1. No arquivo `src/lib/meta/graph.ts`:
   - Adicionar o tipo exportado:
     ```typescript
     export type InstagramMediaItem = {
       id: string;
       caption?: string;
       mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
       mediaUrl?: string;
       thumbnailUrl?: string;
       permalink?: string;
       timestamp?: string;
       likeCount?: number;
       commentsCount?: number;
     };
     ```
   - Adicionar o método na classe `InstagramGraphClient`:
     ```typescript
     async getUserMedia(igUserId?: string, limit = 25): Promise<{
       success: boolean;
       data: InstagramMediaItem[];
       mock?: boolean;
       error?: string;
     }>
     ```
   - Se `!this.accessToken || process.env.NODE_ENV === "test"`, retornar os dados mockados formatados com `mock: true`.
   - Se houver token, fazer `fetch` no endpoint `${GRAPH_API_BASE}/${targetUserId}/media` com Bearer token e tratamento defensivo `try/catch`.
2. Criar o arquivo `src/app/api/instagram/media/route.ts`:
   - Exportar `async function GET(req: Request)` chamando `defaultGraphClient.getUserMedia()`.
   - Retornar `NextResponse.json(result, { status: result.success ? 200 : 500 })`.

---

## 🧪 Estratégia de Teste e Validação ECC

### Test Strategy
- *Test Before:* `curl -s http://localhost:3007/api/instagram/media` $\rightarrow$ Retorna 404 (Rota inexistente).
- *Test After:* `curl -s http://localhost:3007/api/instagram/media` $\rightarrow$ Retorna 200 com JSON contendo `success: true` e array `data`.

### Validation Strategy (Três Níveis)
- **Level 1 (Local):** `npx tsc --noEmit` passa com código 0 (zero erros de tipagem TypeScript).
- **Level 2 (Integração):** `npm test` continua com 46/46 testes passando sem regressões.
- **Level 3 (Requisito PRD):** O endpoint responde na porta 3007 fornecendo o contrato de dados necessário para o seletor visual de publicações.

---

## 🛡️ Considerações de Segurança (Security Review)
- O token `IG_ACCESS_TOKEN` jamais deve ser exposto na resposta JSON.
- A requisição não deve falhar silenciosamente se o token estiver expirado: retornar fallback gracioso com mensagem de erro controlada.

---

## 🛑 Protocolo Pós-Conclusão
Ao concluir e validar os 3 níveis:
1. Registrar em `state/CHANGELOG.md`.
2. Mover `NANO-001` de `READY` para `DONE` em `execution/TASK_QUEUE.md`.
3. Atualizar `state/STATUS.md`.
4. Atualizar `execution/CURRENT_TASK.md` autorizando `NANO-002`.
