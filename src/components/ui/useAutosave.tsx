"use client";
// Salvamento automático: espera 1s sem mudanças e manda pro servidor.
// Se algo mudar durante o envio, salva de novo ao terminar; se der erro,
// tenta de novo na próxima mudança.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };
export type SaveState = { status: "saved" | "pending" | "saving" | "error"; at?: Date; error?: string };

const SAVE_DELAY_MS = 1000;

export function useAutosave<T>(value: T, save: (value: T) => Promise<SaveResult>) {
  const [state, setState] = useState<SaveState>({ status: "saved" });
  const [tick, setTick] = useState(0); // força nova tentativa depois de um envio
  const [, setClock] = useState(0); // atualiza o "Salvo há X"
  const serialized = useMemo(() => JSON.stringify(value), [value]);
  const lastSaved = useRef(serialized);
  const inFlight = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (serialized === lastSaved.current) return;
    setState((current) => (current.status === "saving" ? current : { status: "pending" }));
    const timer = setTimeout(async () => {
      if (inFlight.current) return; // quando o envio atual terminar, o efeito roda de novo
      inFlight.current = true;
      setState({ status: "saving" });
      try {
        const result = await saveRef.current(JSON.parse(serialized) as T);
        if (result.ok) {
          lastSaved.current = serialized;
          setState({ status: "saved", at: new Date(result.savedAt) });
          setTick((current) => current + 1);
        } else {
          setState({ status: "error", error: result.error });
        }
      } catch {
        setState({ status: "error", error: "sem conexão com o servidor" });
      } finally {
        inFlight.current = false;
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [serialized, tick]);

  // Atualiza o "Salvo há X" a cada 30s e avisa antes de fechar com mudança pendente.
  useEffect(() => {
    const interval = setInterval(() => setClock((current) => current + 1), 30_000);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (serialized !== lastSaved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [serialized]);

  const reportError = useCallback((error: string) => setState({ status: "error", error }), []);
  return { state, reportError };
}

export function saveLabel(state: SaveState): string {
  switch (state.status) {
    case "saving":
      return "Salvando…";
    case "pending":
      return "Alterações não salvas";
    case "error":
      return `Não foi possível salvar: ${state.error}`;
    case "saved":
      return state.at ? `Salvo ${timeAgo(state.at)}` : "Tudo salvo";
  }
}

/** Texto do estado do salvamento, no cabeçalho dos editores. */
export function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span
      className={`max-w-80 truncate text-sm ${state.status === "error" ? "text-danger" : "text-ink-subtle"}`}
      role="status"
      data-save-status={state.status}
    >
      {saveLabel(state)}
    </span>
  );
}
