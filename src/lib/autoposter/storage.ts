// Upload de mídia do Autoposter no Supabase Storage (bucket público, pois a Meta
// precisa baixar a imagem/vídeo por URL). O navegador envia direto para o Storage
// com uma URL assinada; a chave de serviço nunca sai do servidor.
import { randomUUID } from "node:crypto";
import { UserFacingError } from "@/lib/user-error";

export const MEDIA_BUCKET = "autoposter-media";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Teto global do plano atual do Supabase Storage (acima disso o bucket recusa).
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new UserFacingError("Upload de mídia indisponível: armazenamento não configurado.");
  return { url, headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" } };
}

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: MEDIA_BUCKET,
      name: MEDIA_BUCKET,
      public: true,
      file_size_limit: MAX_VIDEO_BYTES,
      allowed_mime_types: [...Object.keys(IMAGE_TYPES), ...Object.keys(VIDEO_TYPES)],
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    if (!/already exists|Duplicate|409/i.test(body)) {
      console.error("[autoposter/storage] bucket:", response.status, body.slice(0, 200));
      throw new UserFacingError("Não foi possível preparar o armazenamento de mídia.");
    }
  }
  bucketReady = true;
}

export function validateUpload(contentType: string, size: number): string {
  const ext = IMAGE_TYPES[contentType] ?? VIDEO_TYPES[contentType];
  if (!ext) throw new UserFacingError("Formato não aceito. Use JPG, PNG, WEBP, MP4 ou MOV.");
  const max = IMAGE_TYPES[contentType] ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(size) || size <= 0 || size > max) {
    throw new UserFacingError(IMAGE_TYPES[contentType] ? "Imagem acima de 8 MB." : "Vídeo acima de 50 MB.");
  }
  return ext;
}

export async function createSignedUpload(folder: string, contentType: string, size: number) {
  const ext = validateUpload(contentType, size);
  await ensureBucket();
  const { url, headers } = config();
  const path = `${folder.replace(/[^a-zA-Z0-9/_-]/g, "")}/${randomUUID()}.${ext}`;
  const response = await fetch(`${url}/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { url?: string };
  if (!response.ok || !data.url) throw new UserFacingError("Não foi possível iniciar o upload. Tente de novo.");
  return {
    uploadUrl: `${url}/storage/v1${data.url}`,
    publicUrl: `${url}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`,
  };
}
