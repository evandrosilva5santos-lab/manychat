import { listConversations, getConversationThread, type ConversationSummary, type MessageItem } from "./actions";
import { listAllTags } from "@/app/contatos/actions";
import { InboxClient } from "./InboxClient";

export const metadata = {
  title: "Conversas (Live Inbox) · instachat",
  description: "Bate-papo ao vivo e histórico de conversas no Direct do Instagram com janela de 24 horas da Meta.",
};

const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar as conversas do banco de dados. Verifique se o DATABASE_URL está configurado e se o banco está acessível.";

export default async function ConversasPage(props: PageProps<"/conversas">) {
  const searchParams = await props.searchParams;
  const targetContactId = typeof searchParams.contactId === "string" ? searchParams.contactId : undefined;

  let conversations: ConversationSummary[] = [];
  let loadError: string | null = null;
  try {
    conversations = await listConversations("all");
  } catch (err) {
    console.error("[conversas] Falha ao listar conversas", err);
    loadError = LOAD_ERROR_MESSAGE;
  }

  const availableTags = loadError ? [] : await listAllTags();
  const activeContactId = targetContactId || conversations[0]?.contact.id || null;

  let initialThread: MessageItem[] = [];
  if (activeContactId && !loadError) {
    const thread = await getConversationThread(activeContactId);
    if (thread.ok) initialThread = thread.messages;
    else loadError = thread.error;
  }

  return (
    <InboxClient
      initialConversations={conversations}
      initialActiveContactId={activeContactId}
      initialThread={initialThread}
      availableTags={availableTags}
      loadError={loadError}
    />
  );
}
