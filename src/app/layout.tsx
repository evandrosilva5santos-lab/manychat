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
import { AccountStatusBanner } from "@/components/layout/AccountStatusBanner";
import { expiringTokenDays } from "@/components/layout/account-status";
import { getAccessContext } from "@/lib/access/context";
import { getUserMenuData } from "@/lib/tenancy";

export const metadata: Metadata = {
  title: "instachat · Automação de conversas",
  description: "Automação de conversas para Instagram",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [menu, access] = await Promise.all([getUserMenuData(), getAccessContext()]);
  const active = menu.accounts.find((account) => account.id === menu.activeAccountId) ?? null;
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      className={`${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-screen h-[100dvh] w-screen flex flex-row overflow-hidden bg-surface-100 text-ink">
        <Sidebar
          accounts={menu.accounts.map((account) => ({
            id: account.id,
            username: account.username,
            profilePicUrl: account.profilePicUrl,
            status: account.status,
          }))}
          activeAccountId={menu.activeAccountId}
          user={menu.actor ? { name: menu.actor.name, email: menu.actor.email, role: menu.actor.role, menuRole: access?.menuRole ?? "OPERATOR" } : null}
          features={access?.features ?? null}
        />
        <main className="flex-1 min-w-0 h-full flex flex-col overflow-y-auto overflow-x-hidden">
          {active && (
            <AccountStatusBanner status={active.status} username={active.username} expiringDays={expiringTokenDays(active)} />
          )}
          {children}
        </main>
      </body>
    </html>
  );
}
