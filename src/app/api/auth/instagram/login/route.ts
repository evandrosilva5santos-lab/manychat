import { NextRequest, NextResponse } from "next/server";
import { readConnectInvite } from "@/lib/meta/connect-invite";
import {
  createOAuthState,
  getFacebookBusinessLoginUrl,
  getInstagramOAuthUrl,
  getInstagramRedirectUri,
  OAuthConfigError,
  type OAuthMode,
} from "@/lib/meta/oauth";
import {
  getCurrentActor,
  getOrCreateWorkspaceForActor,
  getWorkspaceRole,
  IMPERSONATION_COOKIE,
  MANAGER_ROLES,
  workspaceExists,
} from "@/lib/tenancy";

const ROLE_DENIED = "Seu papel na equipe não permite conectar perfis. Peça a um administrador.";

export const dynamic = "force-dynamic";

// Início do login. Dois caminhos independentes:
//   ?mode=instagram (padrão) → Instagram Login (qualquer conta profissional, sem Página)
//   ?mode=facebook           → Facebook Login (contas do Instagram ligadas a Páginas)
// O workspace que recebe a conta é decidido AQUI (sessão do painel ou convite do
// /conectar) e viaja assinado no `state`. Nunca há OAuth anônimo.

/**
 * Convite tem prioridade (link do cliente, já assinado); sem convite, usa a sessão
 * do painel — e só OWNER/ADMIN conectam perfis (ADR-008).
 */
async function resolveWorkspaceId(request: NextRequest, invite: string | null): Promise<string | null | typeof ROLE_DENIED> {
  if (invite) {
    const workspaceId = readConnectInvite(invite)?.workspaceId;
    return workspaceId && (await workspaceExists(workspaceId)) ? workspaceId : null;
  }
  const actor = await getCurrentActor();
  if (!actor) return null;
  const viewing = actor.role === "SUPERADMIN" ? request.cookies.get(IMPERSONATION_COOKIE)?.value : undefined;
  if (viewing && (await workspaceExists(viewing))) return viewing;
  const workspaceId = (await getOrCreateWorkspaceForActor(actor)).id;
  const role = await getWorkspaceRole(actor, workspaceId);
  return role && MANAGER_ROLES.includes(role) ? workspaceId : ROLE_DENIED;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const fromConectar = searchParams.get("from") === "conectar";
  const invite = searchParams.get("convite");
  const mode: OAuthMode = searchParams.get("mode") === "facebook" ? "facebook" : "instagram";

  const returnUrl = new URL(fromConectar ? "/conectar" : "/ajustes", origin);
  if (fromConectar && invite) returnUrl.searchParams.set("convite", invite);
  const fail = (message: string) => {
    const url = new URL(returnUrl);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 302);
  };

  try {
    const workspaceId = await resolveWorkspaceId(request, invite);
    if (workspaceId === ROLE_DENIED) return fail(ROLE_DENIED);
    if (!workspaceId) {
      return fail(
        fromConectar
          ? "Link de conexão inválido ou expirado. Peça um novo link a quem cuida da sua conta."
          : "Sessão expirada. Entre no painel novamente."
      );
    }
    const redirectUri = getInstagramRedirectUri(request);
    const state = createOAuthState({ mode, workspaceId, returnTo: returnUrl.toString() });
    const authUrl =
      mode === "facebook" ? getFacebookBusinessLoginUrl(redirectUri, state) : getInstagramOAuthUrl(redirectUri, state);
    return NextResponse.redirect(authUrl, 302);
  } catch (error) {
    // Configuração errada (ex.: IG_APP_ID = ID do App da Meta) aparece na tela, sem ir à Meta.
    if (error instanceof OAuthConfigError) return fail(error.message);
    console.error("[oauth/login] Falha ao iniciar o login", { mode, error: error instanceof Error ? error.message : String(error) });
    return fail("Não foi possível iniciar a conexão. Tente novamente.");
  }
}
