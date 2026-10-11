import { getMetaSettings } from "./actions";
import { SettingsClient } from "./SettingsClient";

export const metadata = {
  title: "Ajustes & Conexão Meta · Fluxo",
  description: "Configuração do app no Meta for Developers, tokens de acesso, webhooks e revisão de permissões.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; username?: string; error?: string }>;
}) {
  const [settings, params] = await Promise.all([
    getMetaSettings(),
    searchParams,
  ]);

  return (
    <SettingsClient
      initialSettings={settings}
      oauthSuccess={params.connected === "true" ? params.username || true : false}
      oauthError={params.error || null}
    />
  );
}
