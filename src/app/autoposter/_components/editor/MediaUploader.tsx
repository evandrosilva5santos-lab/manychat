"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Link2, Loader2, X } from "lucide-react";
import { createMediaUpload } from "@/lib/autoposter/actions/projects";
import { MAX_MEDIA } from "@/lib/autoposter/constants";
import { isAcceptableMediaUrl } from "@/lib/autoposter/media";
import { MediaThumb } from "../../_ui/primitives";

type Props = { projectId: string; urls: string[]; onChange: (urls: string[]) => void };

export function MediaUploader({ projectId, urls, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_MEDIA - urls.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`No máximo ${MAX_MEDIA} mídias por post.`);
    setUploading((count) => count + list.length);
    const added: string[] = [];
    for (const file of list) {
      try {
        const signed = await createMediaUpload(projectId, file.type, file.size);
        if (!signed.ok) {
          setError(signed.error);
          continue;
        }
        const response = await fetch(signed.data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!response.ok) {
          setError("O envio do arquivo falhou. Tente de novo.");
          continue;
        }
        added.push(signed.data.publicUrl);
      } catch {
        setError("O envio do arquivo falhou. Confira sua conexão.");
      } finally {
        setUploading((count) => count - 1);
      }
    }
    if (added.length) onChange([...urls, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function addLink() {
    const value = link.trim();
    if (!isAcceptableMediaUrl(value)) return setError("Cole um link https público da imagem ou do vídeo.");
    if (urls.length >= MAX_MEDIA) return setError(`No máximo ${MAX_MEDIA} mídias por post.`);
    setError(null);
    onChange([...urls, value]);
    setLink("");
  }

  const move = (index: number, delta: number) => {
    const next = [...urls];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <div key={url} className="group relative h-28 w-24 overflow-hidden rounded-lg bg-ap-line ring-1 ring-ap-line">
            <MediaThumb url={url} className="h-full w-full" />
            <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white">{index + 1}</span>
            <button type="button" onClick={() => onChange(urls.filter((item) => item !== url))} className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-ap-red" aria-label="Remover mídia">
              <X size={14} aria-hidden />
            </button>
            {urls.length > 1 && (
              <span className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-full bg-white/90 p-0.5 disabled:invisible" aria-label="Mover para a esquerda">
                  <ArrowLeft size={12} aria-hidden />
                </button>
                <button type="button" disabled={index === urls.length - 1} onClick={() => move(index, 1)} className="rounded-full bg-white/90 p-0.5 disabled:invisible" aria-label="Mover para a direita">
                  <ArrowRight size={12} aria-hidden />
                </button>
              </span>
            )}
          </div>
        ))}
        {urls.length < MAX_MEDIA && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-28 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-ap-line-strong text-xs text-ap-subtle hover:border-ap-primary hover:text-ap-title"
          >
            {uploading > 0 ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <ImagePlus size={20} aria-hidden />}
            {uploading > 0 ? "Enviando…" : "Adicionar"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
        multiple
        className="sr-only"
        onChange={(event) => upload(event.target.files)}
        aria-label="Escolher imagens ou vídeos"
      />
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Colar link da mídia</span>
          <Link2 size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ap-muted" aria-hidden />
          <input
            className="ap-search"
            placeholder="Ou cole o link público de uma imagem/vídeo (https://…)"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLink();
              }
            }}
          />
        </label>
        <button type="button" className="ap-btn ap-btn-tertiary ap-btn-md" onClick={addLink} disabled={!link.trim()}>
          Adicionar link
        </button>
      </div>
      <p className="text-xs text-ap-muted">JPG, PNG ou WEBP até 8 MB; MP4 ou MOV até 50 MB. Duas ou mais mídias viram carrossel; use as setas para mudar a ordem.</p>
      {error && <p role="alert" className="text-sm text-ap-red">{error}</p>}
    </div>
  );
}
