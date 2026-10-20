// Publicação no Instagram pela Content Publishing API (contêiner → media_publish).
// Funciona com Instagram Login (graph.instagram.com) e Facebook Login (graph.facebook.com).
// Exige a permissão instagram_business_content_publish / instagram_content_publish.
import { GRAPH_API_VERSION } from "@/lib/meta/graph";
import type { MediaType, PostFormat } from "./constants";
import { isVideoUrl } from "./media";

export type PublishInput = {
  igUserId: string;
  token: string;
  provider: "instagram" | "facebook";
  format: PostFormat;
  mediaType: MediaType;
  mediaUrls: string[];
  caption: string;
  firstComment?: string | null;
};

export type PublishResult =
  | { ok: true; mediaId: string; permalink: string | null; warning?: string }
  | { ok: false; error: string; retryable: boolean; expired: boolean };

type FetchLike = typeof fetch;

export type PublisherDeps = { fetch: FetchLike; sleep: (ms: number) => Promise<void>; pollBudgetMs: number };

const defaultDeps: PublisherDeps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollBudgetMs: 40_000,
};

class GraphCallError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly expired: boolean) {
    super(message);
  }
}


function friendlyError(code: number | undefined, subcode: number | undefined, message: string | undefined): string {
  if (code === 190) return "Token expirado. Reconecte a conta do Instagram.";
  if (code === 10 || code === 200 || code === 3)
    return "A conta ainda não tem permissão de publicação (instagram_business_content_publish). Reconecte a conta depois que a Meta aprovar a permissão.";
  if (code === 9 || subcode === 2207042) return "Limite diário de publicações do Instagram atingido. Tente amanhã.";
  if (code === 36003 || subcode === 2207009) return "Proporção da imagem não aceita pelo Instagram (use entre 4:5 e 1.91:1).";
  if (subcode === 2207026) return "Formato de vídeo não aceito pelo Instagram.";
  if (subcode === 2207052 || subcode === 2207004) return "O Instagram não conseguiu baixar a mídia. Confira se o link é público.";
  return message ? `O Instagram recusou a publicação: ${message}` : "O Instagram recusou a publicação.";
}

async function call(
  deps: PublisherDeps,
  input: Pick<PublishInput, "token" | "provider">,
  path: string,
  body?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = `https://graph.${input.provider}.com/${GRAPH_API_VERSION}/${path}`;
  let response: Response;
  try {
    response = await deps.fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new GraphCallError("Sem resposta da API do Instagram.", true, false);
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const error = data.error as { message?: string; code?: number; error_subcode?: number; is_transient?: boolean } | undefined;
  if (!response.ok || error) {
    const code = error?.code;
    const retryable = code !== 190 && (Boolean(error?.is_transient) || [1, 2, 4, 17, 32, 613].includes(code ?? 0) || response.status >= 500 || response.status === 429);
    throw new GraphCallError(friendlyError(code, error?.error_subcode, error?.message), retryable, code === 190);
  }
  return data;
}

async function waitUntilReady(deps: PublisherDeps, input: PublishInput, containerId: string) {
  const deadline = Date.now() + deps.pollBudgetMs;
  for (;;) {
    const data = await call(deps, input, `${containerId}?fields=status_code`);
    const status = String(data.status_code ?? "FINISHED");
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new GraphCallError("O Instagram não conseguiu processar a mídia.", false, false);
    if (Date.now() >= deadline) throw new GraphCallError("O vídeo ainda está sendo processado pelo Instagram.", true, false);
    await deps.sleep(3_000);
  }
}

function mediaFields(url: string, extra: Record<string, string> = {}): Record<string, string> {
  return isVideoUrl(url) ? { video_url: url, ...extra } : { image_url: url, ...extra };
}

async function createContainer(deps: PublisherDeps, input: PublishInput): Promise<string> {
  const media = `${input.igUserId}/media`;
  const [first] = input.mediaUrls;
  if (input.format === "story") {
    const id = String((await call(deps, input, media, { media_type: "STORIES", ...mediaFields(first) })).id);
    if (isVideoUrl(first)) await waitUntilReady(deps, input, id);
    return id;
  }
  if (input.format === "reels" || (input.mediaType === "VIDEO" && input.mediaUrls.length === 1)) {
    const id = String((await call(deps, input, media, { media_type: "REELS", video_url: first, caption: input.caption, share_to_feed: "true" })).id);
    await waitUntilReady(deps, input, id);
    return id;
  }
  if (input.mediaUrls.length > 1) {
    const children: string[] = [];
    for (const url of input.mediaUrls) {
      const extra: Record<string, string> = { is_carousel_item: "true", ...(isVideoUrl(url) ? { media_type: "VIDEO" } : {}) };
      const id = String((await call(deps, input, media, mediaFields(url, extra))).id);
      if (isVideoUrl(url)) await waitUntilReady(deps, input, id);
      children.push(id);
    }
    return String((await call(deps, input, media, { media_type: "CAROUSEL", children: children.join(","), caption: input.caption })).id);
  }
  return String((await call(deps, input, media, { image_url: first, caption: input.caption })).id);
}

export async function publishToInstagram(input: PublishInput, deps: PublisherDeps = defaultDeps): Promise<PublishResult> {
  if (input.mediaUrls.length === 0) return { ok: false, error: "O post não tem mídia.", retryable: false, expired: false };
  try {
    const containerId = await createContainer(deps, input);
    const published = await call(deps, input, `${input.igUserId}/media_publish`, { creation_id: containerId });
    const mediaId = String(published.id);
    let permalink: string | null = null;
    let warning: string | undefined;
    try {
      permalink = String((await call(deps, input, `${mediaId}?fields=permalink`)).permalink ?? "") || null;
    } catch { /* o link é opcional */ }
    if (input.firstComment?.trim() && input.format !== "story") {
      try {
        await call(deps, input, `${mediaId}/comments`, { message: input.firstComment.trim() });
      } catch {
        warning = "Post publicado, mas o primeiro comentário não foi enviado.";
      }
    }
    return { ok: true, mediaId, permalink, warning };
  } catch (error) {
    if (error instanceof GraphCallError) return { ok: false, error: error.message, retryable: error.retryable, expired: error.expired };
    return { ok: false, error: "Erro inesperado ao publicar.", retryable: true, expired: false };
  }
}
