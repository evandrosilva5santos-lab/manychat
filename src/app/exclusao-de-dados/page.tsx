import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Como apagar seus dados · instachat",
  robots: { index: false, follow: false },
};

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type Props = { searchParams: Promise<{ codigo?: string | string[] }> };

function stateLabel(status: string, accountsAffected: number): string {
  if (status === "PENDING") return "Em andamento";
  if (status === "COMPLETED") return accountsAffected > 0 ? "Concluído" : "Nenhum dado encontrado";
  return "Não conseguimos terminar a exclusão. Tentaremos de novo sozinhos; nada foi perdido além do que já foi apagado.";
}

async function loadRequest(codigo: string | undefined) {
  if (!codigo || !CODE_PATTERN.test(codigo)) return codigo ? "invalid" : null;
  try {
    const found = await prisma.dataDeletionRequest.findUnique({
      where: { code: codigo },
      select: { code: true, status: true, accountsAffected: true, createdAt: true },
    });
    return found ?? "invalid";
  } catch {
    return "invalid";
  }
}

export default async function ExclusaoDeDadosPage({ searchParams }: Props) {
  const params = await searchParams;
  const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo;
  const result = await loadRequest(codigo);

  return (
    <div className="min-h-screen bg-canvas text-ink py-10 px-4 sm:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="pb-6 border-b border-border">
          <Link
            href="/privacidade"
            className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink transition"
          >
            <ArrowLeft size={16} />
            <span>Política de privacidade</span>
          </Link>
        </div>

        <header className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Como apagar seus dados do instachat</h1>
          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            Se você removeu o instachat do seu Instagram ou do Facebook, apagamos seus dados de acesso em alguns minutos
            (no máximo 24 horas) e deixamos de acessar sua conta. Os dados do negócio (contatos e conversas) são
            apagados quando a conta profissional pede a exclusão, no app ou por e-mail em{" "}
            <a href="mailto:privacidade@fluxo.app" className="text-primary underline">
              privacidade@fluxo.app
            </a>
            .
          </p>
        </header>

        {result === "invalid" && (
          <div className="rounded-xl bg-surface-200 border border-border p-4 text-sm text-ink-muted">
            Não encontramos um pedido com este código. Se você acabou de pedir, aguarde alguns minutos.
          </div>
        )}

        {result && result !== "invalid" && (
          <div className="rounded-xl bg-surface-200 border border-border p-4 text-sm space-y-1.5">
            <p>
              <strong className="text-ink">Código de acompanhamento:</strong>{" "}
              <code className="font-mono">{result.code}</code>
            </p>
            <p>
              <strong className="text-ink">Estado:</strong> {stateLabel(result.status, result.accountsAffected)}
            </p>
            <p className="text-ink-muted">
              Pedido feito em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(result.createdAt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
