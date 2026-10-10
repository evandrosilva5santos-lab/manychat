import { Loader2 } from "lucide-react";

export default function FlowEditorLoading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-surface-100 text-ink-muted">
      <Loader2 size={36} className="animate-spin text-primary mb-3" />
      <span className="text-sm font-medium">Carregando editor de fluxo...</span>
    </div>
  );
}
