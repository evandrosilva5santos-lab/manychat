"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPost, updatePost } from "@/lib/autoposter/actions/posts";
import type { PostFormat } from "@/lib/autoposter/constants";
import { isVideoUrl } from "@/lib/autoposter/media";
import { StepConclusion } from "./StepConclusion";
import { StepContent } from "./StepContent";
import { StepFormats } from "./StepFormats";

export type EditorAccount = { id: string; username: string; profilePicUrl: string | null; status: string };
export type EditorLibrary = {
  hashtags: Array<{ id: string; name: string; hashtags: string }>;
  signatures: Array<{ id: string; name: string; content: string }>;
  categories: Array<{ id: string; name: string; color: string }>;
  groups: Array<{ id: string; name: string }>;
};
export type EditorInitial = {
  postId: string;
  targets: string[];
  title: string | null;
  caption: string;
  firstComment: string | null;
  mediaUrls: string[];
  scheduleDate: string | null;
  scheduleTime: string | null;
  reviewGroupId: string | null;
  reviewing: boolean;
  categoryId: string | null;
  publishOnlyIfApproved: boolean;
};

export type EditorState = {
  targets: string[];
  title: string;
  caption: string;
  firstComment: string;
  mediaUrls: string[];
  categoryId: string;
  scheduled: boolean;
  date: string;
  time: string;
  sendToReview: boolean;
  groupChoice: string;
  newGroupName: string;
  publishOnlyIfApproved: boolean;
};

type Props = {
  project: { id: string; name: string; publishOnlyIfApproved: boolean; today: string };
  accounts: EditorAccount[];
  library: EditorLibrary;
  initial?: EditorInitial;
};

const STEPS = ["Formatos", "Conteúdo", "Conclusão"];

export function formatErrors(state: EditorState): string | null {
  const formats = new Set(state.targets.map((key) => key.split(":")[1] as PostFormat));
  const videos = state.mediaUrls.filter(isVideoUrl).length;
  if (formats.has("reels") && (state.mediaUrls.length !== 1 || videos !== 1)) return "Reels precisa de exatamente um vídeo.";
  if (formats.has("story") && state.mediaUrls.length !== 1) return "Story precisa de exatamente uma imagem ou vídeo.";
  return null;
}

export function PostEditor({ project, accounts, library, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(initial ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EditorState>({
    targets: initial?.targets ?? [],
    title: initial?.title ?? "",
    caption: initial?.caption ?? "",
    firstComment: initial?.firstComment ?? "",
    mediaUrls: initial?.mediaUrls ?? [],
    categoryId: initial?.categoryId ?? "",
    scheduled: initial ? Boolean(initial.scheduleDate) : true,
    date: initial?.scheduleDate ?? project.today,
    time: initial?.scheduleTime ?? "18:00",
    sendToReview: initial ? initial.reviewing : false,
    groupChoice: initial?.reviewGroupId ?? library.groups[0]?.id ?? "new",
    newGroupName: `Posts ${project.name}`,
    publishOnlyIfApproved: initial?.publishOnlyIfApproved ?? project.publishOnlyIfApproved,
  });
  const update = (patch: Partial<EditorState>) => setState((current) => ({ ...current, ...patch }));

  const canNext = useMemo(() => {
    if (step === 1) return state.targets.length > 0;
    if (step === 2) return state.mediaUrls.length > 0 && !formatErrors(state);
    return true;
  }, [step, state]);

  function submit() {
    setError(null);
    const input = {
      projectId: project.id,
      targets: state.targets.map((key) => {
        const [accountId, format] = key.split(":");
        return { accountId, format: format as PostFormat };
      }),
      title: state.title || null,
      caption: state.caption,
      firstComment: state.firstComment || null,
      mediaUrls: state.mediaUrls,
      schedule: state.scheduled ? { date: state.date, time: state.time } : null,
      sendToReview: state.sendToReview,
      reviewGroupId: state.sendToReview && state.groupChoice !== "new" ? state.groupChoice : null,
      newReviewGroupName: state.sendToReview && state.groupChoice === "new" ? state.newGroupName : null,
      publishOnlyIfApproved: state.publishOnlyIfApproved,
      categoryId: state.categoryId || null,
    };
    startTransition(async () => {
      const result = initial ? await updatePost(initial.postId, input) : await createPost(input);
      if (!result.ok) return setError(result.error);
      router.push(`/autoposter/projeto/${project.id}/calendario?type=weekly&date=${state.scheduled ? state.date : project.today}&post=${result.data.id}`);
      router.refresh();
    });
  }

  const goTo = (number: number) => {
    if (number < step || canNext) setStep(number);
  };

  return (
    <section className="rounded-[12px] bg-white">
      <ol className="flex overflow-x-auto border-b border-ap-line px-4 md:px-10" aria-label="Etapas">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={number > step && !canNext}
                onClick={() => goTo(number)}
                aria-current={active ? "step" : undefined}
                className={`-mb-px border-b-2 px-4 py-4 text-sm font-semibold whitespace-nowrap ${active ? "border-ap-title text-ap-title" : "border-transparent text-ap-line-strong hover:text-ap-subtle"}`}
              >
                {String(number).padStart(2, "0")}. {label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="px-4 py-10 md:px-10">
        {step === 1 && <StepFormats projectId={project.id} accounts={accounts} targets={state.targets} onChange={(targets) => update({ targets })} />}
        {step === 2 && <StepContent projectId={project.id} state={state} update={update} library={library} accounts={accounts} />}
        {step === 3 && <StepConclusion state={state} update={update} library={library} today={project.today} />}
        {error && <p role="alert" className="mt-6 rounded-xl bg-ap-red-soft px-4 py-3 text-sm text-ap-red">{error}</p>}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-[12px] border-t border-ap-line bg-white px-4 py-4 md:px-10">
        {step === 1 ? (
          <Link href={`/autoposter/projeto/${project.id}/calendario`} className="ap-btn ap-btn-outline">
            Cancelar
          </Link>
        ) : (
          <button type="button" className="ap-btn ap-btn-outline" onClick={() => setStep(step - 1)}>
            Voltar
          </button>
        )}
        {step < 3 ? (
          <button type="button" className="ap-btn ap-btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continuar
          </button>
        ) : (
          <button type="button" className="ap-btn ap-btn-primary" disabled={pending} onClick={submit}>
            {pending ? "Salvando…" : state.sendToReview ? "Salvar e enviar para aprovação" : state.scheduled ? "Agendar post" : "Salvar rascunho"}
          </button>
        )}
      </div>
    </section>
  );
}
