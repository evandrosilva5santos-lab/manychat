import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "../../design-system/components/bundle.css";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500"],
});

import { Sidebar } from "@/components/layout/Sidebar";
import { AccountSwitcher } from "@/components/layout/AccountSwitcher";
import { AccountStatusBanner } from "@/components/layout/AccountStatusBanner";
import { getTenantContext, listAccessibleAccounts } from "@/lib/tenancy";

export const metadata: Metadata = {
  title: "Fluxo · Automação de conversas",
  description: "Automação de conversas para Instagram",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tenant = await getTenantContext();
  const accounts = tenant.actor ? await listAccessibleAccounts(tenant.actor) : [];
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      className={`${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-screen h-[100dvh] w-screen flex flex-row overflow-hidden bg-surface-100 text-ink">
        <Sidebar isSuperAdmin={tenant.actor?.role === "SUPERADMIN"} />
        <main className="flex-1 min-w-0 h-full flex flex-col overflow-y-auto overflow-x-hidden">
          <header className="sticky top-0 z-30 flex min-h-14 items-center justify-end border-b border-border bg-surface-100/95 px-4 backdrop-blur sm:px-8">
            <AccountSwitcher
              accounts={accounts.map((account) => ({ id: account.id, username: account.username, profilePicUrl: account.profilePicUrl, status: account.status }))}
              activeAccountId={tenant.account?.id ?? null}
            />
          </header>
          {tenant.account && <AccountStatusBanner status={tenant.account.status} username={tenant.account.username} />}
          {children}
        </main>
      </body>
    </html>
  );
}
