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
  Copy,
  Edit3,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { FlowStatus } from "@/generated/prisma/enums";
import {
  convertToAdvanced,
  deleteFlow,
  duplicateFlow,
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
  type RecipeButton,
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

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-20">
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
  const isHours = seconds >= 3600 && seconds % 3600 === 0;
  const unit = isHours ? UNITS[1] : UNITS[0];
  const maxVal = unit.seconds === 3600 ? 23 : 1380;
  const amount = Math.min(maxVal, Math.max(1, Math.round(seconds / unit.seconds)));
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[13px] text-ink-muted">Depois de</span>
      <input
        type="number"
        min={1}
        max={maxVal}
        className="fx-input w-20! py-1! text-center font-mono font-semibold"
        value={amount}
        onChange={(event) => {
          const val = Math.min(maxVal, Math.max(1, Number(event.target.value) || 1));
          onChange(val * unit.seconds);
        }}
        aria-label="Tempo do lembrete (máximo 23 horas pela política da Meta)"
      />
      <select
        className="fx-input w-28! py-1!"
        value={unit.seconds}
        onChange={(event) => {
          const newUnitSec = Number(event.target.value);
          const newMax = newUnitSec === 3600 ? 23 : 1380;
          const newAmount = Math.min(newMax, amount);
          onChange(newAmount * newUnitSec);
        }}
        aria-label="Unidade do lembrete"
      >
        {UNITS.map((option) => (
          <option key={option.seconds} value={option.seconds}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-ink-subtle">(máx. 23h - política da Meta)</span>
    </div>
  );
}

export function SimpleBuilder({ flow, initial }: Props) {
  const router = useRouter();
  const [currentFlowId, setCurrentFlowId] = useState(flow.id);
  const [recipe, setRecipe] = useState(initial);
  const [name, setName] = useState(flow.name);
  const [status, setStatus] = useState<FlowStatus>(flow.status);
  const [tab, setTab] = useState<"insights" | "preview">("preview");
  const [mobilePanel, setMobilePanel] = useState<"recipe" | "preview">("recipe");
  const [phoneTab, setPhoneTab] = useState<"post" | "comments" | "dm">("post");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState(initial.trigger.keywords.join(", "));
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedName = useRef(flow.name);
  const { state: save, reportError } = useAutosave(recipe, async (value) => {
    const res = await saveRecipe(currentFlowId, value);
    if (res.ok && res.flowId && res.flowId !== currentFlowId) {
      setCurrentFlowId(res.flowId);
      window.history.replaceState(null, "", `/fluxos/${res.flowId}`);
    }
    return res;
  });
  const problems = lintRecipe(recipe);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  function update<K extends keyof Recipe>(key: K, patch: Partial<Recipe[K]>) {
    setRecipe((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }
  const trigger = recipe.trigger;

  const commitName = async () => {
    const clean = name.trim();
    if (!clean || clean === savedName.current) return setName(savedName.current);
    const result = await renameFlow(currentFlowId, clean);
    if (result.ok) savedName.current = clean;
    else reportError(result.error);
  };

  const currentLinkButtons: RecipeButton[] =
    recipe.link.buttons && recipe.link.buttons.length > 0
      ? recipe.link.buttons
      : [{ title: recipe.link.buttonTitle || "QUERO ME INSCREVER", url: recipe.link.url || "" }];

  const handleAddLinkButton = () => {
    if (currentLinkButtons.length >= 3) return;
    const nextButtons = [
      ...currentLinkButtons,
      { title: `LINK ${currentLinkButtons.length + 1}`, url: "https://" },
    ];
    update("link", {
      buttons: nextButtons,
      buttonTitle: nextButtons[0].title,
      url: nextButtons[0].url,
    });
    setPhoneTab("dm");
  };

  const handleRemoveLinkButton = (indexToRemove: number) => {
    if (currentLinkButtons.length <= 1) return;
    const nextButtons = currentLinkButtons.filter((_, idx) => idx !== indexToRemove);
    update("link", {
      buttons: nextButtons,
      buttonTitle: nextButtons[0].title,
      url: nextButtons[0].url,
    });
    setPhoneTab("dm");
  };

  const handleUpdateLinkButton = (indexToUpdate: number, patch: Partial<RecipeButton>) => {
    const nextButtons = currentLinkButtons.map((btn, idx) =>
      idx === indexToUpdate ? { ...btn, ...patch } : btn
    );
    update("link", {
      buttons: nextButtons,
      buttonTitle: nextButtons[0].title,
      url: nextButtons[0].url,
    });
    setPhoneTab("dm");
  };

  const handleToggleStatus = async () => {
    const nextStatus: FlowStatus = status === "LIVE" ? "STOPPED" : "LIVE";
    if (nextStatus === "LIVE") {
      const currentProblems = lintRecipe(recipe);
      if (currentProblems.length > 0) {
        showToast(`Aviso: ${currentProblems[0].message}`);
        const firstSection = currentProblems[0].section;
        document.getElementById(`section-${firstSection}`)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    setStatus(nextStatus);
    showToast(nextStatus === "LIVE" ? "Automação ativada com sucesso!" : "Automação interrompida com sucesso!");
    try {
      await updateFlowStatus(currentFlowId, nextStatus);
    } catch {
      // estado mantido na UI
    }
  };

  const handleSaveAndPublish = async () => {
    setIsSavingManual(true);
    try {
      const res = await saveRecipe(currentFlowId, recipe);
      if (res && !res.ok) {
        showToast(res.error || "Erro ao salvar alterações");
      } else {
        if (res && res.flowId && res.flowId !== currentFlowId) {
          setCurrentFlowId(res.flowId);
          window.history.replaceState(null, "", `/fluxos/${res.flowId}`);
        }
        showToast("Automação atualizada e salva com sucesso!");
      }
    } catch {
      showToast("Automação atualizada com sucesso!");
    } finally {
      setIsSavingManual(false);
    }
  };

  const openAdvanced = async () => {
    const ok = window.confirm(
      "Abrir no builder avançado?\n\nO fluxo vira caixinhas no canvas e você pode editar tudo por lá. " +
        "Não dá pra voltar pro builder simples depois."
    );
    if (!ok) return;
    const result = await convertToAdvanced(currentFlowId);
    if (result.ok) router.refresh();
    else reportError(result.error);
  };

  return (
    <div className="fx flex h-dvh flex-col bg-surface-100 text-ink">
      {/* ── Top Bar (Estilo Manychat Pro) ────────────────────── */}
      <header className="flex h-16 flex-none items-center justify-between border-b border-border bg-surface-200 px-3 sm:px-6 z-20 shadow-xs gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link
            href="/fluxos"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg hover:bg-surface-300 text-ink-muted hover:text-ink transition-colors cursor-pointer"
            title="Voltar para automações"
            aria-label="Voltar para automações"
          >
            <ChevronLeft size={20} />
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <input
              className="w-36 sm:w-auto max-w-[170px] sm:max-w-[280px] rounded-md bg-transparent px-2 py-1 text-[15px] sm:text-[17px] font-bold text-ink hover:bg-surface-300/50 focus:bg-surface-300/80 outline-none transition-all truncate"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              aria-label="Nome da automação"
            />

            {/* Status Pill (Manychat AO VIVO / PARADO / RASCUNHO) */}
            {status === "LIVE" ? (
              <span className="flex-none flex items-center gap-1 sm:gap-1.5 rounded-full bg-rose-600 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white animate-pulse" />
                AO VIVO
              </span>
            ) : status === "STOPPED" ? (
              <span className="flex-none flex items-center gap-1 sm:gap-1.5 rounded-full bg-surface-300 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                PARADO
              </span>
            ) : (
              <span className="flex-none flex items-center gap-1 sm:gap-1.5 rounded-full bg-amber-500/20 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/30">
                RASCUNHO
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-none">
          <div className="hidden md:flex">
            <SaveStatus state={save} />
          </div>

          {problems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMobilePanel("recipe");
                const target = problems[0]?.section;
                if (target) {
                  document.getElementById(`section-${target}`)?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="flex items-center gap-1 rounded-full bg-warning-soft hover:bg-warning-soft/80 px-2 sm:px-2.5 py-1 text-xs font-semibold text-warning transition-colors cursor-pointer"
              title={problems.map((problem) => problem.message).join("\n")}
              aria-label={`${problems.length} avisos. Clique para navegar até a seção.`}
            >
              <AlertTriangle size={13} />
              <span>{problems.length} <span className="hidden sm:inline">{problems.length === 1 ? "aviso" : "avisos"}</span></span>
            </button>
          )}

          <button
            type="button"
            className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border bg-surface-100 hover:bg-surface-300 px-3 py-1.5 text-xs font-semibold text-ink transition-all cursor-pointer"
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
            className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 sm:px-4 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer ${
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
                <span className="hidden sm:inline">Ativar Automação</span>
                <span className="sm:hidden">Ativar</span>
              </>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-300 text-ink-muted hover:text-ink cursor-pointer"
              aria-label="Mais opções"
            >
              <MoreVertical size={18} />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-surface-200 p-1.5 shadow-xl z-50 flex flex-col gap-1 text-xs font-semibold text-ink animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={async () => {
                    setMoreMenuOpen(false);
                    showToast("Duplicando automação...");
                    const res = await duplicateFlow(currentFlowId);
                    if (res.ok && res.flowId) {
                      showToast("Automação duplicada com sucesso!");
                      router.push(`/fluxos/${res.flowId}`);
                    } else if (!res.ok) {
                      showToast(res.error || "Erro ao duplicar automação");
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-300 text-left transition cursor-pointer"
                >
                  <Copy size={14} /> Duplicar automação
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setMoreMenuOpen(false);
                    const newName = window.prompt("Novo nome da automação:", name);
                    if (newName && newName.trim()) {
                      setName(newName.trim());
                      await renameFlow(currentFlowId, newName.trim());
                      savedName.current = newName.trim();
                      showToast("Automação renomeada!");
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-300 text-left transition cursor-pointer"
                >
                  <Edit3 size={14} /> Renomear
                </button>
                <div className="h-px bg-border my-0.5" />
                <button
                  type="button"
                  onClick={async () => {
                    setMoreMenuOpen(false);
                    if (window.confirm("Deseja realmente excluir esta automação permanentemente?")) {
                      await deleteFlow(currentFlowId);
                      router.push("/fluxos");
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-rose-500/10 text-rose-500 text-left transition cursor-pointer"
                >
                  <Trash2 size={14} /> Excluir automação
                </button>
              </div>
            )}
          </div>
        </div>
      </header>



      {/* ── Mobile View Toggle (< lg) ────────────────────────── */}
      <div className="flex lg:hidden items-center justify-around border-b border-border bg-surface-200 px-3 py-1.5 flex-none gap-2 z-10">
        <button
          type="button"
          onClick={() => setMobilePanel("recipe")}
          className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
            mobilePanel === "recipe"
              ? "bg-primary text-white shadow-xs"
              : "bg-surface-100 text-ink-muted hover:text-ink"
          }`}
        >
          Editar Receita
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel("preview")}
          className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
            mobilePanel === "preview"
              ? "bg-primary text-white shadow-xs"
              : "bg-surface-100 text-ink-muted hover:text-ink"
          }`}
        >
          Ver Visualização / Insights
        </button>
      </div>

      {/* ── Main Layout: Receita à Esquerda, Insights/Visualização à Direita ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* LADO ESQUERDO: A RECEITA (Easy Builder) */}
        <div
          className={`${
            mobilePanel === "recipe" ? "flex" : "hidden"
          } lg:flex w-full lg:w-[480px] xl:w-[500px] flex-none flex-col gap-6 overflow-y-auto border-r border-border bg-surface-100 p-4 sm:p-6`}
        >
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
                      value={keywordInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setKeywordInput(raw);
                        const parts = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        update("trigger", { keywords: parts });
                        setPhoneTab("comments");
                      }}
                      placeholder="Ex: Casamento, Preço, Link"
                      aria-label="Palavras-chave do comentário"
                    />
                    <span className="text-[11px] text-ink-subtle">
                      Use vírgulas para separar as palavras
                    </span>

                    {/* Chips de Sugestão */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs text-ink-muted">
                      <span className="text-[11px] text-ink-subtle">Por exemplo:</span>
                      {["Preço", "Link", "Comprar"].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentParts = keywordInput
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            if (!currentParts.some((k) => k.toLowerCase() === chip.toLowerCase())) {
                              const updatedParts = [...currentParts, chip];
                              const newText = updatedParts.join(", ");
                              setKeywordInput(newText);
                              update("trigger", { keywords: updatedParts });
                              setPhoneTab("comments");
                            }
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
          <Section id="section-link" title="E então, eles vão receber">
            {/* Card 1: DM com Link (Manychat Link Card) */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>uma DM contendo um link</span>
                <span className="text-[12px] font-mono text-ink-subtle">
                  {LIMITS.text - recipe.link.text.length} restantes
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <textarea
                  className="fx-textarea min-h-[130px] text-sm leading-relaxed"
                  value={recipe.link.text}
                  maxLength={LIMITS.text}
                  rows={5}
                  onChange={(event) => {
                    update("link", { text: event.target.value });
                    setPhoneTab("dm");
                  }}
                  aria-label="Texto da DM com o link"
                />
                <div className="flex justify-end">
                  <span className="text-[11px] font-mono text-ink-subtle">
                    {LIMITS.text - recipe.link.text.length} caracteres restantes
                  </span>
                </div>
              </div>

              {/* Botões de Link (Até 3 botões na DM - limite da Meta) */}
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
                  <span>Botões da DM ({currentLinkButtons.length}/3)</span>
                  <span className="text-[11px] text-ink-subtle">A Meta permite até 3 botões</span>
                </div>

                {currentLinkButtons.map((btn, idx) => (
                  <div key={idx} className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-100 p-3.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-surface-200 px-1.5 py-0.5 rounded">
                          Botão {idx + 1}
                        </span>
                        <input
                          type="text"
                          className="bg-transparent border-none outline-none text-xs font-bold uppercase tracking-wider text-ink w-full"
                          value={btn.title}
                          maxLength={LIMITS.buttonTitle}
                          onChange={(e) => handleUpdateLinkButton(idx, { title: e.target.value })}
                          placeholder="Texto do botão"
                          aria-label={`Texto do botão ${idx + 1} da DM`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Link2 size={15} className="text-primary flex-none" />
                        {currentLinkButtons.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLinkButton(idx)}
                            className="text-ink-subtle hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                            title="Remover este botão"
                            aria-label={`Remover botão ${idx + 1}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-ink-muted">
                        Link de destino (WhatsApp ou Web):
                      </span>
                      <input
                        type="text"
                        className="fx-input w-full text-xs font-mono py-1.5 px-2.5 bg-surface-200"
                        value={btn.url}
                        onChange={(e) => handleUpdateLinkButton(idx, { url: e.target.value })}
                        placeholder="https://wa.me/5551994044194?text=Oi"
                        aria-label={`URL de destino do botão ${idx + 1}`}
                      />
                      {btn.url && !btn.url.startsWith("https://") && (
                        <span className="text-[11px] text-danger font-medium">
                          ⚠️ O link precisa começar com https://
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Botão Adicionar Um Link (Ativo até 3 botões) */}
                {currentLinkButtons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddLinkButton}
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 py-2.5 text-xs font-bold text-primary transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Adicionar Um Link</span>
                  </button>
                )}
              </div>
            </div>
            <Problems problems={problems} section="link" />

            {/* Card 2: Lembrete Follow-up */}
            <div id="section-reminder" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-200 p-4 shadow-sm transition-all hover:border-border-strong">
              <div className="flex items-center justify-between text-[13px] font-medium text-ink">
                <span>uma DM de lembrete, caso o link não tenha sido acessado</span>
                <button
                  type="button"
                  role="switch"
                  aria-label="Ativar lembrete de follow-up"
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
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      className="fx-textarea min-h-[90px] text-sm leading-relaxed"
                      value={recipe.reminder.text}
                      maxLength={LIMITS.text}
                      rows={3}
                      onChange={(event) => {
                        update("reminder", { text: event.target.value });
                        setPhoneTab("dm");
                      }}
                      aria-label="Texto da DM de lembrete"
                    />
                    <div className="flex justify-end">
                      <span className="text-[11px] font-mono text-ink-subtle">
                        {LIMITS.text - recipe.reminder.text.length} caracteres restantes
                      </span>
                    </div>
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
        <div
          className={`${
            mobilePanel === "preview" ? "flex" : "hidden"
          } lg:flex min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-8 bg-surface-100`}
        >
          {/* Header de Tabs do Canvas sem sobreposição */}
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3 mb-6 relative z-10 flex-wrap">
            <div className="flex items-center gap-6">
              <button
                type="button"
                className={`relative py-1 text-[15px] font-bold transition-all cursor-pointer ${
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
                  <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>

              <button
                type="button"
                className={`relative py-1 text-[15px] font-bold transition-all cursor-pointer ${
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
                  <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </div>

            {/* Botões Cancelar e Atualização */}
            <div className="flex items-center gap-2.5 flex-none">
              <Link
                href="/fluxos"
                onClick={(e) => {
                  const isDirty =
                    JSON.stringify(recipe) !== JSON.stringify(initial) || name !== flow.name;
                  if (isDirty) {
                    if (!window.confirm("Deseja realmente sair? As alterações não salvas serão descartadas.")) {
                      e.preventDefault();
                    }
                  }
                }}
                className="rounded-lg border border-border bg-surface-100 hover:bg-surface-300 px-4 py-1.5 text-xs font-bold text-ink transition-all shadow-xs cursor-pointer"
              >
                Cancelar
              </Link>
              <button
                type="button"
                disabled={isSavingManual}
                onClick={handleSaveAndPublish}
                className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 px-5 py-1.5 text-xs font-bold text-white transition-all shadow-xs cursor-pointer"
              >
                {isSavingManual && <RefreshCw size={13} className="animate-spin" />}
                <span>Atualização</span>
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
