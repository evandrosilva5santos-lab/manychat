import { listCatalogItems } from "./actions";
import { CatalogClient } from "./CatalogClient";

export const metadata = {
  title: "Catálogo de Cards · ManyChat",
  description: "Gerencie cards visuais reutilizáveis para envio de carrosséis no Direct do Instagram.",
};

export default async function CatalogoPage() {
  const initialItems = await listCatalogItems();

  return <CatalogClient initialItems={initialItems} />;
}
