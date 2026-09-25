"use client";
// Coluna da esquerda: arraste uma caixinha pro canvas (ou clique pra adicionar no centro).
import { KIND_META, PALETTE } from "@/lib/flow/nodes";
import type { EditorKind } from "@/lib/flow/types";
import { KIND_ICON } from "./icons";

export const DRAG_MIME = "application/x-fluxo-kind";

export function Palette({ onAdd }: { onAdd: (kind: EditorKind) => void }) {
  return (
    <aside className="flex w-60 flex-none flex-col gap-2 overflow-y-auto border-r border-border bg-surface-200 p-4">
      <div className="text-[13px] font-medium text-ink-muted">Adicionar caixinha</div>
      <p className="text-xs text-ink-subtle">Arraste para o canvas ou clique.</p>
      {PALETTE.map((kind) => {
        const meta = KIND_META[kind];
        const Icon = KIND_ICON[kind];
        return (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(DRAG_MIME, kind);
              event.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAdd(kind)}
            className={`fx-node-${meta.category} flex cursor-grab items-center gap-3 rounded-md border border-border bg-surface-200 p-2 text-left shadow-card transition-colors duration-150 ease-out hover:bg-surface-300 active:cursor-grabbing`}
            data-kind={kind}
          >
            <span className="grid size-7 flex-none place-items-center rounded-sm" style={{ background: "var(--node)" }}>
              <Icon size={14} color="var(--surface-200)" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] leading-[18px] font-semibold">{meta.label}</span>
              <span className="block truncate text-xs text-ink-subtle">{meta.hint}</span>
            </span>
          </button>
        );
      })}
    </aside>
  );
}
