"use client";
// Campos de formulário no padrão do design system, usados pelos dois editores.
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { LIMITS } from "@/lib/flow/types";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="fx-field">
      <span className="fx-label">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  max = LIMITS.text,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="fx-field">
      <span className="fx-label">{label}</span>
      <textarea
        className="fx-textarea"
        value={value}
        maxLength={max}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="fx-counter">
        {value.length}/{max}
      </span>
    </label>
  );
}

/** Texto do botão da DM: curto e em CAIXA ALTA. */
export function ButtonTitle({
  value,
  onChange,
  label = "Texto do botão",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="fx-input"
        value={value}
        maxLength={LIMITS.buttonTitle}
        placeholder="TEXTO DO BOTÃO"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        aria-label={label}
      />
      <span className="fx-counter w-12 flex-none">
        {value.length}/{LIMITS.buttonTitle}
      </span>
    </div>
  );
}

/** Chave liga/desliga (fx-toggle) com o texto ao lado. */
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[15px] leading-[22px]">{label}</div>
        {hint && <div className="text-xs text-ink-subtle">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="fx-toggle flex-none"
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

/** Palavras-chave em chips; Enter adiciona. */
export function KeywordInput({
  keywords,
  onChange,
  max = LIMITS.keywords,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const full = keywords.length >= max;
  const add = () => {
    const words = draft
      .split(",")
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word && !keywords.includes(word));
    if (words.length) onChange([...keywords, ...words].slice(0, max));
    setDraft("");
  };

  return (
    <div className="fx-field">
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((word) => (
            <span key={word} className="fx-chip">
              {word}
              <button
                type="button"
                aria-label={`Remover ${word}`}
                onClick={() => onChange(keywords.filter((other) => other !== word))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="fx-input"
          value={draft}
          disabled={full}
          placeholder={full ? `Limite de ${max} palavras` : "Digite e aperte Enter"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          aria-label="Nova palavra-chave"
        />
        <button type="button" className="fx-btn fx-btn-sm" onClick={add} disabled={full || !draft.trim()}>
          Adicionar
        </button>
      </div>
      <span className="fx-counter text-left!">
        {keywords.length} de {max} palavras-chave
      </span>
    </div>
  );
}

/** Lista de textos alternativos (ex.: respostas públicas), até `max`. */
export function TextVariations({
  values,
  onChange,
  max,
  placeholder,
  addLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  placeholder?: string;
  addLabel: string;
}) {
  const full = values.length >= max;
  return (
    <div className="fx-field">
      {values.map((value, index) => (
        <div key={index} className="flex items-start gap-2">
          <input
            className="fx-input"
            value={value}
            maxLength={LIMITS.text}
            placeholder={placeholder}
            onChange={(event) => onChange(values.map((other, i) => (i === index ? event.target.value : other)))}
            aria-label={`Variação ${index + 1}`}
          />
          <button
            type="button"
            className="mt-2.5 text-ink-subtle hover:text-danger"
            aria-label={`Remover variação ${index + 1}`}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="fx-btn fx-btn-sm self-start"
        disabled={full}
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={14} /> {addLabel}
      </button>
      <span className="fx-counter text-left!">
        {values.length} de {max}
        {full ? " — limite atingido" : ""}
      </span>
    </div>
  );
}

export const FIXED_BUTTON_HINT = "Botão fixo: continua visível mesmo depois que o lead manda outras mensagens.";
