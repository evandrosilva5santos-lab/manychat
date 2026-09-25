import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface-200 p-6 shadow-card">
        <div className="text-[22px] font-bold tracking-tight">Fluxo</div>
        <h1 className="text-[32px] leading-10 font-bold tracking-tight">
          Automação de conversas para Instagram
        </h1>
        <p className="text-ink-muted">
          Etapa 2 pronta: já dá pra montar fluxos arrastando caixinhas. Próximo passo: o motor que responde sozinho.
        </p>
        <Link href="/fluxos" className="fx-btn fx-btn-primary self-start">
          Abrir minhas automações
        </Link>
      </div>
    </main>
  );
}
