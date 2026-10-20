import { requireAutoposterActor } from "@/lib/autoposter/access";
import { listAccessibleAccounts } from "@/lib/tenancy";
import { ProjectForm } from "../../_components/ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const actor = await requireAutoposterActor();
  const accounts = await listAccessibleAccounts(actor);

  return (
    <>
      <header className="border-b border-ap-line">
        <div className="mx-auto flex w-full max-w-[1140px] items-center gap-4 px-4 py-10 sm:px-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ap-pink text-xl font-bold text-white" aria-hidden>
            N
          </span>
          <h1 className="ap-title text-[32px] leading-8">Novo projeto</h1>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1140px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[265px_1fr] md:gap-24">
        <div>
          <h2 className="ap-title text-2xl leading-7">Personalize seu projeto</h2>
          <p className="mt-2 text-ap-ink">Adicione um nome para o seu projeto e ajuste as suas preferências.</p>
        </div>
        <ProjectForm
          accounts={accounts.map((account) => ({
            id: account.id,
            username: account.username,
            profilePicUrl: account.profilePicUrl,
            status: account.status,
          }))}
        />
      </main>
    </>
  );
}
