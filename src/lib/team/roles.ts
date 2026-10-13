// Regras puras de papel na equipe (usadas no servidor e na tela).
export type TeamRole = "OWNER" | "ADMIN" | "OPERATOR";

/** Quem pode dar qual papel: só o dono cria administradores. */
export function canAssign(actorRole: TeamRole, role: TeamRole): boolean {
  if (role === "OWNER") return false;
  return actorRole === "OWNER" || (actorRole === "ADMIN" && role === "OPERATOR");
}

/** Quem pode trocar a senha de quem: dono troca de todos (menos outro dono); admin só de atendente. */
export function canResetPassword(actorRole: TeamRole, targetRole: TeamRole): boolean {
  if (targetRole === "OWNER") return false;
  return actorRole === "OWNER" || (actorRole === "ADMIN" && targetRole === "OPERATOR");
}

