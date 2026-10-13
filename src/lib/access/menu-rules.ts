// Regras puras do menu do usuário por papel (ADR-009). A tela só esconde; o servidor confere de novo.
import type { FeatureKey } from "@/lib/billing/plan-rules";

export type MenuRole = "SUPERADMIN" | "OWNER" | "ADMIN" | "OPERATOR";

export const ROLE_BADGE: Record<MenuRole, string> = {
  SUPERADMIN: "Super Admin",
  OWNER: "Dono da conta",
  ADMIN: "Administrador",
  OPERATOR: "Atendente",
};

export type MenuItemKey = "minha-conta" | "contas" | "equipe" | "plano" | "ajustes" | "admin" | "privacidade" | "termos";

/** Itens do menu do avatar, em ordem. Atendente não vê cobrança, ajustes nem gestão de perfis. */
export function menuItemsFor(role: MenuRole): MenuItemKey[] {
  const manager = role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN";
  return [
    "minha-conta",
    ...(manager ? (["contas"] as const) : []),
    "equipe",
    ...(manager ? (["plano", "ajustes"] as const) : []),
    ...(role === "SUPERADMIN" ? (["admin"] as const) : []),
    "privacidade",
    "termos",
  ];
}

export type FeatureFlags = Record<FeatureKey, boolean>;
export const ALL_FEATURES_ON: FeatureFlags = { ai: true, broadcast: true, autoposter: true };
