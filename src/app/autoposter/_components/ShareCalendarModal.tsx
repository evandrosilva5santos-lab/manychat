"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Link2 } from "lucide-react";
import { setCalendarShare } from "@/lib/autoposter/actions/projects";
import { Modal } from "../_ui/Modal";

/** "Compartilhar calendário": o link é criado ao abrir, como no Flux. */
export function ShareCalendarModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await setCalendarShare(projectId, true);
      if (result.ok) setToken(result.data.token);
      else setError(result.error);
    });
  }, [projectId]);

  const url = token ? `${window.location.origin}/autoposter/calendario/${token}` : "";

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const disable = () =>
    startTransition(async () => {
      const result = await setCalendarShare(projectId, false);
      if (!result.ok) return setError(result.error);
      onClose();
    });

  return (
    <Modal
      title="Compartilhar calendário"
      onClose={onClose}
      width="lg"
      footer={
        <>
          <button type="button" className="ap-btn ap-btn-danger" disabled={pending || !token} onClick={disable}>
            Desativar link
          </button>
          <button type="button" className="ap-btn ap-btn-primary" disabled={!token} onClick={copy}>
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </>
      }
    >
      <p className="text-ap-ink">
        Compartilhe este link para que outras pessoas possam acompanhar o calendário de postagens. Quem tiver acesso poderá ver os <strong>posts agendados</strong> e{" "}
        <strong>publicados</strong>, mas não poderá editar ou realizar ações.
      </p>
      <p className="mt-5 text-ap-ink">Você pode desativar o link a qualquer momento. Ao desativar, ele deixará de funcionar e um novo link poderá ser gerado quando quiser.</p>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-ap-line-strong px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ap-line text-ap-subtle">
          <Link2 size={16} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ap-ink">{token ? url : pending ? "Gerando link…" : ""}</span>
        <button type="button" onClick={copy} disabled={!token} className="text-ap-subtle hover:text-ap-ink" aria-label="Copiar link">
          <Copy size={18} aria-hidden />
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-ap-red">{error}</p>}
    </Modal>
  );
}
