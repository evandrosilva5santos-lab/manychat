import { listConversations, getConversationThread } from "./actions";
import { listAllTags } from "@/app/contatos/actions";
import { InboxClient } from "./InboxClient";

export const metadata = {
  title: "Conversas (Live Inbox) · ManyChat",
  description: "Bate-papo ao vivo e histórico de conversas no Direct do Instagram com janela de 24 horas da Meta.",
};

export default async function ConversasPage(props: PageProps<"/conversas">) {
  const searchParams = await props.searchParams;
  const targetContactId = typeof searchParams.contactId === "string" ? searchParams.contactId : undefined;

  const [conversations, availableTags] = await Promise.all([
    listConversations("all"),
    listAllTags(),
  ]);

  const activeContactId = targetContactId || conversations[0]?.contact.id || null;
  const initialThread = activeContactId ? await getConversationThread(activeContactId) : [];

  return (
    <InboxClient
      initialConversations={conversations}
      initialActiveContactId={activeContactId}
      initialThread={initialThread}
      availableTags={availableTags}
    />
  );
}
