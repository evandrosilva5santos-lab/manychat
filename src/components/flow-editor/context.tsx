"use client";
// Dados compartilhados entre o canvas, as caixinhas e o painel da direita.
import { createContext, useContext } from "react";
import type { Node } from "@xyflow/react";
import type { CardButtonType } from "@/generated/prisma/enums";
import type { CatalogLookup } from "@/lib/flow/nodes";
import type { Problem } from "@/lib/flow/lint";
import type { EditorKind, EditorNodeData } from "@/lib/flow/types";

export type FlowNode = Node<EditorNodeData, EditorKind>;

export type CatalogCard = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  buttonTitle: string;
  buttonType: CardButtonType;
};

export type TagOption = { id: string; name: string };

export type EditorContextValue = {
  catalog: CatalogCard[];
  catalogLookup: CatalogLookup;
  tags: TagOption[];
  problemsByNode: Map<string, Problem[]>;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor fora do FlowEditor");
  return value;
}
