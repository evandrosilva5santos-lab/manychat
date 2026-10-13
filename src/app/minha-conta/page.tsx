import type { Metadata } from "next";
import { CARD } from "@/components/ui/styles";
import { ROLE_BADGE } from "@/lib/access/menu-rules";
import { getMyAccount } from "@/lib/team/my-account";
import { NameForm, PasswordForm } from "./AccountForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta · instachat" };

export default async function MinhaContaPage() {
  const account = await getMyAccount();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Minha conta</h1>
        <p className="mt-1 text-sm text-ink-muted">{account.email}</p>
      </header>
      <section className={`${CARD} flex flex-col gap-2`} aria-labelledby="acessos">
        <h2 id="acessos" className="text-base font-bold text-ink">Onde você tem acesso</h2>
        {account.role === "SUPERADMIN" && <p className="text-sm font-semibold text-ink">Super Admin da plataforma</p>}
        <ul className="flex flex-col gap-1 text-sm text-ink">
          {account.memberships.map((member) => (
            <li key={member.workspace.id}>{member.workspace.name} <span className="text-ink-muted">· {ROLE_BADGE[member.role]}</span></li>
          ))}
        </ul>
      </section>
      <NameForm name={account.name} />
      <PasswordForm hasPassword={account.hasPassword} />
    </main>
  );
}
