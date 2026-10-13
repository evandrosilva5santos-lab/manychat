import type { Metadata } from "next";
import { getUserMenuData } from "@/lib/tenancy";
import { ContasClient } from "./ContasClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contas do Instagram · instachat" };

export default async function ContasPage() {
  const menu = await getUserMenuData();
  return (
    <ContasClient
      accounts={menu.accounts.map((account) => ({
        id: account.id,
        username: account.username,
        name: account.name,
        profilePicUrl: account.profilePicUrl,
        status: account.status,
        authProvider: account.authProvider,
        tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
      }))}
      activeAccountId={menu.activeAccountId}
      signedIn={menu.actor !== null}
    />
  );
}
