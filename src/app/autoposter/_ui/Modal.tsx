"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
};

const WIDTH = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[720px]", xl: "max-w-[952px]" };

/** Modal do Flux: branco, raio 24px, título Quicksand azul e × no canto. */
export function Modal({ title, onClose, children, footer, width = "md" }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100dvh-4rem)] w-full ${WIDTH[width]} flex-col rounded-3xl bg-white shadow-xl outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-7 pb-4 sm:px-8">
          <h2 id={titleId} className="ap-title text-2xl leading-tight">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-ap-muted hover:bg-ap-line hover:text-ap-ink" aria-label="Fechar">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-8">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ap-line px-6 py-5 sm:px-8">{footer}</div>}
      </div>
    </div>
  );
}
