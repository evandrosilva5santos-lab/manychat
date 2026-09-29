# CONTEXT — Contexto de Negócio, Problema e Arquitetura de Produto

> **Documento:** Definição de Contexto e Propósito do Produto  
> **Status:** Ativo  
> **Autor:** Start Inc. / Orquestrador de Execução  

---

## 1. Contexto do Negócio

No ecossistema de marketing digital e infoprodutos do Brasil, o Instagram é o canal de maior tração para vendas diretas e geração de leads. O formato dominante de conversão atual é o **comentário engajado**: o criador posta um Reel ou carrossel com uma chamada para ação específica (ex: *"Comente GUIA para receber no direct"*), e uma automação imediata envia uma mensagem privada contendo o link ou botão de acesso.

As plataformas existentes (ex: ManyChat oficial) cobram planos em dólares baseados no volume total de contatos acumulados (mesmo contatos inativos), penalizando o crescimento do infoprodutor. Além disso, possuem interfaces inchadas com centenas de recursos que geram confusão para agências e criadores.

---

## 2. O Problema

1. **Custo Escalonado Abusivo:** Mensalidades em dólar que disparam conforme o perfil acumula leads.
2. **Complexidade Excessiva:** Editores repletos de opções avançadas que atrasam a criação de campanhas simples do dia a dia.
3. **Falta de Foco no Funil Real:** Falta de suporte nativo e simples para validação de seguidor (Follow Gate) antes de entregar o link.
4. **Dependência de Plataforma Fechada:** Risco de bloqueio ou encarecimento sem alternativas controladas pelo operador.

---

## 3. A Solução (O Produto "Fluxo")

O **Fluxo** é uma plataforma proprietária, leve e de alta conversão, operando diretamente sobre a **Meta Graph API v21.0 (Instagram Messaging)**.
O sistema entrega:
1. **Easy Builder (Automação em 2 minutos):** Uma interface orientada a formulário progressivo que permite criar a automação perfeita sem desenhar caixinhas se não quiser.
2. **Editor Avançado (React Flow):** Canvas visual completo para quem deseja criar fluxos condicionais com ramificações complexas.
3. **Simulador de Smartphone em Tempo Real:** Visualização simultânea e idêntica de como a DM aparecerá na tela do iPhone/Android do lead.
4. **Follow Gate Nativo:** Verificação se o lead segue a conta antes de liberar o link final.
5. **Seletor Visual de Publicações:** Integração direta com a conta do Instagram para escolher visualmente qual Reel ou Post receberá a automação.

---

## 4. Personas e Casos de Uso

### Persona 1: O Criador de Conteúdo / Especialista
- **Perfil:** Produz Reels diariamente, não tem paciência para configurar fluxos complexos.
- **Caso de Uso:** Posta um vídeo sobre finanças com CTA *"Comente PLANILHA"*. Quer selecionar a foto da capa do Reel no painel, escrever o texto da DM e publicar a automação em 60 segundos.

### Persona 2: A Agência de Lançamentos / Gestor de Tráfego
- **Perfil:** Gerencia múltiplos perfis de clientes, precisa de confiabilidade, métricas de cliques e histórico auditável.
- **Caso de Uso:** Configura automação para um lançamento de 7 dias com carrossel de produtos e lembretes para leads que não clicaram no link nas primeiras 2 horas.

---

## 5. Fluxos Principais do Sistema

```text
[Lead comenta palavra-chave no Post]
             │
             ▼
[Meta dispara Webhook POST /api/webhook/instagram]
             │
             ▼
[Fluxo valida HMAC e identifica a Automação ativa correspondente]
             │
             ▼
[Envia resposta pública no comentário (ex: "Mandei no direct! 🚀")]
             │
             ▼
[Envia DM com botão fixo (button template)]
             │
             ▼
[Lead clica no botão "RECEBER GUIA"]
             │
             ▼
[Follow Gate checa se segue a conta]
      ├── Se NÃO segue: pede para seguir antes de liberar
      └── Se SEGUE: entrega o link rastreado (/api/l/[code])
```

---

## 6. Premissas e Restrições Inegociáveis

1. **Janela de 24 Horas da Meta:** Nenhuma DM ou lembrete automatizado pode ser disparado após 24 horas da última mensagem recebida do usuário (`lastInboundAt`).
2. **Tipo de Botão Fixo:** Apenas `button template` (fixo no chat). É terminantemente proibido o uso de `quick_reply` efêmeros que desaparecem ao clicar.
3. **Porta Local:** O ambiente de desenvolvimento roda estritamente na porta `3007`.
4. **Idempotência de Webhook:** Todo webhook recebido deve ter o ID da mensagem ou comentário verificado para evitar envios duplicados em caso de retentativas da Meta.

---

## 7. Dependências Externas e Integrações

- **Meta Graph API v21.0:**
  - `GET /me/accounts` / `GET /me?fields=instagram_business_account`
  - `GET /{ig-user-id}/media`: Listagem de publicações e reels da conta.
  - `POST /{comment-id}/replies`: Resposta pública ao comentário.
  - `POST /me/messages`: Envio de mensagens privadas no direct.
  - `POST /{ig-user-id}/subscribed_apps`: Inscrição nos webhooks da página.
- **Banco de Dados PostgreSQL (Supabase):** Armazenamento das contas, fluxos, nós, contatos, tags e execuções.
