"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { startReview } from "@/lib/autoposter/actions/review";

const ON_BG = { "--ap-field-bg": "var(--ap-bg)" } as React.CSSProperties;

function Illustration() {
  return (
    <svg width="240" height="220" viewBox="0 0 240 220" fill="none" aria-hidden className="mx-auto">
      <path d="M40 210c10-60 40-90 80-90s70 30 80 90" fill="#e3eefd" />
      <path d="M40 210c10-60 40-90 80-90s70 30 80 90" stroke="#0054c2" strokeWidth="2" />
      <circle cx="110" cy="70" r="34" fill="#fff" stroke="#0054c2" strokeWidth="2" />
      <path d="M78 58c4-22 30-30 48-20 10 5 16 14 18 22-14-8-40-10-66-2z" fill="#1876f2" />
      <rect x="92" y="66" width="16" height="11" rx="5" stroke="#cd37b4" strokeWidth="2" />
      <rect x="114" y="66" width="16" height="11" rx="5" stroke="#cd37b4" strokeWidth="2" />
      <path d="M100 90c6 5 14 5 20 0" stroke="#0054c2" strokeWidth="2" strokeLinecap="round" />
      <rect x="150" y="92" width="26" height="44" rx="6" transform="rotate(14 150 92)" fill="#fff" stroke="#0054c2" strokeWidth="2" />
      <circle cx="160" cy="114" r="7" fill="#16a34a" />
      <path d="M157 114l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M182 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#cd37b4" />
      <path d="M170 52v10M160 58l4 6M180 56l-4 7" stroke="#1876f2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ReviewStart({ token, groupName }: { token: string; groupName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "identify">("welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startReview(token, { name, email });
      if (!result.ok) return setError(result.error);
      router.push(`/autoposter/aprovacao/${token}/r/${result.data.reviewerToken}`);
    });
  };

  if (step === "welcome") {
    return (
      <div className="flex flex-col items-center text-center">
        <h1 className="ap-title mt-16 text-2xl">Olá!</h1>
        <p className="mt-6 max-w-[220px] text-ap-ink">
          Você recebeu <strong>posts</strong> para aprovação
        </p>
        <div className="mt-8">
          <Illustration />
        </div>
        <button type="button" className="ap-btn ap-btn-primary mt-12" onClick={() => setStep("identify")}>
          Vamos lá <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-12 flex w-full max-w-[400px] flex-col gap-5">
      <div className="text-center">
        <h1 className="ap-title text-2xl">Quem está revisando?</h1>
        <p className="mt-2 text-sm text-ap-subtle">Seu nome aparece no histórico de cada post de “{groupName}”.</p>
      </div>
      <label className="ap-field" style={ON_BG}>
        <span className="ap-field-label">Seu nome</span>
        <input className="ap-input" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="ap-field" style={ON_BG}>
        <span className="ap-field-label">Seu e-mail</span>
        <input className="ap-input" type="email" required maxLength={160} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {error && <p role="alert" className="rounded-lg bg-ap-red-soft px-3 py-2 text-sm text-ap-red">{error}</p>}
      <button type="submit" className="ap-btn ap-btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Ver os posts"} <ArrowRight size={18} aria-hidden />
      </button>
    </form>
  );
}
