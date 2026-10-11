import { listDeadEvents, listFailedSends, retryFailedSendForm } from "./actions";

export const metadata = {
  title: "Envios com falha · Fluxo",
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
        <p className="mt-1 text-sm text-zinc-500">
          Nada falha invisível: mensagens recusadas pela Meta e eventos mortos na fila, com o motivo.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : failed.length === 0 && dead.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
          Nenhum envio com falha. Tudo que saiu foi aceito pela Meta.
        </div>
      ) : (
        <>
          {failed.length > 0 && (
            <section aria-labelledby="falhas-envios" className="mb-10">
              <h2 id="falhas-envios" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Mensagens recusadas ({failed.length})
              </h2>
              <ul className="space-y-3">
                {failed.map((item) => (
                  <li
                    key={item.messageId}
                    className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        @{item.contactUsername || item.contactIgsid}
                        <span className="ml-2 text-xs text-zinc-400">{item.kind}</span>
                      </span>
                      <time className="text-xs text-zinc-400" dateTime={item.createdAt}>
                        {formatarData(item.createdAt)}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                      {item.text || "[sem texto]"}
                    </p>
                    <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                      {item.error}
                      {item.flowName ? ` · fluxo: ${item.flowName}` : ""}
                      {item.runStatus ? ` · execução: ${item.runStatus}` : ""}
                    </p>
                    {item.retryable ? (
                      <form action={retryFailedSendForm} className="mt-3">
                        <input type="hidden" name="messageId" value={item.messageId} />
                        <button
                          type="submit"
                          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                        >
                          Reenviar e retomar fluxo
                        </button>
                      </form>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">
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
              <h2 id="falhas-fila" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Eventos mortos na fila ({dead.length})
              </h2>
              <ul className="space-y-2">
                {dead.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {event.type}
                        <span className="ml-2 text-xs text-amber-700">
                          {event.attempts} tentativa(s)
                        </span>
                      </span>
                      <time className="text-xs text-amber-600" dateTime={event.receivedAt}>
                        {formatarData(event.receivedAt)}
                      </time>
                    </div>
                    {event.lastError && <p className="mt-1 text-xs text-amber-800">{event.lastError}</p>}
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
