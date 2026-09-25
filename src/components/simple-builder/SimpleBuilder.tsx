"use client";
// Builder simples ("automação rápida"): a receita comentário → DM → link em frases,
// com Insights e uma prévia da conversa do lado direito. Segue design/Construtor.dc.html.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Workflow } from "lucide-react";
import type { FlowStatus } from "@/generated/prisma/enums";
import { convertToAdvanced, renameFlow, saveRecipe } from "@/app/fluxos/actions";
import { ButtonTitle, Field, FIXED_BUTTON_HINT, KeywordInput, TextArea, TextVariations, Toggle } from "@/components/ui/fields";
import { SaveStatus, useAutosave } from "@/components/ui/useAutosave";
import { STATUS_BADGE } from "@/lib/format";
import { formatDelay } from "@/lib/flow/nodes";
import { lintRecipe, type Recipe, type RecipeProblem, type RecipeSection } from "@/lib/flow/recipe";
import { LIMITS } from "@/lib/flow/types";
import { DmPreview } from "./DmPreview";

type Props = {
  flow: { id: string; name: string; folder: string | null; status: FlowStatus };
  initial: Recipe;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] leading-7 font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Bloco cinza com uma parte da receita (como os cartões do easy builder). */
function Block({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-200 p-4 shadow-card">
      {label && <div className="text-[15px] text-ink-muted">{label}</div>}
      {children}
    </div>
  );
}

function Problems({ problems, section }: { problems: RecipeProblem[]; section: RecipeSection }) {
  const mine = problems.filter((problem) => problem.section === section);
  if (mine.length === 0) return null;
  return (
    <div className="fx-alert flex-col! items-start! gap-1!" role="status">
      {mine.map((problem) => (
        <span key={problem.message} className="text-sm">
          {problem.message}
        </span>
      ))}
    </div>
  );
}

const UNITS = [
  { seconds: 60, label: "minutos" },
  { seconds: 3600, label: "horas" },
];

function DelayInput({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
  const unit = seconds % 3600 === 0 ? UNITS[1] : UNITS[0];
  const amount = Math.max(1, Math.round(seconds / unit.seconds));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] text-ink-muted">Depois de</span>
      <input
        type="number"
        min={1}
        className="fx-input w-24!"
        value={amount}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1) * unit.seconds)}
        aria-label="Tempo do lembrete"
      />
      <select
        className="fx-input w-32!"
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
  const [tab, setTab] = useState<"insights" | "preview">("preview");
  const savedName = useRef(flow.name);
  const { state: save, reportError } = useAutosave(recipe, (value) => saveRecipe(flow.id, value));
  const problems = lintRecipe(recipe);

  // Atualiza um pedaço da receita sem mexer no resto.
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

  const openAdvanced = async () => {
    const ok = window.confirm(
      "Abrir no builder avançado?\n\nO fluxo vira caixinhas no canvas e você pode editar tudo por lá. " +
        "Não dá pra voltar pro builder simples depois.",
    );
    if (!ok) return;
    const result = await convertToAdvanced(flow.id);
    if (result.ok) router.refresh();
    else reportError(result.error);
  };

  const badge = STATUS_BADGE[flow.status];

  return (
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
        <SaveStatus state={save} />
        {problems.length > 0 && (
          <span className="fx-badge fx-badge-warn" title={problems.map((problem) => problem.message).join("\n")}>
            {problems.length} {problems.length === 1 ? "aviso" : "avisos"}
          </span>
        )}
        <button type="button" className="fx-btn fx-btn-sm" onClick={openAdvanced}>
          <Workflow size={16} aria-hidden /> Abrir no builder avançado
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Receita ───────────────────────────────────────────── */}
        <div className="flex w-[460px] flex-none flex-col gap-8 overflow-y-auto border-r border-border bg-surface-100 p-6">
          <Section title="Quando alguém faz um comentário">
            <Block>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Em qual publicação">
                {(
                  [
                    ["any", "Qualquer publicação ou Reel"],
                    ["specific", "Uma publicação específica"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-[15px]">
                    <input
                      type="radio"
                      name="scope"
                      checked={trigger.scope === value}
                      onChange={() => update("trigger", { scope: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {trigger.scope === "specific" && (
                <Field label="ID da publicação" hint="A lista das suas publicações chega na Etapa 7 (conexão com a Meta).">
                  <input
                    className="fx-input font-mono!"
                    value={trigger.mediaId}
                    onChange={(event) => update("trigger", { mediaId: event.target.value })}
                  />
                </Field>
              )}
            </Block>
          </Section>

          <Section title="E esse comentário possui">
            <Block label="Uma palavra ou expressão específica">
              <KeywordInput keywords={trigger.keywords} onChange={(keywords) => update("trigger", { keywords })} />
            </Block>
            <Block>
              <Toggle
                label="Responder o comentário em público"
                hint="Cada comentário recebe uma das respostas, sorteada."
                checked={trigger.publicReplies.enabled}
                onChange={(enabled) => update("trigger", { publicReplies: { ...trigger.publicReplies, enabled } })}
              />
              {trigger.publicReplies.enabled && (
                <TextVariations
                  values={trigger.publicReplies.variations}
                  max={LIMITS.publicReplies}
                  placeholder="Te mandei no direct! 📩"
                  addLabel="Adicionar resposta"
                  onChange={(variations) =>
                    update("trigger", { publicReplies: { ...trigger.publicReplies, variations } })
                  }
                />
              )}
            </Block>
            <Problems problems={problems} section="trigger" />
          </Section>

          <Section title="Eles receberão">
            <Block label="Uma mensagem de boas-vindas">
              <TextArea label="Texto" value={recipe.welcome.text} onChange={(text) => update("welcome", { text })} />
              <ButtonTitle
                label="Botão da boas-vindas"
                value={recipe.welcome.buttonTitle}
                onChange={(buttonTitle) => update("welcome", { buttonTitle })}
              />
              <span className="text-xs text-ink-subtle">{FIXED_BUTTON_HINT}</span>
            </Block>
            <Problems problems={problems} section="welcome" />
            <Block>
              <Toggle
                label="Pedir pra seguir antes do link"
                hint="Quem toca no botão e ainda não segue recebe esta mensagem; depois de seguir, toca de novo e recebe o link."
                checked={recipe.followGate.enabled}
                onChange={(enabled) => update("followGate", { enabled })}
              />
              {recipe.followGate.enabled && (
                <>
                  <TextArea
                    label="Mensagem pra quem não segue"
                    value={recipe.followGate.text}
                    onChange={(text) => update("followGate", { text })}
                  />
                  <ButtonTitle
                    label="Botão de tentar de novo"
                    value={recipe.followGate.buttonTitle}
                    onChange={(buttonTitle) => update("followGate", { buttonTitle })}
                  />
                </>
              )}
            </Block>
            <Problems problems={problems} section="followGate" />
          </Section>

          <Section title="E então, eles vão receber">
            <Block label="Uma DM com o link">
              <TextArea label="Texto" value={recipe.link.text} onChange={(text) => update("link", { text })} />
              <ButtonTitle
                label="Botão do link"
                value={recipe.link.buttonTitle}
                onChange={(buttonTitle) => update("link", { buttonTitle })}
              />
              <Field label="Link" hint="Ex.: https://wa.me/5551999999999?text=Oi">
                <input
                  className="fx-input"
                  value={recipe.link.url}
                  placeholder="https://"
                  onChange={(event) => update("link", { url: event.target.value })}
                />
              </Field>
            </Block>
            <Problems problems={problems} section="link" />
            <Block>
              <Toggle
                label="Lembrete se o link não for aberto"
                checked={recipe.reminder.enabled}
                onChange={(enabled) => update("reminder", { enabled })}
              />
              {recipe.reminder.enabled && (
                <>
                  <DelayInput
                    seconds={recipe.reminder.delaySeconds}
                    onChange={(delaySeconds) => update("reminder", { delaySeconds })}
                  />
                  <TextArea
                    label="Mensagem do lembrete"
                    value={recipe.reminder.text}
                    onChange={(text) => update("reminder", { text })}
                  />
                  <ButtonTitle
                    label="Botão do lembrete"
                    value={recipe.reminder.buttonTitle}
                    onChange={(buttonTitle) => update("reminder", { buttonTitle })}
                  />
                  <span className="text-xs text-ink-subtle">O botão do lembrete leva pro mesmo link.</span>
                </>
              )}
            </Block>
            <Problems problems={problems} section="reminder" />
          </Section>
        </div>

        {/* ── Insights / Visualização ───────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="fx-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="fx-tab"
              aria-selected={tab === "insights"}
              onClick={() => setTab("insights")}
            >
              Insights
            </button>
            <button
              type="button"
              role="tab"
              className="fx-tab"
              aria-selected={tab === "preview"}
              onClick={() => setTab("preview")}
            >
              Visualização
            </button>
          </div>

          {tab === "insights" ? (
            <div className="flex flex-col gap-4">
              <div className="fx-stats p-0!">
                {["Envios", "Cliques no link", "CTR", "E-mails"].map((label) => (
                  <div key={label} className="fx-stat">
                    <span className="fx-stat-label">{label}</span>
                    <span className="fx-stat-value">—</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-ink-muted">
                Os números aparecem quando o motor estiver rodando e respondendo no Instagram (Etapa 3).
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <DmPreview recipe={recipe} />
              <p className="max-w-sm text-center text-xs text-ink-subtle">
                Prévia de como o contato vê a conversa. O lembrete sai{" "}
                {recipe.reminder.enabled ? `depois de ${formatDelay(recipe.reminder.delaySeconds)}` : "desligado"}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
