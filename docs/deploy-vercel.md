# Colocar o Fluxo no ar (Vercel + Supabase)

O Fluxo usa **um banco próprio no Supabase**, que não se mistura com nenhum outro projeto seu. O jeito mais fácil é criar esse banco **pela própria Vercel**.

## 1. Importar o projeto na Vercel

1. Entre em https://vercel.com com a sua conta do GitHub.
2. Clique em **Add New… → Project** e importe o repositório **manychat**.
3. Em **Environment Variables**, adicione só uma variável por enquanto:

   | Nome | Valor |
   | --- | --- |
   | `SITE_PASSWORD` | uma senha que você inventa pra entrar no site |

4. Clique em **Deploy**.

A primeira publicação vai **falhar**, porque ainda não existe banco. Isso é normal: siga pro passo 2.

## 2. Criar o banco pela Vercel (integração Supabase)

1. No projeto, abra a aba **Storage**.
2. Clique em **Create Database** e escolha **Supabase**.
3. Preencha:
   - **Nome:** `fluxo-manychat`.
   - **Região:** São Paulo, se aparecer.
   - **Plano:** grátis.
4. Clique em **Connect** para ligar o banco ao projeto `manychat`, em todos os ambientes (Production, Preview, Development).

A Vercel cria sozinha as variáveis do banco (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` e outras). O Fluxo já sabe ler esses nomes, então você **não precisa copiar nenhuma URL**.

> Esse banco fica numa organização do Supabase ligada à Vercel, separada da "Start Company". Nada se mistura com seus outros projetos.

## 3. Publicar de novo

1. Abra **Deployments**, clique nos `…` da última publicação e escolha **Redeploy**.
2. Durante a publicação, as tabelas são criadas sozinhas. O comando usado é o `prisma migrate deploy`, que **nunca apaga dados**.

## 4. Entrar

Abra o endereço da Vercel com `/fluxos` no fim. O navegador vai pedir:
- **usuário:** `fluxo`;
- **senha:** a de `SITE_PASSWORD`.

O site começa vazio. Clique em **Automação rápida** para criar a primeira.

## Branch

O código está na branch `claude/friendly-euler-lkfig3`. Você pode:
- abrir o link de **Preview** dessa branch, que a Vercel gera sozinha; ou
- em **Settings → Git → Production Branch**, colocar essa branch.

Depois de juntar tudo na `main`, volte a usar a `main`.

## Alternativa: banco criado direto no Supabase

Crie um projeto novo em https://supabase.com/dashboard. Depois, em **Connect**, copie duas URLs e coloque na Vercel:
- **Transaction pooler** (porta 6543): vai no `DATABASE_URL`.
- **Session pooler** (porta 5432): vai no `DIRECT_URL`.

⚠️ No plano grátis do Supabase, cada organização só pode ter 2 projetos ativos.
