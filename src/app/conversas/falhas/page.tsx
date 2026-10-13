import { listDeadEvents, listFailedSends, retryFailedSendForm } from "./actions";

export const metadata = {
  title: "Envios com falha · instachat",
  description: "Envios recusados pela Meta e eventos mortos na fila, com motivo legível e reenvio quando permitido.",
};

export const dynamic = "force-dynamic";

const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar os envios com falha. Verifique o banco de dados e tente novamente.";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function FalhasPage() {
  let failed: Awaited<ReturnType<typeof listFailedSends>> = [];
  let dead: Awaited<ReturnType<typeof listDeadEvents>> = [];
  let loadError: string | null = null;

  try {
    [failed, dead] = await Promise.all([listFailedSends(), listDeadEvents()]);
  } catch (err) {
    console.error("[falhas] Falha ao listar envios com falha", err);
    loadError = LOAD_ERROR_MESSAGE;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Envios com falha</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Nada falha invisível: mensagens recusadas pela Meta e eventos mortos na fila, com o motivo.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : failed.length === 0 && dead.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-200 p-8 text-center text-sm text-ink-muted">
          Nenhum envio com falha. Tudo que saiu foi aceito pela Meta.
        </div>
      ) : (
        <>
          {failed.length > 0 && (
            <section aria-labelledby="falhas-envios" className="mb-10">
              <h2 id="falhas-envios" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Mensagens recusadas ({failed.length})
              </h2>
              <ul className="space-y-3">
                {failed.map((item) => (
                  <li
                    key={item.messageId}
                    className="rounded-lg border border-border bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        @{item.contactUsername || item.contactIgsid}
                        <span className="ml-2 text-xs text-ink-subtle">{item.kind}</span>
                      </span>
                      <time className="text-xs text-ink-subtle" dateTime={item.createdAt}>
                        {formatarData(item.createdAt)}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink">
                      {item.text || "[sem texto]"}
                    </p>
                    <p className="mt-2 rounded bg-danger-soft px-2 py-1 text-xs text-danger">
                      {item.error}
                      {item.flowName ? ` · fluxo: ${item.flowName}` : ""}
                      {item.runStatus ? ` · execução: ${item.runStatus}` : ""}
                    </p>
                    {item.retryable ? (
                      <form action={retryFailedSendForm} className="mt-3">
                        <input type="hidden" name="messageId" value={item.messageId} />
                        <button
                          type="submit"
                          className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-surface-200 hover:opacity-90"
                        >
                          Reenviar e retomar fluxo
                        </button>
                      </form>
                    ) : (
                      <p className="mt-2 text-xs text-ink-subtle">
                        {item.runStatus === "FAILED"
                          ? "Reenvio disponível apenas para mensagens de texto."
                          : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dead.length > 0 && (
            <section aria-labelledby="falhas-fila">
              <h2 id="falhas-fila" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Eventos mortos na fila ({dead.length})
              </h2>
              <ul className="space-y-2">
                {dead.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {event.type}
                        <span className="ml-2 text-xs text-warning">
                          {event.attempts} tentativa(s)
                        </span>
                      </span>
                      <time className="text-xs text-warning" dateTime={event.receivedAt}>
                        {formatarData(event.receivedAt)}
                      </time>
                    </div>
                    {event.lastError && <p className="mt-1 text-xs text-warning">{event.lastError}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
