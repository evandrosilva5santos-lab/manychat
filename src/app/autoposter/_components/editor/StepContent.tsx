"use client";

import { useState } from "react";
import { Hash, MessageCircle, PenLine } from "lucide-react";
import { CAPTION_MAX } from "@/lib/autoposter/constants";
import { isVideoUrl } from "@/lib/autoposter/media";
import { Avatar, MediaThumb } from "../../_ui/primitives";
import { MediaUploader } from "./MediaUploader";
import { formatErrors, type EditorAccount, type EditorLibrary, type EditorState } from "./PostEditor";

type Props = {
  projectId: string;
  state: EditorState;
  update: (patch: Partial<EditorState>) => void;
  library: EditorLibrary;
  accounts: EditorAccount[];
};

type PickerItem = { id: string; name: string; value: string };

function Picker({ label, icon, items, onPick, empty }: { label: string; icon: React.ReactNode; items: PickerItem[]; onPick: (value: string) => void; empty: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" className="ap-btn ap-btn-tertiary ap-btn-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {icon} {label}
      </button>
      {open && (
        <div role="menu" className="absolute top-9 left-0 z-20 w-72 rounded-xl bg-white py-2 shadow-lg ring-1 ring-ap-line">
          {items.length === 0 && <p className="px-4 py-2 text-xs text-ap-muted">{empty}</p>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left hover:bg-ap-bg"
              onClick={() => {
                onPick(item.value);
                setOpen(false);
              }}
            >
              <span className="block text-sm font-semibold text-ap-ink">{item.name}</span>
              <span className="block truncate text-xs text-ap-muted">{item.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StepContent({ projectId, state, update, library, accounts }: Props) {
  const [showComment, setShowComment] = useState(Boolean(state.firstComment));
  const account = accounts.find((item) => state.targets.some((key) => key.startsWith(`${item.id}:`))) ?? accounts[0];
  const username = account?.username ?? "conta";
  const problem = state.mediaUrls.length > 0 ? formatErrors(state) : null;
  const append = (text: string) => update({ caption: state.caption ? `${state.caption.trimEnd()}\n\n${text}` : text });

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="ap-title mb-3 text-lg">Mídia</h2>
          <MediaUploader projectId={projectId} urls={state.mediaUrls} onChange={(mediaUrls) => update({ mediaUrls })} />
          {problem && <p role="alert" className="mt-2 rounded-lg bg-ap-orange-soft px-3 py-2 text-sm text-ap-orange">{problem}</p>}
        </div>

        <label className="ap-field">
          <span className="ap-field-label">Título interno (opcional)</span>
          <input className="ap-input" maxLength={120} value={state.title} onChange={(event) => update({ title: event.target.value })} placeholder="Ex.: Promoção Dia das Crianças" />
        </label>

        <div>
          <label className="ap-field">
            <span className="ap-field-label">Legenda</span>
            <textarea
              className="ap-input !min-h-[180px]"
              maxLength={CAPTION_MAX}
              value={state.caption}
              onChange={(event) => update({ caption: event.target.value })}
              placeholder="Escreva a legenda do post…"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Picker
              label="Hashtags"
              icon={<Hash size={12} aria-hidden />}
              items={library.hashtags.map((item) => ({ id: item.id, name: item.name, value: item.hashtags }))}
              onPick={append}
              empty="Nenhum grupo de hashtags. Crie em Configurações."
            />
            <Picker
              label="Assinatura"
              icon={<PenLine size={12} aria-hidden />}
              items={library.signatures.map((item) => ({ id: item.id, name: item.name, value: item.content }))}
              onPick={append}
              empty="Nenhuma assinatura. Crie em Configurações."
            />
            <button type="button" className="ap-btn ap-btn-tertiary ap-btn-sm" onClick={() => setShowComment((value) => !value)}>
              <MessageCircle size={12} aria-hidden /> Primeiro comentário
            </button>
            <span className="ml-auto text-xs text-ap-muted">
              {state.caption.length}/{CAPTION_MAX}
            </span>
          </div>
        </div>

        {showComment && (
          <label className="ap-field">
            <span className="ap-field-label">Primeiro comentário (feed e reels)</span>
            <textarea className="ap-input" maxLength={CAPTION_MAX} value={state.firstComment} onChange={(event) => update({ firstComment: event.target.value })} placeholder="Ex.: hashtags ou link" />
          </label>
        )}

        {library.categories.length > 0 && (
          <label className="ap-field">
            <span className="ap-field-label">Categoria</span>
            <select className="ap-input" value={state.categoryId} onChange={(event) => update({ categoryId: event.target.value })}>
              <option value="">Sem categoria</option>
              {library.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <aside aria-label="Prévia" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-sm font-semibold text-ap-subtle">Prévia</p>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ap-line">
          <div className="mb-3 flex items-center gap-2">
            <Avatar src={account?.profilePicUrl} name={username} size={32} />
            <span className="text-sm font-semibold text-ap-ink">@{username}</span>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-ap-line">
            {state.mediaUrls[0] && isVideoUrl(state.mediaUrls[0]) ? (
              <video src={state.mediaUrls[0]} controls playsInline className="h-full w-full bg-black object-contain" />
            ) : (
              <MediaThumb url={state.mediaUrls[0]} className="h-full w-full" />
            )}
            {state.mediaUrls.length > 1 && <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">1/{state.mediaUrls.length}</span>}
          </div>
          <p className="mt-3 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap text-ap-ink">
            <strong className="mr-1">{username}</strong>
            {state.caption || <span className="text-ap-muted">Sua legenda aparece aqui.</span>}
          </p>
        </div>
      </aside>
    </div>
  );
}
