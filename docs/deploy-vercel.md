# Colocar o Fluxo no ar (Vercel + Supabase)

O Fluxo usa **um projeto próprio no Supabase**, só dele. Ele não se mistura com nenhum outro projeto seu.

## 1. Criar o banco (Supabase)

1. Entre em https://supabase.com/dashboard e clique em **New project**.
2. Preencha:
   - **Nome:** `fluxo-manychat`.
   - **Senha do banco:** crie uma senha forte e **guarde**.
   - **Região:** South America (São Paulo).
3. Espere o projeto ficar pronto, de 1 a 2 minutos.
4. Clique em **Connect**, no topo, e copie duas URLs, trocando `[YOUR-PASSWORD]` pela senha do banco:
   - **Transaction pooler** (porta **6543**): vira o `DATABASE_URL`.
   - **Session pooler** (porta **5432**): vira o `DIRECT_URL`.

> Plano grátis do Supabase: só 2 projetos ativos por vez. Se você já tem 2, pause um que não usa ou faça upgrade.

## 2. Publicar (Vercel)

1. Entre em https://vercel.com com a sua conta do GitHub.
2. Clique em **Add New… → Project** e importe o repositório **manychat**.
3. Em **Environment Variables**, adicione:

   | Nome | Valor |
   | --- | --- |
   | `DATABASE_URL` | a URL do Transaction pooler (porta 6543) |
   | `DIRECT_URL` | a URL do Session pooler (porta 5432) |
   | `SITE_PASSWORD` | uma senha pra entrar no site |

4. Clique em **Deploy**.

Durante a publicação, as tabelas são criadas sozinhas. O comando usado é o `prisma migrate deploy`, que **nunca apaga dados**.

## 3. Entrar

Abra o endereço que a Vercel mostrar e acrescente `/fluxos` no fim. O navegador vai pedir:
- **usuário:** `fluxo`;
- **senha:** a que você colocou em `SITE_PASSWORD`.

O site começa vazio. Clique em **Automação rápida** para criar a primeira.

## Branch

Enquanto o trabalho estiver na branch `claude/friendly-euler-lkfig3`:
- A Vercel publica essa branch como **Preview**, com um link próprio. Use esse link.
- Outra opção: em **Settings → Git → Production Branch**, coloque `claude/friendly-euler-lkfig3`.

Depois de juntar tudo na `main`, volte a usar a `main`.
