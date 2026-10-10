import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-ink-muted">
      <Loader2 size={32} className="animate-spin text-primary mb-3" />
      <span className="text-sm font-medium">Carregando dados...</span>
    </div>
  );
}
