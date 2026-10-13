"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Lock,
  MessageCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandLogo";
import { friendlyConnectError } from "./messages";

function InstagramIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface ConectarClientProps {
  connected: boolean;
  username: string | null;
  error: string | null;
  /** Convite assinado do link enviado pelo gestor; sem ele não há como saber a qual cliente a conta pertence. */
  invite: string | null;
}

export function ConectarClient({ connected, username, error, invite }: ConectarClientProps) {
  const [redirectingTo, setRedirectingTo] = useState<"instagram" | "facebook" | null>(null);
  const canConnect = Boolean(invite) && !redirectingTo;
  const friendlyError = friendlyConnectError(error);

  const handleStartOAuth = (mode: "instagram" | "facebook") => {
    if (!invite) return;
    setRedirectingTo(mode);
    const params = new URLSearchParams({ from: "conectar", mode, convite: invite });
    // Navegação de página inteira: a rota responde com redirect 302 para a Meta.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/auth/instagram/login?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between p-4 sm:p-8">
      {/* ── Top Bar: página pública, sem links para o painel protegido ── */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border">
        <div className="flex items-center">
          <BrandWordmark height={28} />
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-xl w-full mx-auto my-auto py-10">
        {/* Caso: Conectado com Sucesso */}
        {connected ? (
          <div className="rounded-2xl border border-success/30 bg-surface-200 p-6 sm:p-8 shadow-card text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto border border-success/20">
              <CheckCircle2 size={32} aria-hidden />
            </div>

            <div role="status" className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Pronto, @{username || "sua_conta"} está conectado.
              </h1>
              <p className="text-base text-ink-muted">
                Você pode fechar esta página e voltar ao WhatsApp.
              </p>
            </div>
          </div>
        ) : (
          /* Caso: Não conectado ou Erro */
          <div className="rounded-2xl border border-border bg-surface-200 p-6 sm:p-8 shadow-card space-y-6">
            {!invite && (
              <div id="conectar-sem-convite" className="rounded-xl bg-surface-100 border border-border p-4 flex items-start gap-3 text-sm text-ink-muted" role="status">
                <Lock size={16} className="shrink-0 mt-0.5 text-ink-subtle" />
                <span>
                  Este endereço precisa do <strong className="text-ink">link de conexão</strong> enviado por quem cuida da sua conta.
                  Peça ao seu gestor o link e abra-o novamente.
                </span>
              </div>
            )}

            {/* Banner de Erro se houver */}
            {friendlyError && (
              <div className="rounded-xl bg-danger-soft border border-danger/30 p-4 flex items-start gap-3 text-sm text-danger animate-in fade-in">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1" role="alert">
                  <p className="font-semibold">Não foi possível conectar</p>
                  <p className="opacity-90 leading-relaxed">{friendlyError}</p>
                </div>
              </div>
            )}

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto text-on-primary shadow-pop">
                <InstagramIcon size={28} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Conectar ao Instagram
              </h1>
              <p className="text-sm text-ink-muted max-w-md mx-auto">
                Vincule sua conta profissional do Instagram para ativar disparos automáticos de DMs,
                respostas a comentários e rastreamento de links.
              </p>
            </div>

            {/* Ações de Conexão: dois caminhos oficiais da Meta */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleStartOAuth("instagram")}
                disabled={!canConnect}
                aria-describedby={invite ? undefined : "conectar-sem-convite"}
                aria-busy={redirectingTo !== null}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-on-primary shadow-card hover:bg-primary-hover transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-11"
              >
                {redirectingTo === "instagram" ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Abrindo o Instagram...</span>
                  </>
                ) : (
                  <>
                    <InstagramIcon size={18} />
                    <span>Entrar com Instagram</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleStartOAuth("facebook")}
                disabled={!canConnect}
                aria-describedby={invite ? undefined : "conectar-sem-convite"}
                aria-busy={redirectingTo !== null}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface-200 px-5 py-3.5 text-sm font-bold text-ink shadow-card hover:bg-surface-300 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-11"
              >
                {redirectingTo === "facebook" ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Abrindo o Facebook...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Entrar com Facebook</span>
                  </>
                )}
              </button>
              <p className="text-center text-xs text-ink-muted">
                Use o Facebook se a sua conta do Instagram é administrada por uma Página do Facebook.
              </p>
            </div>

            {/* Checklist de Recursos */}
            <div className="border-t border-border pt-6 space-y-3">
              <p className="text-xs font-semibold text-ink">
                Recursos ativados com a conexão:
              </p>
              <ul className="grid grid-cols-1 gap-2.5 text-xs text-ink-muted">
                <li className="flex items-center gap-2">
                  <Zap size={14} className="text-primary shrink-0" />
                  <span>Disparo instantâneo de DMs ao comentar palavras-chave</span>
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-primary shrink-0" />
                  <span>Botões fixos interativos com encurtador de cliques rastreáveis</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock size={14} className="text-success shrink-0" />
                  <span>Em total conformidade com a janela de 24h e regras oficiais Meta</span>
                </li>
              </ul>
            </div>

            {/* Ajuda / Dúvidas */}
            <div className="rounded-xl bg-surface-100 p-3.5 border border-border flex items-start gap-2.5 text-xs text-ink-muted">
              <HelpCircle size={15} className="shrink-0 mt-0.5 text-ink-subtle" />
              <span>
                Sua conta deve ser do tipo <strong>Profissional (Empresarial ou Criador)</strong>.
                Não temos acesso à sua senha; a autorização utiliza o protocolo seguro OAuth 2.0.
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 border-t border-border text-xs text-ink-muted flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>instachat · Automação de conversas para Instagram</span>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/privacidade" className="hover:text-ink transition">Privacidade</Link>
          <Link href="/termos" className="hover:text-ink transition">Termos</Link>
        </div>
      </footer>
    </div>
  );
}
