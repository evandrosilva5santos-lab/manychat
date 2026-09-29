# DESIGN — Contrato Visual, Tokens e Design System (Fluxo)

> **Documento:** Contrato Estético e de UX/UI Universal  
> **Status:** Ativo / Inviolável  
> **Design System:** Fluxo UI (`design-system/` & `src/app/globals.css`)  

---

## 1. Identidade & Direção Visual

O **Fluxo** adota uma estética moderna, profissional e de alta fidelidade voltada para infoprodutores e agências.
- **Personalidade:** Confiável, ágil, premium, com contraste acentuado e feedback visual imediato.
- **Tema:** Suporte nativo a Dark Mode (padrão preferencial) e Light Mode com transições suaves e sem flashes visuais.

---

## 2. Tokens de Cor (Paleta Oficial)

| Nome do Token | HEX | Descrição / Uso |
| :--- | :--- | :--- |
| `primary` | `#2563eb` | Cor principal da marca, botões de ação e estados ativos |
| `primary-hover` | `#1d4ed8` | Estado hover de botões primários |
| `primary-light` | `#3b82f6` | Destaques suaves e seleções ativas |
| `surface-100` | `#09090b` | Background geral da aplicação (Dark) / `#f8fafc` (Light) |
| `surface-200` | `#18181b` | Cards, painéis laterais e modais (Dark) / `#ffffff` (Light) |
| `surface-300` | `#27272a` | Inputs, dropdowns e superfícies elevadas (Dark) / `#e2e8f0` (Light) |
| `surface-400` | `#3f3f46` | Separadores e bordas destacadas |
| `ink` | `#f4f4f5` | Texto principal com alta legibilidade (Dark) / `#0f172a` (Light) |
| `ink-muted` | `#a1a1aa` | Texto secundário, legendas e rótulos auxiliares |
| `border` | `#27272a` (Dark) / `#e2e8f0` (Light) | Divisores e contornos de cards |
| `success` | `#16a34a` | Indicador de fluxo ativo, conexões válidas e status live |
| `warning` | `#eab308` | Alertas de limites da Meta ou campos opcionais pendentes |
| `danger` | `#dc2626` | Erros, ações destrutivas (excluir fluxo) ou tokens expirados |

---

## 3. Tipografia

- **Fonte Principal:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`.
- **Fonte Monospaçada:** `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `monospace` (para IDs, códigos e tokens).
- **Escala Tipográfica:**
  - `h1`: `text-2xl font-bold tracking-tight` (24px, line-height 32px)
  - `h2`: `text-xl font-bold` (20px, line-height 28px)
  - `h3`: `text-base font-semibold` (16px, line-height 24px)
  - `body`: `text-sm font-normal` (14px, line-height 20px)
  - `caption / label`: `text-xs font-medium` (12px, line-height 16px)
  - `micro`: `text-[11px] font-normal` (11px, line-height 14px)

---

## 4. Espaçamento & Raio de Borda

- **Espaçamento:**
  - `xs`: `0.25rem` (4px)
  - `sm`: `0.5rem` (8px)
  - `md`: `1rem` (16px)
  - `lg`: `1.5rem` (24px)
  - `xl`: `2rem` (32px)
- **Border Radius:**
  - Pequeno: `rounded-lg` (8px)
  - Médio (cards e botões): `rounded-xl` (12px)
  - Grande (modais e containers): `rounded-2xl` (16px)
  - Pílula / Badges: `rounded-full`

---

## 5. Componentes Padronizados

### 5.1 Botões (`fx-btn-primary`, `fx-btn-secondary`, `fx-btn-ghost`)
- **Primário:** Fundo `primary`, texto branco, sombra suave, transição de escala de 102% no hover.
- **Secundário:** Fundo `surface-200`, borda `border`, texto `ink`, hover `surface-300`.
- **Ghost:** Sem fundo nem borda, hover `surface-200`, texto `ink-muted`.
- **Dimensões:** Altura de 36px (`py-2 px-4 text-xs font-semibold`).

### 5.2 Seletor de Publicações (`PostPicker`)
- **Linha Horizontal de Miniaturas Rápidas:**
  - 4 cards quadrados de 68px x 68px (`h-17 w-17`).
  - Badge no canto superior direito: ícone de camadas (`Copy`) para Carrossel ou claquete (`Clapperboard`) para Reel.
  - Seleção ativa: borda `primary`, anel `ring-2 ring-primary/40` e ícone de check centralizado.
  - Botão "Mostrar Todos" logo abaixo.
- **Modal de Seleção Completa:**
  - Janela modal centralizada com backdrop blur (`bg-black/60 backdrop-blur-xs`).
  - Largura máxima `max-w-2xl` e altura máxima de `85vh`.
  - Cabeçalho com título `Selecione qualquer publicação ou reel para automatizar` e botão Fechar (`X`).
  - Grid de **3 colunas** com proporção 1:1 (quadrada) para as capas dos posts.
  - Card de post: capa da mídia, ícone de formato, título/primeiras palavras da legenda em 1 linha (`line-clamp-1`), data/tempo relativo e link "Ver no Instagram".
  - Seção inferior: formulário para colar link direto de imagem/post manual caso a mídia desejada não apareça.

### 5.3 Simulador de Smartphone (`DmPreview`)
- Dimensão fixa de 340px de largura com proporção de tela de celular e contorno arredondado simulando o notch do iPhone.
- Abas superiores: "Publicação" e "Direct (DM)".
- Na aba direct: simulação de mensagens azuis do lead e cinzas do robô, com botões fixos de até 20 caracteres clicáveis.

---

## 6. Estados de Interface

- **Default:** Cores sólidas de contraste neutro.
- **Hover:** Clareamento sutil do background em 5% a 10% e elevação sutil de escala (101-102%).
- **Focus / Active:** Anel de foco visível `ring-2 ring-primary/50 outline-none`.
- **Disabled:** Opacidade 50%, cursor `not-allowed`, sem eventos de ponteiro.
- **Loading:** Skeleton pulsante (`animate-pulse bg-surface-300 rounded`).
- **Empty State:** Ilustração centralizada, mensagem clara e botão primário direcionando para ação.

---

## 7. Responsividade Estrita

- **Desktop (>= 1280px):** Layout em duas colunas no Easy Builder (Painel de configuração na esquerda com 55% de largura; Simulador de celular fixo na direita com 45%).
- **Tablet / Notebook Médio (1024px a 1279px):** Painel adaptativo com simulador de celular recolhível ou em gaveta flutuante.
- **Mobile (< 1024px):** Layout em coluna única. O simulador de celular passa para uma aba inferior flutuante "Ver Preview".

---

## 8. Invariante de Design

Nenhum desenvolvedor ou agente de IA está autorizado a utilizar cores arbitrárias fora da paleta documentada ou componentes fora do padrão do design system.
