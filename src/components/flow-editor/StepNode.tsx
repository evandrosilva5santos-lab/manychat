"use client";
// Uma caixinha no canvas, desenhada com a estrutura FlowNode do design system.
import { memo, useEffect, useMemo } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { describeTrigger } from "@/lib/format";
import { formatDelay, hasInput, KIND_META, outputHandles } from "@/lib/flow/nodes";
import { useEditor, type FlowNode } from "./context";
import { KIND_ICON } from "./icons";

/**
 * Saída de um botão/ramo: a bolinha fica na borda direita da caixinha.
 * `inset` = distância até a borda (12px de padding do corpo + 1px da borda).
 */
function Out({ id, inset = 13 }: { id: string | null; inset?: number }) {
  return (
    <Handle
      type="source"
      position={Position.Right}
      id={id}
      className="fx-handle fx-handle-out"
      style={{ right: -inset }}
    />
  );
}

function Message({ text, placeholder }: { text: string; placeholder: string }) {
  return text.trim() ? (
    <div className="fx-node-msg line-clamp-4 whitespace-pre-line">{text}</div>
  ) : (
    <div className="fx-node-msg text-ink-subtle italic">{placeholder}</div>
  );
}

function StepNodeView({ id, data, selected }: NodeProps<FlowNode>) {
  const { catalog, catalogLookup, tags, problemsByNode } = useEditor();
  const meta = KIND_META[data.kind];
  const Icon = KIND_ICON[data.kind];
  const problems = problemsByNode.get(id) ?? [];
  const outputs = useMemo(() => outputHandles(data, catalogLookup), [data, catalogLookup]);
  const tagName = (tagId?: string) => tags.find((tag) => tag.id === tagId)?.name;

  // Botões e cards mudam as saídas: avisa o React Flow pra recalcular as bolinhas.
  const updateNodeInternals = useUpdateNodeInternals();
  const outputKey = outputs.map((output) => output.id).join("|");
  useEffect(() => updateNodeInternals(id), [id, outputKey, updateNodeInternals]);

  let body: React.ReactNode = null;
  let singleOut = false;

  switch (data.kind) {
    case "TRIGGER":
      body = <div>{describeTrigger(data.config)}</div>;
      singleOut = true;
      break;
    case "MESSAGE":
      body = <Message text={data.config.text} placeholder="Escreva a mensagem…" />;
      singleOut = true;
      break;
    case "QUESTION":
      singleOut = outputs.length === 1 && outputs[0].id === null;
      body = (
        <>
          <Message text={data.config.text} placeholder="Escreva a pergunta…" />
          {data.config.buttons.map((button) => (
            <div key={button.id} className="fx-node-btn">
              {button.title || "BOTÃO"}
              {button.type === "web_url" ? (
                <ExternalLink size={12} className="ml-1 inline text-ink-subtle" aria-label="Link externo" />
              ) : (
                <Out id={button.id} />
              )}
            </div>
          ))}
        </>
      );
      break;
    case "FOLLOW_GATE":
      body = (
        <>
          <Message text={data.config.text} placeholder="Escreva a mensagem…" />
          <div className="fx-node-btn">
            {data.config.buttonTitle || "DESBLOQUEAR"}
            <Out id="unlock" />
          </div>
        </>
      );
      break;
    case "CONDITION": {
      const question =
        data.config.rule === "follows"
          ? "Segue o perfil?"
          : data.config.rule === "has_tag"
            ? `Tem a etiqueta ${tagName(data.config.tagId) ?? "…"}?`
            : data.config.rule === "link_clicked"
              ? "Abriu o link?"
              : `A resposta contém “${data.config.value || "…"}”?`;
      body = (
        <>
          <div className="font-semibold">{question}</div>
          {outputs.map((output) => (
            <div key={output.id} className="fx-node-btn text-left!">
              {output.label}
              <Out id={output.id} />
            </div>
          ))}
        </>
      );
      break;
    }
    case "DELAY":
      body = <div>Aguardar {formatDelay(data.config.seconds)}</div>;
      singleOut = true;
      break;
    case "ADD_TAG":
      body = (
        <div>
          Adicionar etiqueta{" "}
          {data.config.tagId ? <span className="fx-chip">{tagName(data.config.tagId) ?? "?"}</span> : "…"}
        </div>
      );
      singleOut = true;
      break;
    case "CAROUSEL":
      body = (
        <>
          <div className="text-ink-muted">
            {data.config.cards.length} {data.config.cards.length === 1 ? "card" : "cards"} do catálogo
          </div>
          {data.config.cards.map((card) => {
            const item = catalog.find((entry) => entry.id === card.catalogItemId);
            return (
              <div key={card.id} className="fx-node-btn text-left!">
                <div className="truncate">{item?.title ?? "Card removido"}</div>
                <div className="text-xs font-normal text-ink-subtle">
                  {item?.buttonTitle}
                  {item?.buttonType === "URL" ? " · link externo" : ""}
                </div>
                {item?.buttonType === "POSTBACK" && <Out id={card.id} />}
              </div>
            );
          })}
        </>
      );
      break;
    case "NOTE":
      body = <div className="whitespace-pre-line">{data.config.text || "Escreva uma anotação…"}</div>;
      break;
  }

  const title = data.name || (data.kind === "TRIGGER" ? "Quando isso acontecer" : meta.label);

  return (
    <div className={`fx-node fx-node-${meta.category}`} aria-selected={selected}>
      {hasInput(data.kind) && (
        <Handle type="target" position={Position.Left} className="fx-handle fx-handle-in" style={{ top: 20 }} />
      )}
      <div className="fx-node-head">
        <span className="fx-node-dot grid place-items-center">
          <Icon size={12} color="var(--surface-200)" strokeWidth={2.5} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="fx-node-kind">{meta.label}</div>
          <div className="fx-node-name truncate">{title}</div>
        </div>
        {problems.length > 0 && (
          <AlertTriangle
            size={16}
            className="ml-auto flex-none text-warning"
            aria-label={problems.map((problem) => problem.message).join(". ")}
          />
        )}
      </div>
      <div className="fx-node-body">{body}</div>
      {singleOut && (
        <div className="fx-node-foot relative">
          {outputs[0]?.label ?? "Próximo passo"}
          <Out id={null} inset={1} />
        </div>
      )}
    </div>
  );
}

export const StepNode = memo(StepNodeView);
