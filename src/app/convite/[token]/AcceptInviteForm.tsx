"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { acceptInvite } from "./actions";

export function AcceptInviteForm(props: {
  token: string;
  mode: "signup" | "accept" | "wrong-user";
  signedInEmail: string | null;
  loginHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(props.token, String(data.get("name") ?? ""), String(data.get("password") ?? ""));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // refresh: o layout relê a sessão e a equipe.
      router.replace("/");
      router.refresh();
    });
  }

  if (props.mode === "wrong-user") {
    return (
      <p className="text-sm text-ink">
        Você está conectado como <strong>{props.signedInEmail}</strong>. Saia e entre com o e-mail do convite para aceitar.{" "}
        <Link href="/sair" className="font-semibold text-primary underline">Sair</Link>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {props.mode === "signup" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Seu nome</span>
            <input name="name" required maxLength={80} autoComplete="name" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Crie uma senha</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={INPUT} />
            <span className="text-xs text-ink-muted">Pelo menos 8 caracteres.</span>
          </label>
        </>
      )}
      {error && <p role="alert" className="rounded-xl bg-error/10 px-3.5 py-2.5 text-sm font-medium text-error">{error}</p>}
      <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
        {isPending ? "Entrando…" : props.mode === "signup" ? "Criar acesso e entrar" : "Aceitar convite"}
      </button>
      {props.mode === "signup" && (
        <p className="text-center text-xs text-ink-muted">
          Já tem conta com este e-mail? <Link href={props.loginHref} className="font-semibold text-primary underline">Entrar</Link>
        </p>
      )}
    </form>
  );
}
