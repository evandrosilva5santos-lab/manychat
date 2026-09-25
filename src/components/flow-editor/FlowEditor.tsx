"use client";
// O editor visual: paleta à esquerda, canvas do React Flow no meio, painel à direita.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import type { FlowStatus } from "@/generated/prisma/enums";
import { createTag, renameFlow, saveFlow } from "@/app/fluxos/actions";
import { lintFlow, type Problem } from "@/lib/flow/lint";
import { hasInput, newId, newNodeData, outputHandles, type CatalogLookup } from "@/lib/flow/nodes";
import { STATUS_BADGE, timeAgo } from "@/lib/format";
import {
  triggerNodeId,
  type EditorEdge,
  type EditorKind,
  type EditorNode,
  type EditorNodeData,
  type FlowSnapshot,
} from "@/lib/flow/types";
import { EditorContext, type CatalogCard, type FlowNode, type TagOption } from "./context";
import { Inspector } from "./Inspector";
import { DRAG_MIME, Palette } from "./Palette";
import { StepNode } from "./StepNode";

// Todos os tipos usam o mesmo componente; ele muda o conteúdo pelo `kind`.
const nodeTypes: NodeTypes = Object.fromEntries(
  (["TRIGGER", "MESSAGE", "QUESTION", "CAROUSEL", "FOLLOW_GATE", "CONDITION", "DELAY", "ADD_TAG", "NOTE"] as const).map(
    (kind) => [kind, StepNode],
  ),
);

const SAVE_DELAY_MS = 1000;

type SaveState = { status: "saved" | "pending" | "saving" | "error"; at?: Date; error?: string };

type Props = {
  flow: { id: string; name: string; folder: string | null; status: FlowStatus };
  initial: FlowSnapshot;
  tags: TagOption[];
  catalog: CatalogCard[];
};

const toFlowNode = (node: EditorNode): FlowNode => ({ ...node });
const toFlowEdge = (edge: EditorEdge): Edge => ({ ...edge });

/** Só o que importa pro banco — seleção e arrasto não contam como mudança. */
function snapshotOf(nodes: FlowNode[], edges: Edge[], viewport: Viewport | null): FlowSnapshot {
  return {
    viewport,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type as EditorKind,
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? null,
      target: edge.target,
    })),
  };
}

function Editor({ flow, initial, tags: initialTags, catalog }: Props) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes.map(toFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges.map(toFlowEdge));
  const [viewport, setViewport] = useState<Viewport | null>(initial.viewport);
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState(flow.name);
  const [save, setSave] = useState<SaveState>({ status: "saved" });
  const [saveTick, setSaveTick] = useState(0); // força nova tentativa depois de um envio
  const [, setClock] = useState(0); // atualiza o "Salvo há X"
  const savedName = useRef(flow.name);

  const catalogLookup: CatalogLookup = useMemo(() => {
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return (id) => byId.get(id);
  }, [catalog]);

  const selected = nodes.find((node) => node.selected) ?? null;

  // Primeira vez que o fluxo abre (sem zoom salvo): enquadra todas as caixinhas
  // depois que o React Flow mediu o tamanho de cada uma.
  const nodesInitialized = useNodesInitialized();
  const fitted = useRef(initial.viewport !== null);
  useEffect(() => {
    if (nodesInitialized && !fitted.current) {
      fitted.current = true;
      void fitView({ padding: 0.15, maxZoom: 1 });
    }
  }, [nodesInitialized, fitView]);

  // ── Avisos ────────────────────────────────────────────────────────────────
  const snapshot = useMemo(() => snapshotOf(nodes, edges, viewport), [nodes, edges, viewport]);
  const problems = useMemo(() => lintFlow(snapshot.nodes, snapshot.edges), [snapshot]);
  const problemsByNode = useMemo(() => {
    const map = new Map<string, Problem[]>();
    for (const problem of problems) {
      if (problem.nodeId) map.set(problem.nodeId, [...(map.get(problem.nodeId) ?? []), problem]);
    }
    return map;
  }, [problems]);

  // ── Salvamento automático ─────────────────────────────────────────────────
  const serialized = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const lastSaved = useRef(serialized);
  const inFlight = useRef(false);

  useEffect(() => {
    if (serialized === lastSaved.current) return;
    setSave((current) => (current.status === "saving" ? current : { status: "pending" }));
    const timer = setTimeout(async () => {
      if (inFlight.current) return; // quando o envio atual terminar, o efeito roda de novo
      inFlight.current = true;
      setSave({ status: "saving" });
      const payload = JSON.parse(serialized) as FlowSnapshot;
      try {
        const result = await saveFlow(flow.id, payload);
        if (result.ok) {
          lastSaved.current = serialized;
          setSave({ status: "saved", at: new Date(result.savedAt) });
          setSaveTick((tick) => tick + 1); // se mudou algo durante o envio, salva de novo
        } else {
          setSave({ status: "error", error: result.error }); // tenta de novo na próxima mudança
        }
      } catch {
        setSave({ status: "error", error: "sem conexão com o servidor" });
      } finally {
        inFlight.current = false;
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [serialized, saveTick, flow.id]);

  // Atualiza o "Salvo há X" a cada 30s e avisa antes de fechar com mudança pendente.
  useEffect(() => {
    const interval = setInterval(() => setClock((tick) => tick + 1), 30_000);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (serialized !== lastSaved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [serialized]);

  // ── Ligações ──────────────────────────────────────────────────────────────
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      if (connection.source === connection.target) return false;
      const target = nodes.find((node) => node.id === connection.target);
      return !!target && hasInput(target.data.kind);
    },
    [nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) => [
        // Cada saída tem uma linha só: ligar de novo troca a linha antiga.
        ...current.filter(
          (edge) => !(edge.source === connection.source && (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null)),
        ),
        { id: newId(), source: connection.source, sourceHandle: connection.sourceHandle ?? null, target: connection.target },
      ]),
    [setEdges],
  );

  // ── Adicionar, editar e apagar caixinhas ──────────────────────────────────
  const addNode = useCallback(
    (kind: EditorKind, position: { x: number; y: number }) => {
      const id = kind === "TRIGGER" ? triggerNodeId(newId()) : newId();
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        { id, type: kind, position, data: newNodeData(kind), selected: true },
      ]);
    },
    [setNodes],
  );

  // Clique na paleta: ao lado da caixinha selecionada (ou no centro da tela),
  // descendo até achar um espaço livre pra não cair em cima de outra.
  const addFromPalette = useCallback(
    (kind: EditorKind) => {
      const anchor = nodes.find((node) => node.selected);
      let position = anchor ? { x: anchor.position.x + 320, y: anchor.position.y } : null;
      if (!position) {
        const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
        position = pane
          ? screenToFlowPosition({ x: pane.left + pane.width / 2 - 120, y: pane.top + pane.height / 2 - 60 })
          : { x: 0, y: 0 };
      }
      const overlaps = (p: { x: number; y: number }) =>
        nodes.some((node) => Math.abs(node.position.x - p.x) < 260 && Math.abs(node.position.y - p.y) < 160);
      while (overlaps(position)) position = { x: position.x, y: position.y + 180 };
      addNode(kind, position);
    },
    [nodes, addNode, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(DRAG_MIME) as EditorKind;
      if (!kind || !(kind in nodeTypes)) return;
      addNode(kind, screenToFlowPosition({ x: event.clientX - 120, y: event.clientY - 24 }));
    },
    [addNode, screenToFlowPosition],
  );

  const updateNodeData = useCallback(
    (id: string, data: EditorNodeData) => {
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, data } : node)));
      // Se um botão/card sumiu, a linha que saía dele some junto.
      const valid = new Set(outputHandles(data, catalogLookup).map((handle) => handle.id));
      setEdges((current) => current.filter((edge) => edge.source !== id || valid.has(edge.sourceHandle ?? null)));
    },
    [setNodes, setEdges, catalogLookup],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id));
      setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    },
    [setNodes, setEdges],
  );

  const onCreateTag = useCallback(async (tagName: string) => {
    const result = await createTag(tagName);
    if ("error" in result) {
      setSave({ status: "error", error: result.error });
      return null;
    }
    setTags((current) =>
      current.some((tag) => tag.id === result.id)
        ? current
        : [...current, result].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return result;
  }, []);

  const commitName = async () => {
    const clean = name.trim();
    if (!clean || clean === savedName.current) return setName(savedName.current);
    const result = await renameFlow(flow.id, clean);
    if (result.ok) savedName.current = clean;
    else setSave({ status: "error", error: result.error });
  };

  const badge = STATUS_BADGE[flow.status];
  const saveLabel =
    save.status === "saving"
      ? "Salvando…"
      : save.status === "pending"
        ? "Alterações não salvas"
        : save.status === "error"
          ? `Não foi possível salvar: ${save.error}`
          : save.at
            ? `Salvo ${timeAgo(save.at)}`
            : "Tudo salvo";

  return (
    <EditorContext.Provider value={{ catalog, catalogLookup, tags, problemsByNode }}>
      <div className="fx flex h-dvh flex-col">
        <header className="flex h-16 flex-none items-center gap-3 border-b border-border bg-surface-200 px-6">
          <nav aria-label="Caminho" className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
            <Link href="/fluxos" className="hover:text-ink">
              Automações
            </Link>
            {flow.folder && (
              <>
                <span aria-hidden>›</span>
                <span className="truncate">{flow.folder}</span>
              </>
            )}
            <span aria-hidden>›</span>
          </nav>
          <input
            className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-[17px] font-semibold hover:bg-surface-300 focus:bg-surface-300"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            aria-label="Nome do fluxo"
          />
          <span className={`fx-badge ${badge.className}`}>{badge.label}</span>
          <span
            className={`max-w-80 truncate text-sm ${save.status === "error" ? "text-danger" : "text-ink-subtle"}`}
            role="status"
            data-save-status={save.status}
          >
            {saveLabel}
          </span>
          {problems.length > 0 && (
            <span className="fx-badge fx-badge-warn" title={problems.map((problem) => problem.message).join("\n")}>
              {problems.length} {problems.length === 1 ? "aviso" : "avisos"}
            </span>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <Palette onAdd={addFromPalette} />
          <div className="relative min-w-0 flex-1" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <ReactFlow<FlowNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              // Só guarda o zoom quando a pessoa mexe (event = null em movimentos automáticos).
              onMoveEnd={(event, next) => event && setViewport(next)}
              defaultViewport={initial.viewport ?? undefined}
              minZoom={0.2}
              maxZoom={2}
              deleteKeyCode={["Backspace", "Delete"]}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--canvas-dot)" />
              <Controls position="bottom-right" showInteractive={false} />
              <MiniMap position="bottom-left" pannable zoomable />
            </ReactFlow>
          </div>
          <Inspector
            key={selected?.id ?? "none"}
            node={selected}
            flowProblems={problems}
            onChange={updateNodeData}
            onDelete={deleteNode}
            onCreateTag={onCreateTag}
          />
        </div>
      </div>
    </EditorContext.Provider>
  );
}

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
