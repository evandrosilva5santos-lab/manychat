import type { ReactNode } from "react";
import { canUseFeature } from "@/lib/access/context";
import type { FeatureKey } from "@/lib/billing/plan-rules";
import { FeatureLocked } from "./FeatureLocked";
import { PublicPathPassThrough } from "./PublicPathPassThrough";

/**
 * Mostra a ferramenta só para quem tem o recurso no plano. `publicPrefixes` ficam liberados
 * (ex.: portal de aprovação do cliente final, que não tem login).
 */
export async function FeatureGate({ feature, children, publicPrefixes = [] }: { feature: FeatureKey; children: ReactNode; publicPrefixes?: string[] }) {
  const { allowed, context } = await canUseFeature(feature);
  if (allowed) return <>{children}</>;
  return (
    <PublicPathPassThrough prefixes={publicPrefixes} locked={<FeatureLocked feature={feature} role={context?.menuRole ?? null} />}>
      {children}
    </PublicPathPassThrough>
  );
}
