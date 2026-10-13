import type { Metadata } from "next";
import { listTeam } from "@/lib/team/team";
import { getCurrentWorkspace, getWorkspaceRole, MANAGER_ROLES } from "@/lib/tenancy";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Equipe · instachat" };

export default async function EquipePage() {
  const { actor, workspace } = await getCurrentWorkspace();
  const [team, role] = await Promise.all([listTeam(workspace.id), getWorkspaceRole(actor, workspace.id)]);
  return (
    <TeamClient
      workspaceName={workspace.name}
      currentUserId={actor.id}
      canManage={role !== null && MANAGER_ROLES.includes(role)}
      currentRole={role ?? "OPERATOR"}
      members={team.members}
      invitations={team.invitations.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString() }))}
    />
  );
}
