import { CheckCircle2 } from "lucide-react";

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Código de exclusão vindo da URL: só aceita o formato que o servidor gera. */
export function parseDeletionCode(value: string | string[] | undefined): string | null {
  return typeof value === "string" && CODE_PATTERN.test(value) ? value : null;
}

/** Aviso no topo de Ajustes depois de "Excluir perfil e dados" (o card do perfil já sumiu). */
export function DeletionNotice({ code }: { code: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-success bg-success-soft p-4 text-sm font-semibold text-ink"
    >
      <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden />
      <p>
        Exclusão iniciada. Pode levar alguns minutos (até 24 horas em perfis muito grandes).{" "}
        <a href={`/exclusao-de-dados?codigo=${encodeURIComponent(code)}`} className="underline">
          Acompanhar
        </a>
      </p>
    </div>
  );
}
