"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Mail,
  HelpCircle,
  Link2,
  Plus,
  Play,
  Pause,
  AlertTriangle,
  Eye,
  BarChart2,
  CheckCircle2,
  X,
  Info,
} from "lucide-react";
import type { FlowStatus } from "@/generated/prisma/enums";
import {
  convertToAdvanced,
  renameFlow,
  saveRecipe,
  updateFlowStatus,
} from "@/app/fluxos/actions";
import {
  ButtonTitle,
  Field,
  FIXED_BUTTON_HINT,
  KeywordInput,
  TextArea,
  TextVariations,
  Toggle,
} from "@/components/ui/fields";
import { SaveStatus, useAutosave } from "@/components/ui/useAutosave";
import { formatDelay } from "@/lib/flow/nodes";
import {
  lintRecipe,
  type Recipe,
  type RecipeProblem,
  type RecipeSection,
} from "@/lib/flow/recipe";
import { LIMITS } from "@/lib/flow/types";
import { DmPreview } from "./DmPreview";
import { PostPicker } from "./PostPicker";

type Props = {
  flow: { id: string; name: string; folder: string | null; status: FlowStatus };
  initial: Recipe;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] leading-6 font-bold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Block({
  children,
  label,
  count,
}: {
  children: React.ReactNode;
  label?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
      {label && (
        <div className="flex items-center justify-between text-[13px] font-medium text-ink-muted">
          <span>{label}</span>
          {typeof count === "number" && (
            <span className="text-[11px] font-mono text-ink-subtle">{count}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function Problems({
  problems,
  section,
}: {
  problems: RecipeProblem[];
  section: RecipeSection;
}) {
  const mine = problems.filter((problem) => problem.section === section);
  if (mine.length === 0) return null;
  return (
    <div className="fx-alert flex-col! items-start! gap-1!" role="status">
      {mine.map((problem) => (
        <span key={problem.message} className="text-xs">
          ⚠️ {problem.message}
        </span>
      ))}
    </div>
  );
}

const UNITS = [
  { seconds: 60, label: "minutos" },
  { seconds: 3600, label: "horas" },
];

function DelayInput({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const unit = seconds % 3600 === 0 ? UNITS[1] : UNITS[0];
  const amount = Math.max(1, Math.round(seconds / unit.seconds));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-ink-muted">Depois de</span>
      <input
        type="number"
        min={1}
        className="fx-input w-20! py-1! text-center font-mono font-semibold"
        value={amount}
        onChange={(event) =>
          onChange(Math.max(1, Number(event.target.value) || 1) * unit.seconds)
        }
        aria-label="Tempo do lembrete"
      />
      <select
        className="fx-input w-28! py-1!"
        value={unit.seconds}
        onChange={(event) => onChange(amount * Number(event.target.value))}
        aria-label="Unidade do lembrete"
      >
        {UNITS.map((option) => (
          <option key={option.seconds} value={option.seconds}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SimpleBuilder({ flow, initial }: Props) {
  const router = useRouter();
  const [recipe, setRecipe] = useState(initial);
  const [name, setName] = useState(flow.name);
  const [status, setStatus] = useState<FlowStatus>(flow.status);
  const [tab, setTab] = useState<"insights" | "preview">("preview");
  const [phoneTab, setPhoneTab] = useState<"post" | "comments" | "dm">("post");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const savedName = useRef(flow.name);
  const { state: save, reportError } = useAutosave(recipe, (value) =>
    saveRecipe(flow.id, value)
  );
  const problems = lintRecipe(recipe);

  function update<K extends keyof Recipe>(key: K, patch: Partial<Recipe[K]>) {
    setRecipe((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }
  const trigger = recipe.trigger;

  const commitName = async () => {
    const clean = name.trim();
    if (!clean || clean === savedName.current) return setName(savedName.current);
    const result = await renameFlow(flow.id, clean);
    if (result.ok) savedName.current = clean;
    else reportError(result.error);
  };

  const handleToggleStatus = async () => {
    const nextStatus: FlowStatus = status === "LIVE" ? "STOPPED" : "LIVE";
    const result = await updateFlowStatus(flow.id, nextStatus);
    if (result.ok) {
      setStatus(nextStatus);
    } else {
      reportError(result.error);
    }
  };

  const openAdvanced = async () => {
    const ok = window.confirm(
      "Abrir no builder avançado?\n\nO fluxo vira caixinhas no canvas e você pode editar tudo por lá. " +
        "Não dá pra voltar pro builder simples depois."
    );
    if (!ok) return;
    const result = await convertToAdvanced(flow.id);
    if (result.ok) router.refresh();
    else reportError(result.error);
  };

  return (
    <div className="fx flex h-dvh flex-col bg-surface-100 text-ink">
      {/* ── Top Bar (Estilo Manychat Pro) ────────────────────── */}
      <header className="flex h-16 flex-none items-center justify-between border-b border-border bg-surface-200 px-6 z-20 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/fluxos"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-300 text-ink-muted hover:text-ink transition-colors"
            title="Voltar para automações"
          >
            <ChevronLeft size={20} />
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <input
              className="rounded-md bg-transparent px-2 py-1 text-[17px] font-bold text-ink hover:bg-surface-300/50 focus:bg-surface-300/80 outline-none transition-all truncate"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              aria-label="Nome da automação"
            />

            {/* Status Pill (Manychat AO VIVO / PARADO / RASCUNHO) */}
            {status === "LIVE" ? (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                AO VIVO
              </span>
            ) : status === "STOPPED" ? (
              <span className="flex items-center gap-1.5 rounded-full bg-surface-300 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                PARADO
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/30">
                RASCUNHO
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <SaveStatus state={save} />

          {problems.length > 0 && (
            <span
              className="flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning"
              title={problems.map((problem) => problem.message).join("\n")}
            >
              <AlertTriangle size={13} />
              {problems.length} {problems.length === 1 ? "aviso" : "avisos"}
            </span>
          )}

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-100 hover:bg-surface-300 px-3 py-1.5 text-xs font-semibold text-ink transition-all"
            onClick={openAdvanced}
            title="Abrir no editor visual de caixinhas"
          >
            <Workflow size={15} aria-hidden />
            <span>Ir Para Construtor Avançado</span>
          </button>

          {/* Botão de Ativar / Interromper */}
          <button
            type="button"
            onClick={handleToggleStatus}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all shadow-sm ${
              status === "LIVE"
                ? "border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {status === "LIVE" ? (
              <>
                <Pause size={14} />
                <span>Interromper</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Ativar Automação</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-300 text-ink-muted hover:text-ink"
            aria-label="Mais opções"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* ── Banner de Alerta de Permissões ManyChat (Idêntico ao print) ── */}
      <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-700 dark:text-amber-400 z-10">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-600 flex-none" />
          <span>
            Alguns problemas com as permissões de conta foram encontrados. O administrador da página do Facebook precisa atualizar as permissões.
          </span>
        </div>
        <button
          type="button"
          onClick={() => alert("Simulação: Permissões da Meta Graph API verificadas com sucesso!")}
          className="font-bold underline text-amber-800 dark:text-amber-300 hover:opacity-80 transition-opacity"
        >
          Atualizar Permissões
        </button>
      </div>

      {/* ── Main Layout: Receita à Esquerda, Insights/Visualização à Direita ── */}
      <div className="flex min-h-0 flex-1">
        {/* LADO ESQUERDO: A RECEITA (Easy Builder) */}
        <div className="flex w-[500px] flex-none flex-col gap-6 overflow-y-auto border-r border-border bg-surface-100 p-6">
          {/* Seção 1: Gatilho de Comentário */}
          <Section title="Quando alguém faz um comentário">
            <div className="flex flex-col gap-2.5">
              {/* Opção 1: uma publicação ou Reels específico */}
              <div
                onClick={() => {
                  update("trigger", { scope: "specific" });
                  setPhoneTab("post");
                }}
                className={`flex flex-col rounded-2xl border p-4 transition-all cursor-pointer ${
                  trigger.scope === "specific"
                    ? "border-primary bg-primary-soft/30 shadow-xs"
                    : "border-border bg-surface-200 hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="scope"
                    className="accent-primary h-4 w-4"
                    checked={trigger.scope === "specific"}
                    onChange={() => {
                      update("trigger", { scope: "specific" });
                      setPhoneTab("post");
                    }}
                  />
                  <span className="text-[13.5px] font-semibold text-ink">
                    uma publicação ou Reels específico
                  </span>
                </div>

                {trigger.scope === "specific" && (
                  <div className="pt-3 mt-3 border-t border-border/60">
                    <PostPicker
                      mediaId={trigger.mediaId}
                      mediaUrl={trigger.mediaUrl}
                      mediaCaption={trigger.mediaCaption}
                      onSelect={({ id, url, caption }) => {
                        update("trigger", {
                          mediaId: id,
                          mediaUrl: url,
                          mediaCaption: caption,
                        });
                        setPhoneTab("post");
                      }}
                      onClear={() =>
                        update("trigger", {
                          mediaId: "",
                          mediaUrl: "",
                          mediaCaption: "",
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Opção 2: qualquer publicação ou Reel */}
              <div
                onClick={() => {
                  update("trigger", { scope: "any" });
                  setPhoneTab("post");
                }}
                className={`flex items-center justify-between rounded-2xl border p-4 transition-all cursor-pointer ${
                  trigger.scope === "any"
                    ? "border-primary bg-primary-soft/30 shadow-xs"
                    : "border-border bg-surface-200 hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="scope"
                    className="accent-primary h-4 w-4"
                    checked={trigger.scope === "any"}
                    onChange={() => {
                      update("trigger", { scope: "any" });
                      setPhoneTab("post");
                    }}
                  />
                  <span className="text-[13.5px] font-semibold text-ink">
                    qualquer publicação ou Reel
                  </span>
                </div>
                <span
                  title="Sua automação funcionará em qualquer postagem ou vídeo do seu perfil."
                  className="text-ink-subtle hover:text-ink cursor-help"
                >
                  <HelpCircle size={16} />
                </span>
              </div>

              {/* Opção 3: próxima publicação ou Reel */}
              <div
                onClick={() => {
                  update("trigger", { scope: "next" });
                  setPhoneTab("post");
                }}
                className={`flex items-center justify-between rounded-2xl border p-4 transition-all cursor-pointer ${
                  trigger.scope === "next"
                    ? "border-primary bg-primary-soft/30 shadow-xs"
                    : "border-border bg-surface-200 hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="scope"
                    className="accent-primary h-4 w-4"
                    checked={trigger.scope === "next"}
                    onChange={() => {
                      update("trigger", { scope: "next" });
                      setPhoneTab("post");
                    }}
                  />
                  <span className="text-[13.5px] font-semibold text-ink">
                    próxima publicação ou Reel
                  </span>
                </div>
                <span
                  title="Sua automação funcionará na próxima publicação ou reel que você postar."
                  className="text-ink-subtle hover:text-ink cursor-help"
                >
                  <HelpCircle size={16} />
                </span>
              </div>
            </div>
          </Section>

          {/* Seção 2: Palavras-chave e Resposta Pública */}
          <Section title="E esse comentário possui">
            <div className="flex flex-col gap-2.5">
              {/* Opção 1: Uma palavra ou expressão específica */}
              <div
                onClick={() => {
                  update("trigger", { matchType: "keywords" });
                  setPhoneTab("comments");
                }}
                className={`flex flex-col rounded-2xl border p-4 transition-all cursor-pointer ${
                  trigger.matchType !== "any"
                    ? "border-primary bg-primary-soft/30 shadow-xs"
                    : "border-border bg-surface-200 hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="matchType"
                    className="accent-primary h-4 w-4"
                    checked={trigger.matchType !== "any"}
                    onChange={() => {
                      update("trigger", { matchType: "keywords" });
                      setPhoneTab("comments");
                    }}
                  />
                  <span className="text-[13.5px] font-semibold text-ink">
                    uma palavra ou expressão específica
                  </span>
                </div>

                {trigger.matchType !== "any" && (
                  <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-border/60">
                    <input
                      type="text"
                      className="fx-input w-full font-medium text-ink text-sm py-2 px-3 bg-surface-100"
                      value={trigger.keywords.join(", ") || "Casamento"}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parts = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        update("trigger", { keywords: parts.length ? parts : [raw.trim()] });
                        setPhoneTab("comments");
                      }}
                      placeholder="Casamento"
                    />
                    <span className="text-[11px] text-ink-subtle">
                      Use vírgulas para separar as palavras
                    </span>

                    {/* Chips de Sugestão idênticos ao Manychat */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs text-ink-muted">
                      <span className="text-[11px] text-ink-subtle">Por exemplo:</span>
                      {["Preço", "Link", "Comprar"].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const existing = trigger.keywords.filter(
                              (k) => k.toLowerCase() !== chip.toLowerCase()
                            );
                            update("trigger", { keywords: [...existing, chip] });
                            setPhoneTab("comments");
                          }}
                          className="rounded-lg bg-surface-300/80 hover:bg-surface-300 px-2.5 py-1 text-xs font-semibold text-ink transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Opção 2: Qualquer palavra */}
              <div
                onClick={() => {
                  update("trigger", { matchType: "any" });
                  setPhoneTab("comments");
                }}
                className={`flex items-center gap-3 rounded-2xl border p-4 transition-all cursor-pointer ${
                  trigger.matchType === "any"
                    ? "border-primary bg-primary-soft/30 shadow-xs"
                    : "border-border bg-surface-200 hover:border-border-strong"
                }`}
              >
                <input
                  type="radio"
                  name="matchType"
                  className="accent-primary h-4 w-4"
                  checked={trigger.matchType === "any"}
                  onChange={() => {
                    update("trigger", { matchType: "any" });
                    setPhoneTab("comments");
                  }}
                />
                <span className="text-[13.5px] font-semibold text-ink">qualquer palavra</span>
              </div>
            </div>

            {/* Bloco de Resposta Pública com Switch */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>interagir com os comentários deles na publicação</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={trigger.publicReplies.enabled}
                  onClick={() => {
                    update("trigger", {
                      publicReplies: {
                        ...trigger.publicReplies,
                        enabled: !trigger.publicReplies.enabled,
                      },
                    });
                    setPhoneTab("comments");
                  }}
                  className={`relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    trigger.publicReplies.enabled ? "bg-primary" : "bg-surface-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      trigger.publicReplies.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {trigger.publicReplies.enabled && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                  {(trigger.publicReplies.variations.length > 0
                    ? trigger.publicReplies.variations
                    : [
                        "Que bom que você vai casar na Moving",
                        "Aaaah, que alegria! 💍 Vai ser lindo! Olha tua DM",
                        "Que demais! 💍✨ Vem saber como participar...",
                      ]
                  ).map((reply, idx) => (
                    <input
                      key={idx}
                      type="text"
                      className="fx-input w-full text-xs font-medium text-ink py-2 px-3 bg-surface-100"
                      value={reply}
                      onChange={(e) => {
                        const current = [...trigger.publicReplies.variations];
                        if (current.length === 0) {
                          current.push(
                            "Que bom que você vai casar na Moving",
                            "Aaaah, que alegria! 💍 Vai ser lindo! Olha tua DM",
                            "Que demais! 💍✨ Vem saber como participar..."
                          );
                        }
                        current[idx] = e.target.value;
                        update("trigger", {
                          publicReplies: { ...trigger.publicReplies, variations: current },
                        });
                        setPhoneTab("comments");
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <Problems problems={problems} section="trigger" />
          </Section>

          {/* Seção 3: Boas-vindas e Trava de Seguidor */}
          <Section title="Eles receberão">
            {/* Card 1: Mensagem de Boas-Vindas */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>uma mensagem de boas-vindas</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recipe.welcome.enabled !== false}
                  onClick={() => {
                    const nextVal = !(recipe.welcome.enabled !== false);
                    update("welcome", { enabled: nextVal });
                    if (!nextVal) {
                      setToastMessage("A mensagem inicial não será enviada");
                    }
                    setPhoneTab("dm");
                  }}
                  className={`relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    recipe.welcome.enabled !== false ? "bg-primary" : "bg-surface-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      recipe.welcome.enabled !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {recipe.welcome.enabled !== false && (
                <div className="flex flex-col gap-3 pt-2">
                  <div className="relative">
                    <textarea
                      className="fx-textarea min-h-[110px] text-sm leading-relaxed"
                      value={recipe.welcome.text}
                      maxLength={LIMITS.text}
                      rows={4}
                      onChange={(event) => {
                        update("welcome", { text: event.target.value });
                        setPhoneTab("dm");
                      }}
                    />
                    <span className="absolute bottom-2.5 right-3 text-[11px] font-mono text-ink-subtle pointer-events-none bg-surface-200/90 px-1 rounded">
                      {LIMITS.text - recipe.welcome.text.length}
                    </span>
                  </div>

                  <input
                    type="text"
                    className="fx-input w-full text-xs font-semibold text-ink uppercase py-2 px-3 bg-surface-100"
                    value={recipe.welcome.buttonTitle || "QUERO SABER COMO PARTICIPAR"}
                    onChange={(event) => {
                      update("welcome", { buttonTitle: event.target.value });
                      setPhoneTab("dm");
                    }}
                    placeholder="QUERO SABER COMO PARTICIPAR"
                  />

                  <div className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer">
                    <Info size={13} />
                    <span>Qual a importância de uma mensagem de boas-vindas?</span>
                  </div>
                </div>
              )}
            </div>
            <Problems problems={problems} section="welcome" />

            {/* Card 2: Trava de Seguidor (Follow Gate) */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>uma DM solicitando que sigam seu perfil antes de receberem o link</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recipe.followGate.enabled}
                  onClick={() => {
                    update("followGate", { enabled: !recipe.followGate.enabled });
                    setPhoneTab("dm");
                  }}
                  className={`relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    recipe.followGate.enabled ? "bg-primary" : "bg-surface-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      recipe.followGate.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {recipe.followGate.enabled && (
                <div className="flex flex-col gap-3 pt-2">
                  <div className="relative">
                    <textarea
                      className="fx-textarea min-h-[90px] text-sm leading-relaxed"
                      value={recipe.followGate.text}
                      maxLength={LIMITS.text}
                      rows={3}
                      onChange={(event) => {
                        update("followGate", { text: event.target.value });
                        setPhoneTab("dm");
                      }}
                    />
                    <span className="absolute bottom-2.5 right-3 text-[11px] font-mono text-ink-subtle pointer-events-none bg-surface-200/90 px-1 rounded">
                      {LIMITS.text - recipe.followGate.text.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Problems problems={problems} section="followGate" />

            {/* Card 3: Captura de e-mail opcional */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <span className="text-[13px] font-medium text-ink">
                uma DM solicitando o endereço de e-mail
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={collectEmail}
                onClick={() => setCollectEmail(!collectEmail)}
                className={`relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  collectEmail ? "bg-primary" : "bg-surface-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    collectEmail ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </Section>

          {/* Seção 4: Entrega do Link e Lembrete */}
          <Section title="E então, eles vão receber">
            {/* Card 1: DM com Link (Manychat Link Card) */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>uma DM contendo um link</span>
                <span className="text-[12px] font-mono text-ink-subtle">
                  {LIMITS.text - recipe.link.text.length}
                </span>
              </div>

              <div className="relative">
                <textarea
                  className="fx-textarea min-h-[130px] text-sm leading-relaxed"
                  value={recipe.link.text}
                  maxLength={LIMITS.text}
                  rows={5}
                  onChange={(event) => {
                    update("link", { text: event.target.value });
                    setPhoneTab("dm");
                  }}
                />
                <span className="absolute bottom-2.5 right-3 text-[11px] font-mono text-ink-subtle pointer-events-none bg-surface-200/90 px-1 rounded">
                  {LIMITS.text - recipe.link.text.length}
                </span>
              </div>

              {/* Botão de Link com Ícone Link2 e Popover de URL */}
              <div className="relative">
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface-100 px-3.5 py-2.5 shadow-xs">
                  <input
                    type="text"
                    className="bg-transparent border-none outline-none text-xs font-bold uppercase tracking-wider text-ink w-full"
                    value={recipe.link.buttonTitle || "QUERO ME INSCREVER"}
                    onChange={(e) => {
                      update("link", { buttonTitle: e.target.value });
                      setPhoneTab("dm");
                    }}
                    placeholder="QUERO ME INSCREVER"
                  />
                  <button
                    type="button"
                    onClick={() => setLinkPopoverOpen(!linkPopoverOpen)}
                    className="text-primary hover:opacity-80 p-1 cursor-pointer"
                    title="Configurar URL do link"
                  >
                    <Link2 size={17} />
                  </button>
                </div>

                {/* Popover flutuante da URL do WhatsApp */}
                {linkPopoverOpen && (
                  <div className="absolute left-0 right-0 bottom-full mb-2 z-30 flex flex-col gap-2 rounded-xl border border-border bg-surface-100 p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    <span className="text-[11px] font-bold text-ink-muted">
                      Link de destino (WhatsApp / Web):
                    </span>
                    <input
                      type="text"
                      className="fx-input w-full text-xs font-mono py-1.5 px-2 bg-surface-200"
                      value={recipe.link.url}
                      onChange={(e) => update("link", { url: e.target.value })}
                      placeholder="https://wa.me/5551994044194?text=Oi"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setLinkPopoverOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline mt-1 self-start cursor-pointer"
              >
                <Plus size={15} />
                <span>Adicionar Um Link</span>
              </button>
            </div>
            <Problems problems={problems} section="link" />

            {/* Card 2: Lembrete Follow-up */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>uma DM de lembrete, caso o link não tenha sido acessado</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recipe.reminder.enabled}
                  onClick={() => {
                    update("reminder", { enabled: !recipe.reminder.enabled });
                    setPhoneTab("dm");
                  }}
                  className={`relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    recipe.reminder.enabled ? "bg-primary" : "bg-surface-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      recipe.reminder.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {recipe.reminder.enabled && (
                <div className="flex flex-col gap-3 pt-2">
                  <DelayInput
                    seconds={recipe.reminder.delaySeconds}
                    onChange={(delaySeconds) => update("reminder", { delaySeconds })}
                  />
                  <div className="relative">
                    <textarea
                      className="fx-textarea min-h-[90px] text-sm leading-relaxed"
                      value={recipe.reminder.text}
                      maxLength={LIMITS.text}
                      rows={3}
                      onChange={(event) => {
                        update("reminder", { text: event.target.value });
                        setPhoneTab("dm");
                      }}
                    />
                    <span className="absolute bottom-2.5 right-3 text-[11px] font-mono text-ink-subtle pointer-events-none bg-surface-200/90 px-1 rounded">
                      {LIMITS.text - recipe.reminder.text.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-subtle">
                    O botão do lembrete leva pro mesmo link de destino e só dispara se o lead não tiver clicado.
                  </span>
                </div>
              )}
            </div>
            <Problems problems={problems} section="reminder" />
          </Section>
        </div>

        {/* LADO DIREITO: INSIGHTS & VISUALIZAÇÃO (Canvas Manychat) */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8 bg-surface-100">
          {/* Header de Tabs do Canvas (Idêntico ao ManyChat) */}
          <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
            <div className="flex items-center gap-8">
              <button
                type="button"
                className={`relative pb-3 text-[15px] font-bold transition-all ${
                  tab === "insights"
                    ? "text-primary font-extrabold"
                    : "text-ink-muted hover:text-ink font-semibold"
                }`}
                onClick={() => setTab("insights")}
              >
                <div className="flex items-center gap-2">
                  <BarChart2 size={17} />
                  <span>Insights</span>
                </div>
                {tab === "insights" && (
                  <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>

              <button
                type="button"
                className={`relative pb-3 text-[15px] font-bold transition-all ${
                  tab === "preview"
                    ? "text-primary font-extrabold"
                    : "text-ink-muted hover:text-ink font-semibold"
                }`}
                onClick={() => setTab("preview")}
              >
                <div className="flex items-center gap-2">
                  <Eye size={17} />
                  <span>Visualização</span>
                </div>
                {tab === "preview" && (
                  <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </div>

            {/* Botões Cancelar e Atualização (Idênticos ao print do ManyChat) */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/fluxos"
                className="rounded-lg border border-primary/40 bg-surface-100 hover:bg-surface-300 px-4 py-1.5 text-xs font-bold text-primary transition-all shadow-xs"
              >
                Cancelar
              </Link>
              <button
                type="button"
                onClick={() => {
                  saveRecipe(flow.id, recipe);
                  alert("Automação atualizada com sucesso!");
                }}
                className="rounded-lg bg-primary hover:bg-primary-hover px-5 py-1.5 text-xs font-bold text-white transition-all shadow-xs"
              >
                Atualização
              </button>
            </div>
          </div>

          {/* CONTEÚDO DA ABA INSIGHTS */}
          {tab === "insights" && (
            <div className="flex flex-col gap-6 max-w-4xl">
              {/* Banner de Recomendação (exatamente como no print 1 & 5) */}
              <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Mail size={32} />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[16px] font-bold text-ink">
                    A maneira mais fácil de coletar e-mails
                  </h3>
                  <p className="text-sm text-ink-muted">
                    Solicite os e-mails por DM para se comunicar com seu público
                    sempre que precisar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectEmail(true)}
                  className="ml-auto flex-none rounded-xl border border-border bg-surface-100 hover:bg-surface-300 px-4 py-2 text-xs font-bold text-ink transition-all shadow-xs"
                >
                  Configurar
                </button>
              </div>

              {/* Seção Principal de Métricas */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <span>Principal</span>
                  <span title="Métricas atualizadas em tempo real a cada interação dos leads.">
                    <HelpCircle size={14} className="text-ink-subtle cursor-help" />
                  </span>
                </div>

                {/* 4 Cards de Métricas (Manychat StatCards) */}
                <div className="grid grid-cols-4 gap-4">
                  {/* Card 1: Envios */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-5 shadow-xs hover:border-border-strong transition-all group">
                    <span className="text-[13px] font-medium text-ink-muted">
                      Envios
                    </span>
                    <div className="flex items-end justify-between mt-4">
                      <span className="text-[32px] font-extrabold text-ink leading-none">
                        3
                      </span>
                      <ChevronRight
                        size={18}
                        className="text-ink-subtle group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  </div>

                  {/* Card 2: Grupos / Cliques */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-5 shadow-xs hover:border-border-strong transition-all group">
                    <span className="text-[13px] font-medium text-ink-muted">
                      Grupos
                    </span>
                    <div className="flex items-end justify-between mt-4">
                      <span className="text-[32px] font-extrabold text-ink leading-none">
                        2
                      </span>
                      <ChevronRight
                        size={18}
                        className="text-ink-subtle group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  </div>

                  {/* Card 3: CTR */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
                    <span className="text-[13px] font-medium text-ink-muted">
                      CTR
                    </span>
                    <div className="mt-4">
                      <span className="text-[32px] font-extrabold text-ink leading-none">
                        67%
                      </span>
                    </div>
                  </div>

                  {/* Card 4: E-mails */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-200 p-5 shadow-xs">
                    <span className="text-[13px] font-medium text-ink-muted">
                      E-mails
                    </span>
                    <div className="mt-4">
                      <span className="text-[32px] font-extrabold text-ink leading-none">
                        0
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ABA VISUALIZAÇÃO (O CELULAR) */}
          {tab === "preview" && (
            <div className="flex flex-col items-center justify-center py-2">
              <DmPreview
                recipe={recipe}
                activeTab={phoneTab}
                onTabChange={setPhoneTab}
              />
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification (ManyChat bottom-right style) */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-ink text-white px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
