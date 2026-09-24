export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface-200 p-6 shadow-card">
        <div className="text-[22px] font-bold tracking-tight">Fluxo</div>
        <h1 className="text-[32px] leading-10 font-bold tracking-tight">
          Automação de conversas para Instagram
        </h1>
        <p className="text-ink-muted">
          Etapa 1 pronta: o banco de dados está modelado. Próximo passo: o editor
          visual de fluxos.
        </p>
      </div>
    </main>
  );
}
