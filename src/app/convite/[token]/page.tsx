import type { Metadata } from "next";
import { BrandWordmark } from "@/components/brand/BrandLogo";
import { findOpenInvitation } from "@/lib/team/team";
import { getCurrentActor } from "@/lib/tenancy";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Convite · instachat", robots: { index: false, follow: false } };

const ROLE_LABEL = { OWNER: "dono", ADMIN: "administrador", OPERATOR: "atendente" } as const;

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, actor] = await Promise.all([findOpenInvitation(token), getCurrentActor()]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-100 px-4">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <BrandWordmark height={32} />
        </div>
        <div className="rounded-2xl border border-border bg-surface-200 p-7 shadow-sm">
          {!invitation ? (
            <>
              <h1 className="mb-2 text-[20px] font-extrabold text-ink">Convite indisponível</h1>
              <p className="text-sm text-ink-muted">Este link venceu ou já foi usado. Peça um link novo para quem convidou você.</p>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-[20px] font-extrabold text-ink">Entrar na equipe {invitation.workspace.name}</h1>
              <p className="mb-6 text-sm text-ink-muted">
                Convite para <strong className="text-ink">{invitation.email}</strong> como {ROLE_LABEL[invitation.role]}.
              </p>
              <AcceptInviteForm
                token={token}
                mode={!actor ? "signup" : actor.email.toLowerCase() === invitation.email ? "accept" : "wrong-user"}
                signedInEmail={actor?.email ?? null}
                loginHref={`/login?next=${encodeURIComponent(`/convite/${token}`)}`}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
