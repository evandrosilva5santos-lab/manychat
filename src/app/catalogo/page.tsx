import { listCatalogItems } from "./actions";
import { CatalogClient } from "./CatalogClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catálogo de Cards · Fluxo",
  description: "Gerencie cards visuais reutilizáveis para envio de carrosséis no Direct do Instagram.",
};

export default async function CatalogoPage() {
  const initialItems = await listCatalogItems();

  return <CatalogClient initialItems={initialItems} />;
}
