"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)';

/**
 * Lógica compartilhada dos menus em popover: Esc e clique fora fecham, o foco
 * volta ao gatilho, setas/Home/End percorrem os itens e o primeiro item recebe
 * foco ao abrir. Os itens precisam ter role="menuitem".
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
  }, [open]);

  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = current;
    if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = current <= 0 ? items.length - 1 : current - 1;
    else if (event.key === "Home") next = 0;
    else next = items.length - 1;
    items[next]?.focus();
  }, []);

  const onTriggerKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  }, []);

  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": panelId,
    onClick: () => setOpen((value) => !value),
    onKeyDown: onTriggerKeyDown,
  };

  return { open, close, panelId, panelRef, triggerProps, onPanelKeyDown };
}

/** Painel: folha na base em telas estreitas; à direita da sidebar a partir de sm. Só opacity/transform. */
export const POPOVER_PANEL_CLASS =
  "fixed z-[60] flex max-h-[calc(100dvh-1rem)] flex-col overflow-y-auto rounded-xl border border-border-strong bg-surface-200 text-ink shadow-pop " +
  "inset-x-2 bottom-2 sm:inset-x-auto sm:left-[76px] sm:w-80 " +
  "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none";

export const POPOVER_ITEM_CLASS =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-ink " +
  "hover:bg-surface-300 focus-visible:bg-surface-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

/** Efeito de entrada: false no primeiro frame, true no seguinte. */
export function useEntered(active: boolean) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      setEntered(false);
    };
  }, [active]);
  return active && entered;
}
