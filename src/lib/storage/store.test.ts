import { describe, expect, it } from "vitest";
import {
  createStoredFlow,
  deleteStoredFlow,
  duplicateStoredFlow,
  getStoredContacts,
  getStoredFlow,
  getStoredMessages,
  addStoredMessage,
  listStoredFlows,
  renameStoredFlow,
  saveStoredFlow,
  updateStoredContactTags,
  updateStoredFlowStatus,
} from "./store";
import { defaultRecipe } from "../flow/recipe";

describe("Store de Persistência Híbrida (store.ts)", () => {
  it("carrega o fluxo inicial de demonstração demo-casamento", async () => {
    const flow = await getStoredFlow("demo-casamento");
    expect(flow).not.toBeNull();
    expect(flow?.id).toBe("demo-casamento");
    expect(flow?.status).toBe("LIVE");
    expect(flow?.recipe).toBeDefined();
    expect(flow?.recipe?.trigger.keywords).toContain("casamento");
  });

  it("permite criar, renomear, alternar status e excluir fluxos", async () => {
    // 1. Criação
    const recipe = defaultRecipe();
    recipe.trigger.keywords = ["vip", "acesso"];
    const created = await createStoredFlow({
      name: "Fluxo de Teste Persistente",
      mode: "SIMPLE",
      recipe,
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Fluxo de Teste Persistente");

    // 2. Busca
    const found = await getStoredFlow(created.id);
    expect(found?.recipe?.trigger.keywords).toEqual(["vip", "acesso"]);

    // 3. Atualizar status
    const statusUpdated = await updateStoredFlowStatus(created.id, "STOPPED");
    expect(statusUpdated).toBe(true);
    const afterStatus = await getStoredFlow(created.id);
    expect(afterStatus?.status).toBe("STOPPED");

    // 4. Renomear
    const renamed = await renameStoredFlow(created.id, "Fluxo Renomeado");
    expect(renamed).toBe(true);
    const afterRename = await getStoredFlow(created.id);
    expect(afterRename?.name).toBe("Fluxo Renomeado");

    // 5. Duplicar
    const cloned = await duplicateStoredFlow(created.id);
    expect(cloned).not.toBeNull();
    expect(cloned?.name).toBe("Fluxo Renomeado (Cópia)");
    expect(cloned?.status).toBe("DRAFT");

    // 6. Excluir original e clone
    await deleteStoredFlow(created.id);
    await deleteStoredFlow(cloned!.id);

    expect(await getStoredFlow(created.id)).toBeNull();
    expect(await getStoredFlow(cloned!.id)).toBeNull();
  });

  it("persiste mensagens e tags nos contatos", async () => {
    const contacts = await getStoredContacts();
    expect(contacts.length).toBeGreaterThan(0);
    const contactId = contacts[0].id;

    // Adiciona tag
    const newTags = [...contacts[0].tags, { id: "tag-test", name: "teste-tag" }];
    await updateStoredContactTags(contactId, newTags);
    const updatedContacts = await getStoredContacts();
    const updatedContact = updatedContacts.find((c) => c.id === contactId);
    expect(updatedContact?.tags.some((t) => t.id === "tag-test")).toBe(true);

    // Adiciona mensagem ao histórico
    await addStoredMessage(contactId, {
      id: `m-test-${Date.now()}`,
      direction: "OUT",
      kind: "TEXT",
      text: "Mensagem de teste de persistência",
      createdAt: new Date().toISOString(),
    });

    const messages = await getStoredMessages(contactId);
    expect(messages.some((m) => m.text === "Mensagem de teste de persistência")).toBe(true);
  });
});
