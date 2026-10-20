"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { createProject, updateProject } from "@/lib/autoposter/actions/projects";
import { DATE_FORMATS, TIMEZONES } from "@/lib/autoposter/constants";
import { Avatar } from "../_ui/primitives";

export type AccountOption = { id: string; username: string; profilePicUrl: string | null; status: string };

type Props = {
  accounts: AccountOption[];
  project?: { id: string; name: string; timezone: string; dateFormat: string; accountIds: string[] };
};

const todayExample = (format: string) => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return format === "MM/DD/YYYY" ? `${m}/${d}/${now.getFullYear()}` : `${d}/${m}/${now.getFullYear()}`;
};

export function ProjectForm({ accounts, project }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(project?.name ?? "");
  const [timezone, setTimezone] = useState(project?.timezone ?? "America/Sao_Paulo");
  const [dateFormat, setDateFormat] = useState(project?.dateFormat ?? "DD/MM/YYYY");
  const [selected, setSelected] = useState<string[]>(project?.accountIds ?? (accounts.length === 1 ? [accounts[0].id] : []));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const input = { name, timezone, dateFormat: dateFormat as (typeof DATE_FORMATS)[number], accountIds: selected };
    startTransition(async () => {
      if (project) {
        const result = await updateProject(project.id, input);
        if (!result.ok) return setError(result.error);
        setSaved(true);
        router.refresh();
        return;
      }
      const result = await createProject(input);
      if (!result.ok) return setError(result.error);
      router.push(`/autoposter/projeto/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <h2 className="ap-title text-base">Detalhes do projeto</h2>

      <label className="ap-field">
        <span className="ap-field-label">Nome</span>
        <input id="project-name" name="projectName" className="ap-input" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Clínica Dra. Ana" />
      </label>

      <label className="ap-field">
        <span className="ap-field-label">Idioma</span>
        <select id="project-language" name="projectLanguage" className="ap-input" value="pt-BR" disabled aria-readonly>
          <option value="pt-BR">Português do Brasil</option>
        </select>
      </label>

      <label className="ap-field">
        <span className="ap-field-label">Fuso horário</span>
        <select id="project-timezone" name="projectTimezone" className="ap-input" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {TIMEZONES.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="ap-title mb-3 text-base">Formato de data</legend>
        <div className="flex flex-col gap-3">
          {DATE_FORMATS.map((format) => (
            <label key={format} className="flex cursor-pointer items-center gap-3 text-sm text-ap-ink">
              <input id={`date-format-${format.replaceAll("/", "-")}`} type="radio" name="dateFormat" value={format} className="h-5 w-5 accent-ap-title" checked={dateFormat === format} onChange={() => setDateFormat(format)} />
              {format} ({todayExample(format)})
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="ap-title mb-1 text-base">Redes do projeto</legend>
        <p className="mb-3 text-sm text-ap-muted">Escolha as contas do Instagram conectadas no instachat onde este projeto vai publicar.</p>
        {accounts.length === 0 ? (
          <p className="rounded-xl bg-ap-input px-4 py-3 text-sm text-ap-subtle">
            Nenhuma conta conectada.{" "}
            <Link href="/ajustes" className="font-semibold text-ap-title underline">
              Conecte uma conta em Ajustes
            </Link>{" "}
            e volte aqui.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => {
              const on = selected.includes(account.id);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggle(account.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 text-left transition-colors ${on ? "border-ap-primary" : "border-ap-line hover:border-ap-line-strong"}`}
                >
                  <Avatar src={account.profilePicUrl} name={account.username} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ap-ink">@{account.username}</span>
                    <span className={`text-xs ${account.status === "CONNECTED" ? "text-ap-green" : "text-ap-orange"}`}>
                      {account.status === "CONNECTED" ? "Conectada" : "Precisa reconectar"}
                    </span>
                  </span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-ap-primary bg-ap-primary text-white" : "border-ap-line-strong"}`}>
                    {on && <Check size={12} aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      {error && <p role="alert" className="rounded-xl bg-ap-red-soft px-4 py-3 text-sm text-ap-red">{error}</p>}
      {saved && <p role="status" className="rounded-xl bg-ap-green-soft px-4 py-3 text-sm text-ap-green">Projeto atualizado.</p>}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Link href={project ? `/autoposter/projeto/${project.id}` : "/autoposter"} className="ap-btn ap-btn-outline">
          Cancelar
        </Link>
        <button type="submit" className="ap-btn ap-btn-primary" disabled={pending || !name.trim()}>
          {pending ? "Salvando…" : project ? "Salvar" : "Continuar"}
        </button>
      </div>
    </form>
  );
}
