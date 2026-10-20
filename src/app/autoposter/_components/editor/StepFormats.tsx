"use client";

import Link from "next/link";
import { Image as ImageIcon, PlaySquare } from "lucide-react";
import { FORMAT_LABEL, FORMATS, type PostFormat } from "@/lib/autoposter/constants";
import { FacebookGlyph, InstagramGlyph } from "../../_ui/primitives";
import type { EditorAccount } from "./PostEditor";

const SOON = ["Facebook", "Threads", "YouTube", "LinkedIn", "TikTok", "Pinterest", "Google Meu Negócio"];

type Props = { projectId: string; accounts: EditorAccount[]; targets: string[]; onChange: (targets: string[]) => void };

export function StepFormats({ projectId, accounts, targets, onChange }: Props) {
  const toggle = (key: string) => onChange(targets.includes(key) ? targets.filter((item) => item !== key) : [...targets, key]);

  return (
    <div>
      <h2 className="ap-title text-center text-2xl">Onde você gostaria de criar seus posts?</h2>
      <p className="mt-2 text-center text-ap-ink">Selecione abaixo os tipos de posts das redes conectadas</p>

      <div className="mx-auto mt-10 grid max-w-[1040px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {accounts.map((account) => (
          <fieldset key={account.id} className="rounded-[12px] bg-white p-5 shadow-sm ring-1 ring-ap-line">
            <legend className="sr-only">Instagram @{account.username}</legend>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="text-ap-pink">
                <InstagramGlyph size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-ap-ink">Instagram</span>
                <span className="block truncate text-[11px] font-semibold text-ap-muted">{account.username}</span>
              </span>
            </div>
            {account.status !== "CONNECTED" && <p className="mb-3 rounded-lg bg-ap-orange-soft px-2 py-1 text-xs text-ap-orange">Conta precisa ser reconectada para publicar.</p>}
            <div className="flex flex-col gap-3">
              {FORMATS.map((format: PostFormat) => {
                const key = `${account.id}:${format}`;
                return (
                  <label key={format} className="flex cursor-pointer items-center gap-3 text-base text-ap-ink">
                    <input type="checkbox" className="h-5 w-5 rounded-full accent-ap-primary" checked={targets.includes(key)} onChange={() => toggle(key)} />
                    <span className="flex-1">{FORMAT_LABEL[format]}</span>
                    {format === "feed" ? <ImageIcon size={22} className="text-ap-line-strong" aria-hidden /> : <PlaySquare size={22} className="text-ap-line-strong" aria-hidden />}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        {accounts.length === 0 && (
          <div className="col-span-full rounded-[12px] bg-ap-bg p-6 text-center text-ap-subtle">
            Este projeto ainda não tem contas.{" "}
            <Link href={`/autoposter/projeto/${projectId}/configuracoes`} className="font-semibold text-ap-title underline">
              Escolha as contas do projeto
            </Link>
            .
          </div>
        )}

        {SOON.map((name) => (
          <div key={name} className="rounded-[12px] bg-white p-5 opacity-50 ring-1 ring-ap-line" aria-hidden>
            <div className="flex items-center gap-2.5 text-ap-muted">
              {name === "Facebook" ? <FacebookGlyph size={20} /> : <span className="h-5 w-5 rounded-full bg-ap-line" />}
              <span className="text-base font-bold">{name}</span>
            </div>
            <p className="mt-3 text-xs text-ap-muted">Em breve</p>
          </div>
        ))}
      </div>
    </div>
  );
}
