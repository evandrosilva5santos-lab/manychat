"use client";

import React, { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Video,
  Key,
  Globe,
  Radio,
  HelpCircle,
  Code2,
} from "lucide-react";
import {
  testMetaConnection,
  renewMetaToken,
  subscribeMetaWebhooks,
  type MetaSettingsData,
} from "./actions";

interface SettingsClientProps {
  initialSettings: MetaSettingsData;
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [settings] = useState<MetaSettingsData>(initialSettings);
  const [origin, setOrigin] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
  } | null>(null);
  const [renewResult, setRenewResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [subscribeResult, setSubscribeResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Detecta o domínio público do navegador
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const fullWebhookUrl = `${origin || "https://seu-dominio.vercel.app"}${settings.webhookCallbackUrl}`;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleTestConnection = () => {
    setTestResult(null);
    startTransition(async () => {
      const res = await testMetaConnection();
      if (res.ok) {
        setTestResult({
          tested: true,
          ok: true,
          message: res.mock
            ? "Conexão validada com sucesso em Modo Simulado (Mock ativo)."
            : `Conectado com sucesso à conta @${res.username} (${res.name || "Instagram"})!`,
        });
      } else {
        setTestResult({
          tested: true,
          ok: false,
          message: res.error || "Falha ao validar credenciais da Meta.",
        });
      }
    });
  };

  const handleRenewToken = () => {
    setRenewResult(null);
    startTransition(async () => {
      const res = await renewMetaToken();
      if (res.ok) {
        setRenewResult({
          ok: true,
          message: `Token da Meta renovado com sucesso! Válido por mais ${res.expiresInDays} dias.`,
        });
      } else {
        setRenewResult({
          ok: false,
          message: res.error || "Erro ao renovar token da Meta.",
        });
      }
    });
  };

  const handleSubscribe = () => {
    setSubscribeResult(null);
    startTransition(async () => {
      const res = await subscribeMetaWebhooks();
      if (res.ok) {
        setSubscribeResult({
          ok: true,
          message: "Campos 'comments' e 'messages' inscritos com sucesso na Meta via API!",
        });
      } else {
        setSubscribeResult({
          ok: false,
          message: res.error || "Falha ao registrar webhooks na Meta.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-100 text-ink">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface-200/90 backdrop-blur-md px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Settings size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-ink">Ajustes & Conexão Meta</h1>
              <span className="rounded-full bg-accent-muted/20 px-2 py-0.5 text-xs font-semibold text-accent">
                Etapa 7 · Meta for Developers
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Configure sua integração oficial com a Instagram Messaging API, webhooks e permissões da Meta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-300 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-300/80"
            >
              <span>Abrir Meta for Developers</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 space-y-8">
        {/* ── CARD 1: Status da Conexão Instagram ────────────────────────── */}
        <section className="rounded-3xl border border-border bg-surface-200 p-6 md:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-ink">Canal Instagram Conectado</h2>
                  {settings.isMockMode ? (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 border border-amber-500/20">
                      Modo Simulado (Sem Chaves)
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                      Conexão Ativa
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Conta vinculada: <strong>@{settings.account.username}</strong> ({settings.account.name || "Instagram Profissional"})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3.5 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95 disabled:opacity-50"
              >
                <Zap size={14} className="text-primary" />
                <span>Testar Conexão</span>
              </button>
              <button
                type="button"
                onClick={handleRenewToken}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3.5 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95 disabled:opacity-50"
                title="Renovar token de 60 dias"
              >
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                <span>Renovar Token (60d)</span>
              </button>
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition active:scale-95 disabled:opacity-50"
              >
                <Radio size={14} />
                <span>Inscrever Webhooks</span>
              </button>
            </div>
          </div>

          {/* Feedbacks de Ações */}
          {testResult && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-2xl p-4 text-xs font-semibold ${
                testResult.ok
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-danger/10 text-danger border border-danger/20"
              }`}
            >
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {renewResult && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-2xl p-4 text-xs font-semibold ${
                renewResult.ok
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-danger/10 text-danger border border-danger/20"
              }`}
            >
              {renewResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{renewResult.message}</span>
            </div>
          )}

          {subscribeResult && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-2xl p-4 text-xs font-semibold ${
                subscribeResult.ok
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-danger/10 text-danger border border-danger/20"
              }`}
            >
              {subscribeResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{subscribeResult.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-xs">
            <div className="rounded-2xl bg-surface-100 p-4 border border-border">
              <span className="text-ink-subtle block mb-1">Instagram Account ID</span>
              <span className="font-mono font-bold text-ink select-all">{settings.account.igUserId}</span>
            </div>
            <div className="rounded-2xl bg-surface-100 p-4 border border-border">
              <span className="text-ink-subtle block mb-1">Status do Token</span>
              <span className="font-bold text-ink">
                {settings.hasAccessToken ? "🟢 Configurado no .env" : "🟡 Modo Mock (Simulado)"}
              </span>
            </div>
            <div className="rounded-2xl bg-surface-100 p-4 border border-border">
              <span className="text-ink-subtle block mb-1">App Secret da Meta</span>
              <span className="font-bold text-ink">
                {settings.hasAppSecret ? "🟢 Protegido com HMAC" : "🟡 Modo Mock Ativo"}
              </span>
            </div>
          </div>
        </section>

        {/* ── CARD 2: Dados para colar no Meta for Developers (Webhook) ───── */}
        <section className="rounded-3xl border border-border bg-surface-200 p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Globe size={18} />
            </div>
            <h2 className="text-lg font-bold text-ink">Dados do Webhook da Meta</h2>
          </div>
          <p className="text-xs text-ink-muted mb-6">
            Cole estas informações no painel do <strong>Meta for Developers › Seu App › Instagram › Webhooks</strong> para ativar as respostas automáticas.
          </p>

          <div className="space-y-4">
            {/* Callback URL */}
            <div>
              <label className="text-xs font-bold text-ink mb-1 block">URL de Retorno de Chamada (Callback URL)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fullWebhookUrl}
                  className="flex-1 rounded-xl border border-border bg-surface-100 px-3.5 py-2 font-mono text-xs text-ink select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(fullWebhookUrl, "url")}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
                >
                  {copiedField === "url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedField === "url" ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {/* Verify Token */}
            <div>
              <label className="text-xs font-bold text-ink mb-1 block">Token de Verificação (Verify Token)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={settings.webhookVerifyToken}
                  className="flex-1 rounded-xl border border-border bg-surface-100 px-3.5 py-2 font-mono text-xs text-ink select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(settings.webhookVerifyToken, "token")}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
                >
                  {copiedField === "token" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedField === "token" ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {/* Campos de Assinatura */}
            <div className="p-4 rounded-2xl bg-surface-100 border border-border">
              <span className="text-xs font-bold text-ink block mb-1.5">Campos Obrigatórios para Assinar no Webhook:</span>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-surface-300 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-border">
                  comments
                </span>
                <span className="rounded-lg bg-surface-300 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-border">
                  messages
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── CARD 3: Modelos Prontos para App Review da Meta ─────────────── */}
        <section className="rounded-3xl border border-border bg-surface-200 p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <h2 className="text-lg font-bold text-ink">Textos de Justificativa para App Review da Meta</h2>
          </div>
          <p className="text-xs text-ink-muted mb-6">
            Se for disponibilizar o app para contas de terceiros ou solicitar acesso avançado, copie e cole estas justificativas aprovadas:
          </p>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-xs text-primary">instagram_business_manage_messages</span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      "After a follower comments a configured keyword, we send that follower a one-time private reply with content the account owner set up, typically a link or answer the follower asked for by commenting. This is the standard Instagram comment-to-DM flow. We send one reply per matching comment and respect Meta's rate limits.",
                      "rev_msg"
                    )
                  }
                  className="text-xs font-bold text-ink-subtle hover:text-ink flex items-center gap-1"
                >
                  {copiedField === "rev_msg" ? "Copiado!" : "Copiar Texto"}
                </button>
              </div>
              <p className="text-xs text-ink-muted italic">
                “After a follower comments a configured keyword, we send that follower a one-time private reply with content the account owner set up, typically a link or answer the follower asked for by commenting. This is the standard Instagram comment-to-DM flow. We send one reply per matching comment and respect Meta&apos;s rate limits.”
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-xs text-primary">instagram_business_manage_comments</span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      "When a follower comments a keyword the account owner configured on the owner's own post or reel, we receive the comment through the comments webhook and, if the owner enabled it, post a public reply under that comment. We only act on comments on the connecting account's own media.",
                      "rev_comm"
                    )
                  }
                  className="text-xs font-bold text-ink-subtle hover:text-ink flex items-center gap-1"
                >
                  {copiedField === "rev_comm" ? "Copiado!" : "Copiar Texto"}
                </button>
              </div>
              <p className="text-xs text-ink-muted italic">
                “When a follower comments a keyword the account owner configured on the owner&apos;s own post or reel, we receive the comment through the comments webhook and, if the owner enabled it, post a public reply under that comment. We only act on comments on the connecting account&apos;s own media.”
              </p>
            </div>
          </div>
        </section>

        {/* ── CARD 4: Roteiro do Vídeo Screencast (2 Minutos) ─────────────── */}
        <section className="rounded-3xl border border-border bg-surface-200 p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Video size={18} />
            </div>
            <h2 className="text-lg font-bold text-ink">Roteiro para Gravação do Screencast da Meta</h2>
          </div>
          <p className="text-xs text-ink-muted mb-4">
            Grave a tela do computador e do celular (1 take contínuo de 2 minutos narrado em inglês ou com legendas):
          </p>

          <ol className="list-decimal pl-5 space-y-2 text-xs text-ink-muted">
            <li>
              <strong>Acesse o painel:</strong> Mostre a tela de <em>Automações</em> e abra o fluxo de teste com a palavra-chave configurada (ex: CASAMENTO).
            </li>
            <li>
              <strong>Abra o Instagram no celular com uma conta de teste:</strong> Publique um comentário com a palavra-chave no Reel ou Post selecionado.
            </li>
            <li>
              <strong>Mostre a resposta imediata:</strong> O seguidor recebe a resposta pública no comentário e a DM privada com o botão fixo.
            </li>
            <li>
              <strong>Mostre o painel web:</strong> Atualize a página e mostre o lead cadastrado no <em>CRM de Contatos</em> e a mensagem gravada no <em>Live Inbox</em>.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
