import { getMetaSettings } from "./actions";
import { SettingsClient } from "./SettingsClient";
import { parseDeletionCode } from "./DeletionNotice";

// A exclusão roda dentro da server action desta página: precisa do mesmo teto do cron.
export const maxDuration = 60;

export const metadata = {
  title: "Ajustes & Conexão Meta · instachat",
  description: "Configuração do app no Meta for Developers, tokens de acesso, webhooks e revisão de permissões.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; username?: string; error?: string; excluido?: string | string[] }>;
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
      deletionCode={parseDeletionCode(params.excluido)}
    />
  );
}
