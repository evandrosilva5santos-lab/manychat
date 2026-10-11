import { ConectarClient } from "./ConectarClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conectar Instagram · Fluxo",
  description: "Conecte sua conta do Instagram para ativar automações de direct e comentários com segurança oficial Meta.",
};

export default async function ConectarPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; username?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <ConectarClient
      connected={params.connected === "true"}
      username={params.username || null}
      error={params.error || null}
    />
  );
}
