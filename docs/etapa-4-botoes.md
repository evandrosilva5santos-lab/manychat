# Etapa 4 — Os Botões Fixos (Button Template), explicados

Nesta etapa, garantimos que **100% dos botões no sistema sejam do tipo Botão Fixo (`button template`)**, sem exceções.

---

## 1. Por que nunca usamos Quick Reply?

Na API da Meta existem duas formas de enviar botões no direct do Instagram:

| Característica | ❌ Quick Reply (Resposta Rápida) |  Button Template (Botão Fixo) |
| --- | --- | --- |
| **Posicionamento** | Fica solto na barra inferior do teclado | **Anexado diretamente no corpo da mensagem** |
| **Comportamento ao digitar** | **Some para sempre** se o lead digitar algo | **Continua intacto** e clicável |
| **Histórico da conversa** | Some assim que o lead fecha o app | Fica gravado no chat para sempre |
| **Reengajamento** | O lead não consegue voltar para clicar | O lead pode rolar para cima dias depois e clicar |

Por essa razão, o ManyChat e o nosso sistema adotam **exclusivamente o Button Template**.

---

## 2. As Regras Oficiais da Meta (Instagram Messaging API)

Para a Meta aprovar a entrega da mensagem sem erro `HTTP 400`:

1. **Máximo de 3 Botões por Mensagem**:
   - Cada balão de mensagem pode carregar no máximo **3 botões**.
   - No editor visual, o botão *"Adicionar botão"* é desativado assim que atinge 3 de 3.
2. **Máximo de 20 Caracteres no Título**:
   - O Instagram impõe 20 caracteres por rótulo.
   - O aplicativo mobile renderiza automaticamente em `CAIXA ALTA` (ex: `QUERO ME INSCREVER`).
3. **Dois Tipos Nativos de Destino**:
   - **Postback**: O clique continua a conversa dentro do Instagram. Ele envia um payload estruturado para o webhook (ex: `node:cly123_btn_1` ou `gate:cly123`). O motor acorda a execução e segue pela linha correspondente àquele botão.
   - **Web URL**: Abre um link externo (como o WhatsApp ou página de vendas) no navegador interno do Instagram sem fechar a conversa. **Exige obrigatoriamente protocolo HTTPS (`https://`)**.
4. **Texto Obrigatório no Balão**:
   - Não existe botão solto sem texto. A mensagem mãe precisa ter um texto explicativo de até 1.000 caracteres.

---

## 3. Como as Conexões Funcionam no Editor (React Flow)

No editor de fluxos (Canvas):
- Cada botão da caixinha **Pergunta com botões** (`QUESTION`) ganha sua própria bolinha de saída (**Handle**) no lado direito do card.
- Se você criar dois botões (ex: `NOIVA 2026` e `FORNECEDOR`), você pode puxar uma linha de cada botão para caminhos completamente diferentes.
- Botões do tipo **Abrir um link (`web_url`)** não têm bolinha de saída, porque ao clicar o lead é direcionado para fora do fluxo (ex: WhatsApp).

---

## 4. Estrutura do Payload Enviado à Meta Graph API

```json
{
  "recipient": { "id": "IGSID_DO_LEAD" },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "Quer saber como funciona a inscrição para o casamento? 👇",
        "buttons": [
          {
            "type": "web_url",
            "title": "QUERO ME INSCREVER",
            "url": "https://wa.me/5551994044194"
          },
          {
            "type": "postback",
            "title": "FALAR COM EQUIPE",
            "payload": "node:cly_duvidas_btn_1"
          }
        ]
      }
    }
  }
}
```

Quando o lead toca em `FALAR COM EQUIPE`, a Meta envia um webhook com `postback.payload = "node:cly_duvidas_btn_1"`. Nosso motor (`src/lib/engine/runner.ts`) lê o payload e faz o fluxo continuar exatamente daquele ponto.
