"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Info } from "lucide-react";
import { deleteProject, updatePublishRules } from "@/lib/autoposter/actions/projects";

function Radio({ checked, onChange, title, description }: { checked: boolean; onChange: () => void; title: string; description?: string }) {
  return (
    <label className="flex cursor-pointer gap-3 py-2">
      <input type="radio" className="mt-1 h-5 w-5 accent-ap-title" checked={checked} onChange={onChange} />
      <span>
        <span className="block text-ap-ink">{title}</span>
        {description && <span className="block text-sm text-ap-muted">{description}</span>}
      </span>
    </label>
  );
}

export function PublishRulesForm({ projectId, initial }: { projectId: string; initial: { publishOnlyIfApproved: boolean; retryOnFailure: boolean } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rules, setRules] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () =>
    startTransition(async () => {
      const result = await updatePublishRules(projectId, rules);
      setMessage(result.ok ? { ok: true, text: result.message ?? "Preferências salvas." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });

  return (
    <div className="max-w-[690px]">
      <h2 className="ap-title text-2xl">Regras de publicação</h2>
      <p className="mt-4 text-ap-subtle">
        No Autoposter, fazemos o possível para que seus posts sejam publicados exatamente como planejado. Ainda assim, imprevistos podem acontecer, como instabilidades nas redes sociais ou
        falhas de conexão.
      </p>
      <p className="mt-3 text-ap-subtle">Abaixo, você pode definir como o Autoposter deve agir automaticamente se algo sair do esperado na hora de publicar.</p>
      <p className="mt-6 flex gap-3 rounded-xl bg-ap-input px-5 py-3.5 text-sm text-ap-subtle">
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
        Se uma publicação falhar definitivamente, mesmo após as novas tentativas, ou se alguma conta precisar ser reconectada, o post aparece como “Falha” no calendário com o motivo no histórico.
      </p>

      <h3 className="ap-title mt-12 text-2xl">Configurações de retentativas</h3>
      <p className="mt-3 text-ap-subtle">Quando a rede (ex.: Instagram) ou o Autoposter estiverem instáveis, o que prefere que aconteça?</p>
      <p className="mt-1 text-sm text-ap-muted">Em falhas comuns, tentamos automaticamente 3x com intervalos de 1 minuto.</p>
      <div className="mt-3">
        <Radio checked={rules.retryOnFailure} onChange={() => setRules({ ...rules, retryOnFailure: true })} title="Tentar novamente assim que estiver estável" />
        <Radio checked={!rules.retryOnFailure} onChange={() => setRules({ ...rules, retryOnFailure: false })} title="Não tentar novamente, apenas marcar como falha." />
      </div>

      <h3 className="ap-title mt-12 text-2xl">Preferências do agendamento</h3>
      <p className="mt-3 text-ap-subtle">Quando você estiver enviando um post para aprovação com agendamento, qual opção prefere que já venha selecionada?</p>
      <div className="mt-3">
        <Radio
          checked={rules.publishOnlyIfApproved}
          onChange={() => setRules({ ...rules, publishOnlyIfApproved: true })}
          title="Publicar somente se for aprovado"
          description="Publica no horário agendado apenas se o post estiver aprovado."
        />
        <Radio
          checked={!rules.publishOnlyIfApproved}
          onChange={() => setRules({ ...rules, publishOnlyIfApproved: false })}
          title="Publicar mesmo sem aprovação"
          description="Publica no horário agendado mesmo que o post esteja aguardando revisão ou tenha pedido de ajuste."
        />
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-6 rounded-xl px-4 py-3 text-sm ${message.ok ? "bg-ap-green-soft text-ap-green" : "bg-ap-red-soft text-ap-red"}`}>
          {message.text}
        </p>
      )}
      <div className="mt-8 flex justify-end">
        <button type="button" className="ap-btn ap-btn-primary" disabled={pending} onClick={save}>
          Salvar preferências
        </button>
      </div>
    </div>
  );
}

export function DeleteProject({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const remove = () =>
    startTransition(async () => {
      const result = await deleteProject(projectId);
      if (!result.ok) return setError(result.error);
      router.push("/autoposter");
      router.refresh();
    });

  return (
    <div className="max-w-[560px]">
      <h2 className="ap-title text-2xl">Excluir projeto</h2>
      <p className="mt-3 text-ap-subtle">Apaga o projeto, todos os posts, grupos de aprovação e o histórico. Posts já publicados continuam no Instagram. Não dá para desfazer.</p>
      <label className="ap-field mt-6">
        <span className="ap-field-label">Digite o nome do projeto para confirmar</span>
        <input className="ap-input" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={name} />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-ap-red">{error}</p>}
      <button type="button" className="ap-btn ap-btn-danger mt-6" disabled={pending || typed.trim() !== name} onClick={remove}>
        Excluir projeto
      </button>
    </div>
  );
}
