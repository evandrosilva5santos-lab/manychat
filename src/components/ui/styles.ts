// Classes de botão e campo repetidas nas telas de conta, equipe e plano.
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
export const BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold disabled:opacity-60 ${FOCUS}`;
export const PRIMARY_BUTTON = `${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`;
export const SECONDARY_BUTTON = `${BUTTON} border border-border-strong bg-surface-200 text-ink hover:bg-surface-300`;
export const INPUT =
  "min-h-11 rounded-md border border-border bg-surface-100 px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40";
export const CARD = "rounded-lg border border-border bg-surface-200 p-5";
