/**
 * Carga no webhook do Instagram (REQ-019): dispara N entregas assinadas
 * (com duplicadas de propósito), mede p50/p95/p99 da resposta HTTP e
 * confirma no Postgres que nenhum evento foi gravado duas vezes.
 *
 * Uso:
 *   npx tsx scripts/load-test-webhook.ts [n] [concurrency]
 * Requer: META_APP_SECRET (ou IG_APP_SECRET) no .env e o dev server no ar
 * (WEBHOOK_TARGET para sobrescrever a URL, ex. deploy de preview).
 */
import crypto from "crypto";
import { Client } from "pg";
import "dotenv/config";

const TARGET = process.env.WEBHOOK_TARGET || "http://localhost:3007/api/webhook/instagram";
const N = Number(process.argv[2]) || 100;
const CONCURRENCY = Number(process.argv[3]) || 10;
const SECRET = process.env.META_APP_SECRET || process.env.IG_APP_SECRET || "";

if (!SECRET) {
  console.error("META_APP_SECRET/IG_APP_SECRET não configurado — impossível assinar as entregas.");
  process.exit(1);
}

function signedPayload(commentId: string) {
  const body = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: "17841400000000001",
        time: Date.now(),
        changes: [
          {
            field: "comments",
            value: {
              id: commentId,
              text: "quero",
              from: { id: `lead_${commentId}`, username: "lead_carga" },
              media: { id: "media_carga" },
            },
          },
        ],
      },
    ],
  });
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  return { body, sig };
}

async function postOnce(commentId: string): Promise<number> {
  const { body, sig } = signedPayload(commentId);
  const start = performance.now();
  const res = await fetch(TARGET, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": sig },
    body,
  });
  const elapsed = performance.now() - start;
  if (!res.ok) console.error(`  ✗ ${commentId} → HTTP ${res.status}`);
  return elapsed;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  console.log(`Alvo: ${TARGET}`);
  console.log(`Disparando ${N} webhooks (concurrency ${CONCURRENCY}), incluindo duplicadas…\n`);

  const ids = Array.from({ length: N }, (_, i) => `carga_${Date.now()}_${i}`);
  // 20% de duplicadas exatas (mesma entrega reenviada pela Meta)
  const queue = [...ids, ...ids.slice(0, Math.floor(N * 0.2))];
  // embaralha para misturar únicas e duplicadas
  queue.sort(() => Math.random() - 0.5);

  const latencies: number[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const id = queue[cursor++];
      latencies.push(await postOnce(id));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = [...latencies].sort((a, b) => a - b);
  const report = {
    entregas: queue.length,
    unicas: ids.length,
    duplicadas: queue.length - ids.length,
    p50_ms: Math.round(percentile(sorted, 50)),
    p95_ms: Math.round(percentile(sorted, 95)),
    p99_ms: Math.round(percentile(sorted, 99)),
    max_ms: Math.round(sorted[sorted.length - 1]),
  };
  console.log("\nLatência HTTP:");
  console.table(report);

  // Confere no banco: exatamente 1 linha por comment_id único
  let url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  if (!/uselibpqcompat/.test(url)) url = url.replace("sslmode=require", "sslmode=require&uselibpqcompat=true");
  const client = new Client({ connectionString: url });
  await client.connect();
  const rows = await client.query(
    `SELECT idempotency_key, count(*)::int AS n
       FROM "WebhookEvent"
      WHERE idempotency_key LIKE '%:carga_%'
      GROUP BY 1`
  );
  const total = rows.rows.reduce((acc: number, r: { n: number }) => acc + r.n, 0);
  const dupKeys = rows.rows.filter((r: { n: number }) => r.n > 1);
  console.log(`Banco: ${total} linhas para ${ids.length} comment_ids únicos`);
  if (total !== ids.length || dupKeys.length > 0) {
    console.error(`✗ FALHA: duplicatas detectadas (${dupKeys.length} chaves repetidas)`);
    process.exitCode = 1;
  } else {
    console.log("✓ Idempotência confirmada: nenhuma duplicata no banco");
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
