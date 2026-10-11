"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
  Lock,
  MessageCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

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
}

export function ConectarClient({ connected, username, error }: ConectarClientProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleStartOAuth = (mode: "instagram" | "facebook" = "facebook") => {
    setIsRedirecting(true);
    window.location.href = `/api/auth/instagram/login?from=conectar&mode=${mode}`;
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between p-4 sm:p-8">
      {/* ── Top Bar ── */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary font-bold shadow-xs">
            F
          </div>
          <span className="font-bold text-lg tracking-tight group-hover:text-primary transition">
            Fluxo
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-200 text-ink-muted border border-border">
            <ShieldCheck size={13} className="text-success" />
            Meta Graph API v21.0
          </span>
          <Link
            href="/ajustes"
            className="text-xs text-ink-muted hover:text-ink transition underline underline-offset-4"
          >
            Ajustes
          </Link>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-xl w-full mx-auto my-auto py-10">
        {/* Caso: Conectado com Sucesso */}
        {connected ? (
          <div className="rounded-2xl border border-success/30 bg-surface-200 p-6 sm:p-8 shadow-card text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto border border-success/20">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-2">
              <span className="inline-block text-xs uppercase tracking-wider font-semibold text-success bg-success-soft px-3 py-0.5 rounded-full">
                Conexão Autorizada
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Instagram Conectado!
              </h1>
              <p className="text-sm text-ink-muted">
                Sua conta oficial{" "}
                <strong className="text-ink">@{username || "sua_conta"}</strong> está
                autenticada e pronta para receber automações.
              </p>
            </div>

            <div className="rounded-xl bg-surface-100 p-4 border border-border text-left space-y-2 text-xs text-ink-muted">
              <div className="flex items-center gap-2 text-ink font-medium">
                <CheckCircle2 size={14} className="text-success" />
                <span>Webhooks inscritos automaticamente</span>
              </div>
              <div className="flex items-center gap-2 text-ink font-medium">
                <CheckCircle2 size={14} className="text-success" />
                <span>Token seguro de longa duração (60 dias) ativo</span>
              </div>
              <div className="flex items-center gap-2 text-ink font-medium">
                <CheckCircle2 size={14} className="text-success" />
                <span>Criptografia AES-256 no armazenamento de credenciais</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/fluxos"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover shadow-xs transition"
              >
                <span>Criar Meu Primeiro Fluxo</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/ajustes"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-300 border border-border px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-300/80 transition"
              >
                <span>Painel de Ajustes</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Caso: Não conectado ou Erro */
          <div className="rounded-2xl border border-border bg-surface-200 p-6 sm:p-8 shadow-card space-y-6">
            {/* Banner de Erro se houver */}
            {error && (
              <div className="rounded-xl bg-danger-soft border border-danger/30 p-4 flex items-start gap-3 text-xs text-danger animate-in fade-in">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Falha ao autenticar com a Meta</p>
                  <p className="opacity-90 leading-relaxed">
                    Código do erro: <code className="font-mono bg-danger/10 px-1 py-0.5 rounded">{error}</code>.
                    Certifique-se de que sua conta é Comercial ou Criador e que concedeu todas as permissões solicitadas.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 flex items-center justify-center mx-auto text-white shadow-pop">
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

            {/* Ações de Conexão */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleStartOAuth("facebook")}
                disabled={isRedirecting}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 px-5 py-3.5 text-sm font-bold text-white shadow-card hover:opacity-95 transition active:scale-[0.99] disabled:opacity-70 cursor-pointer"
              >
                {isRedirecting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Redirecionando para a Meta...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Conectar com Facebook Business Login</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleStartOAuth("instagram")}
                disabled={isRedirecting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-300 px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-300/80 transition cursor-pointer"
              >
                <span>Usar Instagram Login Direto (Legado)</span>
              </button>
            </div>

            {/* Checklist de Recursos */}
            <div className="border-t border-border pt-6 space-y-3">
              <p className="text-xs font-semibold text-ink uppercase tracking-wider">
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
        <span>Fluxo · Plataforma Autônoma de Automação para Instagram</span>
        <div className="flex gap-4">
          <Link href="/fluxos" className="hover:text-ink transition">Fluxos</Link>
          <Link href="/conversas" className="hover:text-ink transition">Conversas</Link>
          <Link href="/contatos" className="hover:text-ink transition">Contatos</Link>
          <Link href="/ajustes" className="hover:text-ink transition">Ajustes</Link>
        </div>
      </footer>
    </div>
  );
}
