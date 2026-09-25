"use client";
// Painel da direita: edita a caixinha selecionada.
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import type { KeywordMatch, TriggerType } from "@/generated/prisma/enums";
import { KIND_META, newId } from "@/lib/flow/nodes";
import type { Problem } from "@/lib/flow/lint";
import {
  LIMITS,
  type ConditionRule,
  type DmButton,
  type EditorKind,
  type EditorNodeData,
  type EditorNodeDataOf,
  type NodeConfigMap,
} from "@/lib/flow/types";
import { useEditor, type FlowNode, type TagOption } from "./context";

type SetConfig<K extends EditorKind> = (config: NodeConfigMap[K]) => void;
type FormProps<K extends EditorKind> = { data: EditorNodeDataOf<K>; setConfig: SetConfig<K> };

// ── Pecinhas de formulário ───────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="fx-field">
      <span className="fx-label">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  max = LIMITS.text,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="fx-field">
      <span className="fx-label">{label}</span>
      <textarea
        className="fx-textarea"
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="fx-counter">
        {value.length}/{max}
      </span>
    </label>
  );
}

function ButtonTitle({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="fx-input"
        value={value}
        maxLength={LIMITS.buttonTitle}
        placeholder="TEXTO DO BOTÃO"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        aria-label="Texto do botão"
      />
      <span className="fx-counter w-12 flex-none">
        {value.length}/{LIMITS.buttonTitle}
      </span>
    </div>
  );
}

const FIXED_BUTTON_HINT = "Botão fixo: continua visível mesmo depois que o lead manda outras mensagens.";

// ── Um formulário por tipo ───────────────────────────────────────────────────

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: "COMMENT_KEYWORD", label: "Comentário em post ou Reel" },
  { value: "DM_KEYWORD", label: "Mensagem no direct (DM)" },
  { value: "STORY_REPLY", label: "Resposta ao story" },
  { value: "BUTTON_CLICK", label: "Clique num botão" },
];

const MATCHES: { value: KeywordMatch; label: string }[] = [
  { value: "CONTAINS", label: "Contém a palavra" },
  { value: "EXACT", label: "É exatamente a palavra" },
  { value: "ANY", label: "Qualquer mensagem" },
];

function TriggerForm({ data, setConfig }: FormProps<"TRIGGER">) {
  const config = data.config;
  const [draft, setDraft] = useState("");
  const addKeyword = () => {
    const word = draft.trim().toLowerCase();
    if (word && !config.keywords.includes(word) && config.keywords.length < LIMITS.keywords) {
      setConfig({ ...config, keywords: [...config.keywords, word] });
    }
    setDraft("");
  };

  return (
    <>
      <Field label="Quando alguém…">
        <select
          className="fx-input"
          value={config.type}
          onChange={(event) => setConfig({ ...config, type: event.target.value as TriggerType })}
        >
          {TRIGGER_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {config.type === "BUTTON_CLICK" ? (
        <Field label="Payload do botão" hint="O código que o botão manda quando é tocado.">
          <input
            className="fx-input font-mono!"
            value={config.payload ?? ""}
            onChange={(event) => setConfig({ ...config, payload: event.target.value })}
          />
        </Field>
      ) : (
        <>
          <Field label="E a mensagem…">
            <select
              className="fx-input"
              value={config.match}
              onChange={(event) => setConfig({ ...config, match: event.target.value as KeywordMatch })}
            >
              {MATCHES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          {config.match !== "ANY" && (
            <div className="fx-field">
              <span className="fx-label">Palavras-chave</span>
              <div className="flex flex-wrap gap-2">
                {config.keywords.map((word) => (
                  <span key={word} className="fx-chip">
                    {word}
                    <button
                      type="button"
                      aria-label={`Remover ${word}`}
                      onClick={() => setConfig({ ...config, keywords: config.keywords.filter((k) => k !== word) })}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="fx-input"
                  value={draft}
                  placeholder="ex.: eu quero"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  aria-label="Nova palavra-chave"
                />
                <button type="button" className="fx-btn fx-btn-sm" onClick={addKeyword}>
                  Adicionar
                </button>
              </div>
            </div>
          )}
          {config.type !== "DM_KEYWORD" && (
            <Field
              label="ID da publicação (opcional)"
              hint="Deixe vazio para valer em qualquer publicação. A lista de posts chega na Etapa 7."
            >
              <input
                className="fx-input font-mono!"
                value={config.mediaId ?? ""}
                onChange={(event) => setConfig({ ...config, mediaId: event.target.value })}
              />
            </Field>
          )}
          {config.type === "COMMENT_KEYWORD" && (
            <TextArea
              label="Resposta pública no comentário (opcional)"
              value={config.publicReply ?? ""}
              placeholder="Te mandei no direct!"
              onChange={(publicReply) => setConfig({ ...config, publicReply })}
            />
          )}
        </>
      )}
    </>
  );
}

function MessageForm({ data, setConfig }: FormProps<"MESSAGE">) {
  return <TextArea label="Texto" value={data.config.text} onChange={(text) => setConfig({ text })} />;
}

function QuestionForm({ data, setConfig }: FormProps<"QUESTION">) {
  const { text, buttons } = data.config;
  const setButton = (id: string, patch: Partial<DmButton>) =>
    setConfig({ text, buttons: buttons.map((button) => (button.id === id ? { ...button, ...patch } : button)) });
  const full = buttons.length >= LIMITS.buttons;

  return (
    <>
      <TextArea label="Texto" value={text} onChange={(value) => setConfig({ text: value, buttons })} />
      <div className="fx-field">
        <span className="fx-label">
          Botões ({buttons.length} de {LIMITS.buttons})
        </span>
        {buttons.map((button, index) => (
          <div key={button.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted">Botão {index + 1}</span>
              <button
                type="button"
                className="text-ink-subtle hover:text-danger"
                aria-label={`Remover botão ${index + 1}`}
                onClick={() => setConfig({ text, buttons: buttons.filter((b) => b.id !== button.id) })}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <ButtonTitle value={button.title} onChange={(title) => setButton(button.id, { title })} />
            <select
              className="fx-input"
              value={button.type}
              onChange={(event) => setButton(button.id, { type: event.target.value as DmButton["type"] })}
              aria-label="O que o botão faz"
            >
              <option value="postback">Próximo passo do fluxo</option>
              <option value="web_url">Abrir um link</option>
            </select>
            {button.type === "web_url" && (
              <input
                className="fx-input"
                value={button.url ?? ""}
                placeholder="https://"
                onChange={(event) => setButton(button.id, { url: event.target.value })}
                aria-label="Link do botão"
              />
            )}
          </div>
        ))}
        <button
          type="button"
          className="fx-btn fx-btn-sm self-start"
          disabled={full}
          onClick={() => setConfig({ text, buttons: [...buttons, { id: newId(), title: "", type: "postback" }] })}
        >
          <Plus size={14} /> Adicionar botão
        </button>
        <span className="text-xs text-ink-subtle">
          {full ? `O Instagram aceita no máximo ${LIMITS.buttons} botões por mensagem. ` : ""}
          {FIXED_BUTTON_HINT}
        </span>
      </div>
    </>
  );
}

function FollowGateForm({ data, setConfig }: FormProps<"FOLLOW_GATE">) {
  const config = data.config;
  return (
    <>
      <TextArea label="Mensagem" value={config.text} onChange={(text) => setConfig({ ...config, text })} />
      <Field label="Botão" hint={FIXED_BUTTON_HINT}>
        <ButtonTitle value={config.buttonTitle} onChange={(buttonTitle) => setConfig({ ...config, buttonTitle })} />
      </Field>
      <TextArea
        label="Se ainda não segue"
        value={config.notFollowingText}
        onChange={(notFollowingText) => setConfig({ ...config, notFollowingText })}
      />
      <p className="text-xs text-ink-subtle">
        Quem toca no botão e já segue o perfil vai pela saída “{config.buttonTitle || "DESBLOQUEAR"}”. Quem não segue
        recebe a mensagem acima e pode tocar de novo.
      </p>
    </>
  );
}

function TagSelect({
  value,
  onChange,
  onCreateTag,
}: {
  value?: string;
  onChange: (tagId?: string) => void;
  onCreateTag: (name: string) => Promise<TagOption | null>;
}) {
  const { tags } = useEditor();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Field label="Etiqueta">
        <select className="fx-input" value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
          <option value="">Escolha…</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2">
        <input
          className="fx-input"
          value={draft}
          placeholder="nova-etiqueta"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Nome da nova etiqueta"
        />
        <button
          type="button"
          className="fx-btn fx-btn-sm"
          disabled={!draft.trim() || busy}
          onClick={async () => {
            setBusy(true);
            const tag = await onCreateTag(draft);
            setBusy(false);
            if (tag) {
              onChange(tag.id);
              setDraft("");
            }
          }}
        >
          Criar
        </button>
      </div>
    </>
  );
}

function ConditionForm({
  data,
  setConfig,
  onCreateTag,
}: FormProps<"CONDITION"> & { onCreateTag: (name: string) => Promise<TagOption | null> }) {
  const config = data.config;
  return (
    <>
      <Field label="Verificar se…">
        <select
          className="fx-input"
          value={config.rule}
          onChange={(event) => setConfig({ rule: event.target.value as ConditionRule })}
        >
          <option value="follows">O contato segue o perfil</option>
          <option value="has_tag">O contato tem uma etiqueta</option>
          <option value="reply_contains">A última resposta contém um texto</option>
        </select>
      </Field>
      {config.rule === "has_tag" && (
        <TagSelect value={config.tagId} onChange={(tagId) => setConfig({ ...config, tagId })} onCreateTag={onCreateTag} />
      )}
      {config.rule === "reply_contains" && (
        <Field label="Texto">
          <input
            className="fx-input"
            value={config.value ?? ""}
            onChange={(event) => setConfig({ ...config, value: event.target.value })}
          />
        </Field>
      )}
      <p className="text-xs text-ink-subtle">Ligue as saídas “Sim” e “Não” às próximas caixinhas.</p>
    </>
  );
}

const UNITS = [
  { seconds: 60, label: "minutos" },
  { seconds: 3600, label: "horas" },
  { seconds: 86400, label: "dias" },
];

function DelayForm({ data, setConfig }: FormProps<"DELAY">) {
  const seconds = data.config.seconds;
  const unit = [...UNITS].reverse().find((option) => seconds % option.seconds === 0) ?? UNITS[0];
  const amount = Math.max(1, Math.round(seconds / unit.seconds));
  return (
    <>
      <div className="fx-field">
        <span className="fx-label">Aguardar</span>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            className="fx-input"
            value={amount}
            onChange={(event) => setConfig({ seconds: Math.max(1, Number(event.target.value) || 1) * unit.seconds })}
            aria-label="Quantidade"
          />
          <select
            className="fx-input"
            value={unit.seconds}
            onChange={(event) => setConfig({ seconds: amount * Number(event.target.value) })}
            aria-label="Unidade"
          >
            {UNITS.map((option) => (
              <option key={option.seconds} value={option.seconds}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-ink-subtle">
        Atenção: o Instagram só deixa mandar DM até 24 horas depois da última mensagem do contato. Esperas maiores que
        isso podem não conseguir enviar.
      </p>
    </>
  );
}

function AddTagForm({
  data,
  setConfig,
  onCreateTag,
}: FormProps<"ADD_TAG"> & { onCreateTag: (name: string) => Promise<TagOption | null> }) {
  return <TagSelect value={data.config.tagId} onChange={(tagId) => setConfig({ tagId })} onCreateTag={onCreateTag} />;
}

function CarouselForm({ data, setConfig }: FormProps<"CAROUSEL">) {
  const { catalog } = useEditor();
  const cards = data.config.cards;
  const used = new Set(cards.map((card) => card.catalogItemId));
  const available = catalog.filter((item) => !used.has(item.id));
  const full = cards.length >= LIMITS.cards;
  const move = (index: number, delta: number) => {
    const next = [...cards];
    const [card] = next.splice(index, 1);
    next.splice(index + delta, 0, card);
    setConfig({ cards: next });
  };

  if (catalog.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Ainda não há cards no catálogo. A tela do catálogo chega na Etapa 5. Por enquanto, rode{" "}
        <code className="fx-var">npx prisma db seed</code> para ter cards de exemplo.
      </p>
    );
  }

  return (
    <div className="fx-field">
      <span className="fx-label">
        Cards ({cards.length} de {LIMITS.cards})
      </span>
      {cards.map((card, index) => {
        const item = catalog.find((entry) => entry.id === card.catalogItemId);
        return (
          <div key={card.id} className="flex items-center gap-2 rounded-md border border-border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem externa do catálogo */}
            {item && <img src={item.imageUrl} alt="" className="size-10 flex-none rounded-sm object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{item?.title ?? "Card removido"}</div>
              <div className="text-xs text-ink-subtle">
                {item?.buttonTitle} · {item?.buttonType === "URL" ? "link externo" : "próximo passo"}
              </div>
            </div>
            <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              aria-label="Descer"
              disabled={index === cards.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              aria-label="Remover card"
              className="hover:text-danger"
              onClick={() => setConfig({ cards: cards.filter((c) => c.id !== card.id) })}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <select
        className="fx-input"
        value=""
        disabled={full || available.length === 0}
        onChange={(event) =>
          event.target.value && setConfig({ cards: [...cards, { id: newId(), catalogItemId: event.target.value }] })
        }
        aria-label="Adicionar card do catálogo"
      >
        <option value="">{full ? "Limite de 10 cards" : "+ Adicionar card do catálogo"}</option>
        {available.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <span className="text-xs text-ink-subtle">
        Cards com botão “próximo passo” viram uma saída própria da caixinha. {FIXED_BUTTON_HINT}
      </span>
    </div>
  );
}

function NoteForm({ data, setConfig }: FormProps<"NOTE">) {
  return <TextArea label="Anotação" max={2000} value={data.config.text} onChange={(text) => setConfig({ text })} />;
}

// ── Painel ───────────────────────────────────────────────────────────────────

function ProblemList({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null;
  return (
    <div className="fx-alert flex-col! items-start! gap-1!" role="status">
      <strong className="text-sm">Falta ajustar</strong>
      <ul className="list-disc pl-5 text-sm">
        {problems.map((problem, index) => (
          <li key={index}>{problem.message}</li>
        ))}
      </ul>
    </div>
  );
}

export function Inspector({
  node,
  flowProblems,
  onChange,
  onDelete,
  onCreateTag,
}: {
  node: FlowNode | null;
  flowProblems: Problem[];
  onChange: (id: string, data: EditorNodeData) => void;
  onDelete: (id: string) => void;
  onCreateTag: (name: string) => Promise<TagOption | null>;
}) {
  const { problemsByNode } = useEditor();

  if (!node) {
    return (
      <aside className="flex w-[360px] flex-none flex-col gap-4 overflow-y-auto border-l border-border bg-surface-200 p-6">
        <h2 className="text-[17px] leading-6 font-semibold">Como montar o fluxo</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-muted">
          <li>Arraste caixinhas da coluna da esquerda para o canvas.</li>
          <li>Puxe a bolinha da direita de uma caixinha até a da esquerda de outra para ligar as duas.</li>
          <li>Clique numa caixinha para editar o conteúdo aqui.</li>
          <li>Para apagar, selecione e aperte Delete (ou use o botão “Excluir caixinha”).</li>
        </ol>
        <p className="text-sm text-ink-muted">Tudo é salvo sozinho, alguns segundos depois de cada mudança.</p>
        <ProblemList problems={flowProblems.filter((problem) => problem.nodeId === null)} />
      </aside>
    );
  }

  const data = node.data;
  const setConfig = (config: unknown) => onChange(node.id, { ...data, config } as EditorNodeData);
  const meta = KIND_META[data.kind];

  let form: React.ReactNode;
  switch (data.kind) {
    case "TRIGGER":
      form = <TriggerForm data={data} setConfig={setConfig} />;
      break;
    case "MESSAGE":
      form = <MessageForm data={data} setConfig={setConfig} />;
      break;
    case "QUESTION":
      form = <QuestionForm data={data} setConfig={setConfig} />;
      break;
    case "FOLLOW_GATE":
      form = <FollowGateForm data={data} setConfig={setConfig} />;
      break;
    case "CONDITION":
      form = <ConditionForm data={data} setConfig={setConfig} onCreateTag={onCreateTag} />;
      break;
    case "DELAY":
      form = <DelayForm data={data} setConfig={setConfig} />;
      break;
    case "ADD_TAG":
      form = <AddTagForm data={data} setConfig={setConfig} onCreateTag={onCreateTag} />;
      break;
    case "CAROUSEL":
      form = <CarouselForm data={data} setConfig={setConfig} />;
      break;
    case "NOTE":
      form = <NoteForm data={data} setConfig={setConfig} />;
      break;
  }

  return (
    <aside
      className="flex w-[360px] flex-none flex-col gap-4 overflow-y-auto border-l border-border bg-surface-200 p-6"
      aria-label="Propriedades da caixinha"
    >
      <div className={`fx-node-${meta.category} fx-node-kind`}>{meta.label}</div>
      {data.kind !== "TRIGGER" && data.kind !== "NOTE" && (
        <Field label="Nome da caixinha">
          <input
            className="fx-input"
            value={data.name ?? ""}
            maxLength={80}
            placeholder={meta.label}
            onChange={(event) => onChange(node.id, { ...data, name: event.target.value || null })}
          />
        </Field>
      )}
      {form}
      <ProblemList problems={problemsByNode.get(node.id) ?? []} />
      <button type="button" className="fx-btn fx-btn-danger fx-btn-sm mt-auto self-start" onClick={() => onDelete(node.id)}>
        <Trash2 size={14} /> Excluir caixinha
      </button>
    </aside>
  );
}
