import { listContacts, listAllTags } from "./actions";
import { ContactsClient } from "./ContactsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contatos · Fluxo",
  description: "Gerencie todos os leads e contatos capturados no Instagram com filtros e etiquetas.",
};

export default async function ContactsPage() {
  const [initialContacts, tags] = await Promise.all([
    listContacts({}),
    listAllTags(),
  ]);

  return <ContactsClient initialContacts={initialContacts} availableTags={tags} />;
}
