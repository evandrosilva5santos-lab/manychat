// Descobre a URL do banco. Aceita os nomes que nós usamos (DATABASE_URL / DIRECT_URL)
// e os que a integração Supabase da Vercel cria sozinha (POSTGRES_*).

/** Conexão do app (pooler). */
export function appDatabaseUrl(): string | undefined {
  return withSsl(process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL);
}

/**
 * Com `sslmode=require`, o driver `pg` passou a exigir verificação completa do certificado,
 * e o certificado do pooler do Supabase não está na lista padrão do Node — a conexão falha.
 * `uselibpqcompat=true` volta ao comportamento clássico: conexão criptografada, como no psql.
 */
function withSsl(url: string | undefined): string | undefined {
  if (!url || !/[?&]sslmode=require/.test(url) || /uselibpqcompat=/.test(url)) return url;
  return `${url}&uselibpqcompat=true`;
}
