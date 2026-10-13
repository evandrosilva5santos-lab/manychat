// Papel na equipe e recursos do plano da pessoa logada, para menus e telas bloqueadas.
// Só lê: não cria workspace (isso fica com getCurrentWorkspace nas páginas que precisam).
import { cookies } from "next/headers";
import { getEntitlements } from "@/lib/billing/entitlements";
import { FEATURES, hasFeature, type FeatureKey } from "@/lib/billing/plan-rules";
import { prisma } from "@/lib/prisma";
import { getCurrentActor, IMPERSONATION_COOKIE, type TenantActor } from "@/lib/tenancy";
import { ALL_FEATURES_ON, type FeatureFlags, type MenuRole } from "./menu-rules";

export type AccessContext = {
  actor: TenantActor;
  menuRole: MenuRole;
  workspaceId: string | null;
  features: FeatureFlags;
};

async function membershipFor(actor: TenantActor) {
  const members = await prisma.workspaceMember.findMany({
    where: { userId: actor.id },
    select: { role: true, workspaceId: true },
    orderBy: { createdAt: "asc" },
  });
  return members.find((member) => member.role === "OWNER") ?? members[0] ?? null;
}

async function featuresOf(workspaceId: string | null): Promise<FeatureFlags> {
  if (!workspaceId) return { ai: false, broadcast: false, autoposter: false };
  const entitlements = await getEntitlements(workspaceId);
  const keys = Object.keys(FEATURES) as FeatureKey[];
  return Object.fromEntries(keys.map((key) => [key, hasFeature(entitlements, key)])) as FeatureFlags;
}

export async function getAccessContext(): Promise<AccessContext | null> {
  const actor = await getCurrentActor();
  if (!actor) return null;
  if (actor.role === "SUPERADMIN") {
    const viewing = (await cookies()).get(IMPERSONATION_COOKIE)?.value ?? null;
    return { actor, menuRole: "SUPERADMIN", workspaceId: viewing, features: ALL_FEATURES_ON };
  }
  const member = await membershipFor(actor);
  return {
    actor,
    menuRole: member?.role ?? "OPERATOR",
    workspaceId: member?.workspaceId ?? null,
    features: await featuresOf(member?.workspaceId ?? null),
  };
}

/** `true` se a pessoa pode usar o recurso (Super Admin e operação interna sempre podem). */
export async function canUseFeature(feature: FeatureKey): Promise<{ allowed: boolean; context: AccessContext | null }> {
  const context = await getAccessContext();
  return { allowed: Boolean(context?.features[feature]), context };
}
