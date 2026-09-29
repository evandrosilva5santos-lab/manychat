# RULES — Regras Invariantes e Diretrizes Operacionais (Fluxo)

> **Documento:** Código de Regras Absolutas do Projeto  
> **Status:** Ativo / Inviolável  
> **Escopo:** Obrigatório para humanos e agentes de IA  

---

## 1. Regras de PRODUTO (PRODUCT)
- **REG-PROD-001:** O objetivo primário do MVP é o funil Comentário $\rightarrow$ Resposta Pública $\rightarrow$ DM com Botão Fixo $\rightarrow$ Follow Gate $\rightarrow$ Link Rastreado.
- **REG-PROD-002:** O produto NUNCA deve forçar cobrança por volume de contatos ou travar recursos essenciais no MVP.
- **REG-PROD-003:** O usuário deve ser capaz de criar e ativar uma automação em menos de 2 minutos pelo Easy Builder.

---

## 2. Regras de CÓDIGO (CODE)
- **REG-CODE-001:** Tipagem estrita com TypeScript (`strict: true`). O uso de `any` explícito é estritamente proibido em novos códigos ou rotas.
- **REG-CODE-002:** Toda rota de API que recebe ou retorna dados estruturados DEVE utilizar validação com schemas Zod.
- **REG-CODE-003:** Nunca silenciar exceções (`catch (e) {}` vazio). Erros devem ser tratados defensivamente e registrados com contexto claro.

---

## 3. Regras de ARQUITETURA (ARCHITECTURE)
- **REG-ARCH-001:** O App Router do Next.js 16 deve ser respeitado. Componentes de UI com estado, hooks ou interações de clique devem declarar `"use client"` explicitamente na primeira linha.
- **REG-ARCH-002:** Funções que acessam segredos da Meta ou realizam chamadas externas à Graph API devem residir em `src/lib/meta/` e nunca ser executadas diretamente no cliente sem passar por rotas de API ou Server Actions.

---

## 4. Regras de BANCO DE DADOS (DATABASE)
- **REG-DB-001:** Todas as alterações estruturais de entidades devem ser feitas no `prisma/schema.prisma` e versionadas através do comando `npx prisma migrate dev`.
- **REG-DB-002:** Relações vitais entre conta do Instagram e contatos/fluxos devem ter deleção em cascata (`onDelete: Cascade`) onde aplicável para evitar registros órfãos.

---

## 5. Regras de SEGURANÇA (SECURITY)
- **REG-SEC-001:** Segredos de aplicação (`IG_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `DATABASE_URL`) NUNCA devem ser commitados no Git ou expostos para o browser.
- **REG-SEC-002:** Todo endpoint de webhook Meta DEVE validar a assinatura HMAC SHA-256 antes de iniciar o processamento de qualquer evento.

---

## 6. Regras de DADOS (DATA)
- **REG-DATA-001:** Dados de leads (`Contact`, `Message`) devem ser preservados respeitando a LGPD. O lead tem direito a ter seus dados deletados caso solicitado.
- **REG-DATA-002:** Idempotência obrigatória: mensagens de entrada da Meta identificadas por `mid` ou comentários identificados por `comment_id` não podem ser processados em duplicidade.

---

## 7. Regras de API & INTEGRAÇÕES (API & INTEGRATIONS)
- **REG-API-001:** A versão oficial da Meta Graph API utilizada é estritamente a **v21.0**.
- **REG-API-002:** O endpoint `GET /api/instagram/media` deve implementar fallback para dados mock caso o token esteja indisponível, expirado ou o ambiente esteja sem internet, impedindo travamentos na UI.
- **REG-API-003:** As chamadas de envio de DM devem respeitar a política de janela de 24 horas da Meta (`now() - lastInboundAt <= 24h`).

---

## 8. Regras de UX & UI (DESIGN, ACCESSIBILITY & RESPONSIVENESS)
- **REG-UI-001:** É proibido inventar novas cores fora dos tokens definidos em `docs/DESIGN.md`.
- **REG-UI-002:** Botões fixos de DM (`button template`) são limitados pela Meta a no máximo 20 caracteres. O campo de input na interface DEVE impor `maxLength={20}` e exibir contador visual.
- **REG-UI-003:** O Easy Builder deve manter proporção ergonômica em telas desktop ($\ge 1280px$), com o formulário ocupando 55% da largura e o simulador de celular ocupando 45% com visualização em tempo real.

---

## 9. Regras de TESTES (TESTING)
- **REG-TEST-001:** Nenhuma tarefa ou PR pode ser dada como concluída se o comando `npm test` falhar.
- **REG-TEST-002:** Toda nova rota de API ou método de integração com a Meta DEVE possuir teste unitário correspondente no Vitest cobrindo cenários de sucesso, erro e fallback.

---

## 10. Regras de DOCUMENTAÇÃO & VERSIONAMENTO (DOCUMENTATION & VERSIONING)
- **REG-DOC-001:** Toda alteração de escopo, adição de rota ou alteração de contrato deve ser registrada em `state/CHANGELOG.md`.
- **REG-DOC-002:** O `PRD.md` é a autoridade máxima de produto e NÃO PODE ser alterado por agentes de execução. Divergências devem ser registradas em `docs/PRD_ISSUES.md`.

---

## 11. Regras de DEPLOY & AMBIENTE (DEPLOYMENT & ENVIRONMENT)
- **REG-ENV-001:** A porta oficial local do projeto é **`3007`** (`next dev -p 3007`). O agente jamais deve alterar para 3000 ou 3001.
- **REG-ENV-002:** O build de produção deve ser validado com `npm run build` antes de qualquer entrega para produção.

---

## 12. Regras de ESCOPO (SCOPE)
- **REG-SCOPE-001:** Não implementar funcionalidades fora do escopo do MVP definido no PRD (ex: WhatsApp, IA aberta, cobrança Stripe).
- **REG-SCOPE-002:** O agente executor só está autorizado a trabalhar na NANO TASK designada no `execution/CURRENT_TASK.md`.
