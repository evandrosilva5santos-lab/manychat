import { getMetaSettings } from "./actions";
import { SettingsClient } from "./SettingsClient";

export const metadata = {
  title: "Ajustes & Conexão Meta · ManyChat",
  description: "Configuração do app no Meta for Developers, tokens de acesso, webhooks e revisão de permissões.",
};

export default async function SettingsPage() {
  const settings = await getMetaSettings();

  return <SettingsClient initialSettings={settings} />;
}
