"use client";

import { CalendarDays, ShieldCheck, UserCheck } from "lucide-react";
import type { EditorLibrary, EditorState } from "./PostEditor";

type Props = { state: EditorState; update: (patch: Partial<EditorState>) => void; library: EditorLibrary; today: string };

const ON_BG = { "--ap-field-bg": "var(--ap-bg)" } as React.CSSProperties;

function Option({ id, name, value, checked, onChange, title, description }: { id: string; name: string; value: string; checked: boolean; onChange: () => void; title: string; description: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors ${checked ? "border-ap-primary bg-ap-blue-soft/40" : "border-ap-line hover:border-ap-line-strong"}`}>
      <input id={id} name={name} value={value} type="radio" className="mt-1 h-4 w-4 accent-ap-primary" checked={checked} onChange={onChange} />
      <span>
        <span className="block text-sm font-semibold text-ap-ink">{title}</span>
        <span className="block text-sm text-ap-muted">{description}</span>
      </span>
    </label>
  );
}

export function StepConclusion({ state, update, library, today }: Props) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-10">
      <section>
        <h2 className="ap-title mb-4 flex items-center gap-2 text-lg">
          <CalendarDays size={20} aria-hidden /> Quando publicar
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Option id="publish-timing-scheduled" name="publishTiming" value="scheduled" checked={state.scheduled} onChange={() => update({ scheduled: true })} title="Agendar" description="Publica automaticamente na data e hora escolhidas." />
          <Option id="publish-timing-draft" name="publishTiming" value="draft" checked={!state.scheduled} onChange={() => update({ scheduled: false })} title="Sem data" description="Fica como rascunho até você agendar." />
        </div>
        {state.scheduled && (
          <div className="mt-5 flex flex-wrap gap-4">
            <label className="ap-field">
              <span className="ap-field-label">Data</span>
              <input id="publish-date" name="publishDate" type="date" className="ap-input" min={today} value={state.date} onChange={(event) => update({ date: event.target.value })} />
            </label>
            <label className="ap-field">
              <span className="ap-field-label">Hora</span>
              <input id="publish-time" name="publishTime" type="time" className="ap-input" value={state.time} onChange={(event) => update({ time: event.target.value })} />
            </label>
          </div>
        )}
      </section>

      <section>
        <h2 className="ap-title mb-4 flex items-center gap-2 text-lg">
          <UserCheck size={20} aria-hidden /> Aprovação do cliente
        </h2>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-ap-ink">
          <input id="send-to-review" name="sendToReview" type="checkbox" className="h-5 w-5 accent-ap-primary" checked={state.sendToReview} onChange={(event) => update({ sendToReview: event.target.checked })} />
          Enviar para o cliente aprovar
        </label>

        {state.sendToReview && (
          <div className="mt-5 flex flex-col gap-4 rounded-xl bg-ap-bg p-4">
            <label className="ap-field" style={ON_BG}>
              <span className="ap-field-label">Grupo de aprovação</span>
              <select id="review-group" name="reviewGroup" className="ap-input" value={state.groupChoice} onChange={(event) => update({ groupChoice: event.target.value })}>
                {library.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
                <option value="new">+ Criar novo grupo</option>
              </select>
            </label>
            {state.groupChoice === "new" && (
              <label className="ap-field" style={ON_BG}>
                <span className="ap-field-label">Nome do novo grupo</span>
                <input id="new-review-group-name" name="newReviewGroupName" className="ap-input" maxLength={80} value={state.newGroupName} onChange={(event) => update({ newGroupName: event.target.value })} />
              </label>
            )}
            <p className="text-xs text-ap-muted">O cliente recebe o link do grupo e aprova ou pede ajuste em cada post, sem precisar de login.</p>
          </div>
        )}

        {state.sendToReview && state.scheduled && (
          <fieldset className="mt-5">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-ap-ink">
              <ShieldCheck size={16} aria-hidden /> Na hora do agendamento
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option
                id="approval-policy-required"
                name="approvalPolicy"
                value="required"
                checked={state.publishOnlyIfApproved}
                onChange={() => update({ publishOnlyIfApproved: true })}
                title="Publicar somente se for aprovado"
                description="Publica no horário agendado apenas se o post estiver aprovado."
              />
              <Option
                id="approval-policy-optional"
                name="approvalPolicy"
                value="optional"
                checked={!state.publishOnlyIfApproved}
                onChange={() => update({ publishOnlyIfApproved: false })}
                title="Publicar mesmo sem aprovação"
                description="Publica no horário mesmo que esteja aguardando revisão ou com pedido de ajuste."
              />
            </div>
          </fieldset>
        )}
      </section>
    </div>
  );
}
