import Link from "next/link";
import { CircleAlert, PauseCircle } from "lucide-react";

type Props = { status: string; username: string };

/**
 * Faixa fixa no topo do conteúdo quando o perfil ativo não está conectado.
 * Não é dispensável: some só quando o estado muda. Ícone + texto (cor nunca é o único sinal).
 */
export function AccountStatusBanner({ status, username }: Props) {
  if (status === "EXPIRED") {
    return (
      <Banner
        tone="warning"
        icon={<CircleAlert size={18} aria-hidden />}
        text={`O acesso do Instagram expirou — as automações de @${username} estão pausadas.`}
        linkLabel="Reconectar"
      />
    );
  }
  if (status === "DISCONNECTED") {
    return (
      <Banner
        tone="danger"
        icon={<PauseCircle size={18} aria-hidden />}
        text={`@${username} está descarregado — as automações estão paradas. Seus dados continuam guardados.`}
        linkLabel="Carregar perfil"
      />
    );
  }
  return null;
}

function Banner({
  tone,
  icon,
  text,
  linkLabel,
}: {
  tone: "warning" | "danger";
  icon: React.ReactNode;
  text: string;
  linkLabel: string;
}) {
  const palette =
    tone === "warning" ? "border-warning bg-warning-soft" : "border-danger bg-danger-soft";
  const iconColor = tone === "warning" ? "text-warning" : "text-danger";
  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 text-sm text-ink sm:px-8 ${palette}`}>
      <span className={`shrink-0 ${iconColor}`}>{icon}</span>
      <span className="min-w-0 flex-1 font-medium">{text}</span>
      <Link href="/ajustes" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
        {linkLabel}
      </Link>
    </div>
  );
}
