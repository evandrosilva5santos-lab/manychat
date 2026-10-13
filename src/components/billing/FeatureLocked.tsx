import Link from "next/link";
import { Lock } from "lucide-react";
import { PRIMARY_BUTTON } from "@/components/ui/styles";
import type { MenuRole } from "@/lib/access/menu-rules";
import { FEATURES, type FeatureKey } from "@/lib/billing/plan-rules";

/** Tela no lugar da ferramenta quando o plano não inclui o recurso. */
export function FeatureLocked({ feature, role }: { feature: FeatureKey; role: MenuRole | null }) {
  const canUpgrade = role === "OWNER" || role === "ADMIN";
  return (
    <main className="fx mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-300 text-ink-muted">
        <Lock size={26} aria-hidden />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{FEATURES[feature]} não está no seu plano</h1>
      <p className="text-sm text-ink-muted">
        {canUpgrade
          ? "Escolha um plano que inclua este recurso para liberar agora."
          : "Peça ao dono da conta para mudar o plano e liberar este recurso para a equipe."}
      </p>
      {canUpgrade && <Link href="/plano" className={PRIMARY_BUTTON}>Ver planos</Link>}
    </main>
  );
}
