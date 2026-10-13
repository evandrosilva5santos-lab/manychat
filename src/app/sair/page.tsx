import Link from "next/link";
import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandLogo";

export const metadata: Metadata = {
  title: "Você saiu · instachat",
  robots: { index: false, follow: false },
};

/**
 * Destino do botão "Sair". A sessão já foi apagada pela action `logout`.
 * Quem entrou pela senha do site (Basic Auth) continua com acesso até fechar o
 * navegador: é o navegador que guarda essa senha, não o instachat.
 */
export default function SairPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <BrandWordmark height={28} />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-300 text-ink-muted">
        <LogOut size={22} aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Você saiu</h1>
        <p className="text-sm text-ink-muted">Sua sessão neste navegador foi encerrada.</p>
        <p className="text-sm text-ink-muted">
          Se você entrou com a senha do site, feche o navegador para que ele esqueça a senha. Até lá, ele ainda abre o
          painel sem perguntar.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Entrar de novo
      </Link>
    </main>
  );
}
