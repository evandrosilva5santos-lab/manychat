"use client";

import { ExternalLink, Eye, Link2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import {
  getReconnectWhatsAppLink,
  testAccountConnection,
  viewWorkspaceAsClient,
  type AdminActionResult,
} from "@/app/admin/actions";

type Props = {
  workspaceId: string;
  accountId: string;
  username: string;
};

export function AdminAccountActions({ workspaceId, accountId, username }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);

  function execute(operation: () => Promise<AdminActionResult>) {
    setResult(null);
    startTransition(async () => {
      const next = await operation();
      setResult(next);
      if (next.url) window.open(next.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex min-w-[180px] flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => execute(() => testAccountConnection(accountId))}
          className="fx-btn fx-btn-sm inline-flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
          Testar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => execute(() => getReconnectWhatsAppLink(workspaceId, accountId, username))}
          className="fx-btn fx-btn-sm inline-flex items-center gap-1.5"
        >
          <Link2 size={13} />
          Reconectar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => execute(() => viewWorkspaceAsClient(workspaceId))}
          className="fx-btn fx-btn-sm inline-flex items-center gap-1.5"
        >
          <Eye size={13} />
          Ver como cliente
        </button>
      </div>
      {result && (
        <p className={`max-w-[220px] text-[11px] leading-4 ${result.ok ? "text-emerald-500" : "text-danger"}`} role="status">
          {result.ok ? result.message || (result.url ? "Link aberto em outra aba." : "Concluído.") : result.error}
          {result.url && <ExternalLink size={11} className="ml-1 inline" aria-hidden />}
        </p>
      )}
    </div>
  );
}
