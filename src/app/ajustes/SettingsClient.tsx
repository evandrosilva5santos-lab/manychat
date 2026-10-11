"use client";

import React, { useState, useSyncExternalStore, useTransition } from "react";

const subscribeNoop = () => () => {};
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
  Smartphone,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  testMetaConnection,
  renewMetaToken,
  subscribeMetaWebhooks,
  revealWebhookVerifyToken,
  type MetaSettingsData,
} from "./actions";

interface SettingsClientProps {
  initialSettings: MetaSettingsData;
  oauthSuccess?: string | boolean | false;
  oauthError?: string | null;
}

export function SettingsClient({ initialSettings, oauthSuccess, oauthError }: SettingsClientProps) {
  const [settings] = useState<MetaSettingsData>(initialSettings);
  // Domínio público do navegador (vazio na renderização do servidor).
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
  } | null>(null);
  const [renewResult, setRenewResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [subscribeResult, setSubscribeResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!settings.account) {
    return (
      <main className="fx flex min-h-full items-center justify-center bg-surface-100 p-6 text-ink">
        <section className="max-w-lg rounded-2xl border border-border bg-surface-200 p-8 text-center shadow-card">
          <h1 className="text-2xl font-bold">Conecte seu Instagram</h1>
          <p className="mt-3 text-sm text-ink-muted">Escolha uma conta profissional para ativar contatos, conversas e automações.</p>
          <Link href="/conectar" className="fx-btn fx-btn-primary mt-6">Conectar meu Instagram</Link>
        </section>
      </main>
    );
  }

  const oauthBase = origin.startsWith("https://")
    ? origin
    : "https://manychat-evandrosilva5santos-7492s-projects.vercel.app";
  const fullOauthUrl = `${oauthBase}${settings.oauthRedirectUrl}`;
  const fullWebhookUrl = `${origin || "https://seu-dominio.vercel.app"}${settings.webhookCallbackUrl}`;

  const clientBase = origin.startsWith("https://")
    ? origin
    : "https://manychat-evandrosilva5santos-7492s-projects.vercel.app";
  const fullClientUrl = `${clientBase}/conectar`;
  const whatsappShareText = `Olá! Para ativarmos as automações e respostas automáticas no seu Instagram, acesse o link seguro oficial abaixo e autorize em 1 clique:\n\n👉 ${fullClientUrl}\n\nÉ 100% oficial pela Meta e leva menos de 1 minuto!`;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyVerifyToken = async () => {
    let token = revealedToken;
    if (!token) {
      const res = await revealWebhookVerifyToken();
      if (res.ok && res.token) {
        token = res.token;
        setRevealedToken(res.token);
      }
    }
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedField("verify_token");
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const handleToggleTokenVisibility = async () => {
    if (!revealedToken) {
      const res = await revealWebhookVerifyToken();
      if (res.ok && res.token) {
        setRevealedToken(res.token);
      }
    }
    setShowToken((prev) => !prev);
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
    <div className="flex flex-col min-h-full bg-surface-100 text-ink">
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
                Meta for Developers
              </span>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Painel do Administrador
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
        {/* Banner de Sucesso OAuth */}
        {oauthSuccess && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
            <div>
              <span>Conta {typeof oauthSuccess === "string" ? `@${oauthSuccess}` : ""} conectada com sucesso via Instagram Login!</span>
              <p className="text-xs text-ink-muted mt-0.5">O token oficial de 60 dias foi gerado, criptografado e as automações agora estão prontas para atender.</p>
            </div>
          </div>
        )}

        {/* Banner de Erro OAuth */}
        {oauthError && (
          <div className="flex items-center gap-3 rounded-2xl bg-danger/10 border border-danger/30 p-4 text-danger text-sm font-semibold">
            <AlertTriangle size={20} className="shrink-0 text-danger" />
            <div>
              <span>Erro na autorização do Instagram:</span>
              <p className="text-xs text-ink-muted mt-0.5 font-mono">{oauthError}</p>
            </div>
          </div>
        )}

        {/* ── CARD 0: Link de Conexão para Clientes (WhatsApp / Onboarding Limpo) ── */}
        <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-surface-200 to-surface-200 p-6 md:p-8 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
                <Smartphone size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-ink">Link de Conexão para Clientes</h2>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                    Área Exclusiva do Cliente (/conectar)
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Envie este link para seu cliente no WhatsApp. Ele só vê a tela de autorização do Instagram oficial, sem acesso às suas configurações técnicas ou dados de desenvolvedor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/conectar"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3.5 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
              >
                <span>Visualizar Tela do Cliente</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <div>
              <label className="text-xs font-bold text-ink mb-1.5 block">
                Link Oficial para Enviar ao Cliente (Cole no WhatsApp)
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fullClientUrl}
                  className="flex-1 rounded-xl border border-border bg-surface-100 px-3.5 py-2.5 font-mono text-xs text-ink select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(fullClientUrl, "client_url")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface-300 border border-border px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
                >
                  {copiedField === "client_url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedField === "client_url" ? "Link Copiado!" : "Copiar Link"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(whatsappShareText, "whatsapp_msg")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold transition active:scale-95 shadow-xs"
                >
                  {copiedField === "whatsapp_msg" ? <Check size={14} /> : <Send size={14} />}
                  <span>{copiedField === "whatsapp_msg" ? "Mensagem Copiada!" : "Copiar Texto p/ WhatsApp"}</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-100 p-4 text-xs text-ink-muted flex items-start gap-3">
              <ShieldCheck size={18} className="shrink-0 text-emerald-500 mt-0.5" />
              <div>
                <strong className="text-ink font-semibold block mb-0.5">
                  Isolamento Total do Cliente:
                </strong>
                <span>
                  O cliente faz login pela Meta e concede permissão. O token é criptografado automaticamente com AES-256 no banco de dados e a conta passa a aparecer logo abaixo em &ldquo;Contas Conectadas no Banco de Dados&rdquo;. O cliente nunca tem acesso a webhooks, tokens ou chaves do seu painel de controle.
                </span>
              </div>
            </div>
          </div>
        </section>

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
              <a
                href={settings.oauthLoginUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 transition active:scale-95"
              >
                <ShieldCheck size={14} />
                <span>Conectar com Instagram (OAuth)</span>
              </a>
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

        {/* ── CARD 2: Login da Empresa no Instagram (OAuth - Conectar Qualquer Conta) ── */}
        <section className="rounded-3xl border border-border bg-surface-200 p-6 md:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-xs">
                <Key size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Login da Empresa no Instagram (OAuth Oficial)</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Conecte qualquer conta de Instagram profissional com 1 clique via fluxo oficial da Meta.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`${settings.oauthLoginUrl}?mode=facebook`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95 transition active:scale-95"
              >
                <ShieldCheck size={16} />
                <span>Business Login Oficial (Doc Meta)</span>
              </a>
              <a
                href={`${settings.oauthLoginUrl}?mode=instagram`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-300 px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
              >
                <span>Login Direto Instagram</span>
              </a>
            </div>
          </div>

          <div className="space-y-5 mt-6">
            {/* Aviso sobre o erro 'O domínio dessa URL não está incluído nos domínios do app' */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-xs space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-2">
                  <strong className="text-amber-300 font-bold block text-sm">
                    Como resolver: &ldquo;O domínio dessa URL não está incluído nos domínios do app&rdquo;
                  </strong>
                  <p className="text-ink-muted leading-relaxed">
                    A Meta exige que o domínio de redirecionamento esteja registrado nas Configurações Básicas do seu aplicativo antes de permitir o login. Siga estes 2 passos no painel do <strong>Meta for Developers</strong>:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-ink-muted">
                    <li>
                      Acesse <strong>Configurações do app &rsaquo; Básico</strong>: no campo <strong>Domínios do app</strong>, digite <code className="bg-surface-300 px-1.5 py-0.5 rounded text-amber-300 font-mono">vercel.app</code> e adicione também em <strong>URL da Política de Privacidade</strong>.
                    </li>
                    <li>
                      Na mesma página, role até o final, clique em <strong>Adicionar Plataforma &rsaquo; Site</strong> e no campo <strong>URL do site</strong> coloque: <code className="bg-surface-300 px-1.5 py-0.5 rounded text-amber-300 font-mono">https://manychat-evandrosilva5santos-7492s-projects.vercel.app</code>.
                    </li>
                    <li>
                      Clique em <strong>Salvar alterações</strong> no rodapé da Meta.
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* OAuth Redirect URI */}
            <div>
              <label className="text-xs font-bold text-ink mb-1 block">
                URIs de Redirecionamento do OAuth Válidos (Cole no painel da Meta)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fullOauthUrl}
                  className="flex-1 rounded-xl border border-border bg-surface-100 px-3.5 py-2 font-mono text-xs text-ink select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(fullOauthUrl, "oauth_url")}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
                >
                  {copiedField === "oauth_url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedField === "oauth_url" ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {/* Lista de Contas Conectadas no Banco de Dados */}
            {settings.allAccounts.length > 0 && (
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-ink">
                    Contas Conectadas no Banco de Dados ({settings.allAccounts.length})
                  </span>
                  <span className="text-[11px] text-ink-subtle">
                    Tokens criptografados com AES-256-GCM
                  </span>
                </div>
                <div className="space-y-2">
                  {settings.allAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-border text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span className="font-bold text-ink">@{acc.username}</span>
                        {acc.name && <span className="text-ink-muted">({acc.name})</span>}
                        <span className="text-ink-subtle font-mono text-[11px]">ID: {acc.igUserId}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500 border border-emerald-500/20">
                          {acc.status}
                        </span>
                        {acc.tokenExpiresAt && (
                          <span className="text-[11px] text-ink-muted font-mono">
                            Expira: {new Date(acc.tokenExpiresAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── CARD 3: Dados para colar no Meta for Developers (Webhook) ───── */}
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
              <label className="text-xs font-bold text-ink mb-1 block">URL de Retorno de Chamada (Callback URL do Webhook)</label>
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
              {settings.webhookVerifyTokenConfigured ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type={showToken ? "text" : "password"}
                      readOnly
                      value={showToken && revealedToken ? revealedToken : (settings.webhookVerifyTokenHint || "")}
                      className="flex-1 rounded-xl border border-border bg-surface-100 px-3.5 py-2 font-mono text-xs text-ink select-all"
                    />
                    <button
                      type="button"
                      onClick={handleToggleTokenVisibility}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
                      title={showToken ? "Ocultar token" : "Revelar token"}
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showToken ? "Ocultar" : "Mostrar"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyVerifyToken}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3 py-2 text-xs font-bold text-ink hover:bg-surface-300/80 transition active:scale-95"
                    >
                      {copiedField === "verify_token" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span>{copiedField === "verify_token" ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    Cole este mesmo token no campo <strong>Token de Verificação</strong> ao editar o webhook no painel da Meta for Developers.
                  </p>
                </div>
              ) : (
                <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2 text-xs text-danger">
                  WEBHOOK_VERIFY_TOKEN não está configurado. Sem ele a Meta não consegue validar o webhook.
                </p>
              )}
            </div>

            {/* Campos de Assinatura */}
            <div className="p-4 rounded-2xl bg-surface-100 border border-border">
              <span className="text-xs font-bold text-ink block mb-1.5">Campos Obrigatórios para Assinar no Webhook:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-surface-300 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-border">
                  comments
                </span>
                <span className="rounded-lg bg-surface-300 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-border">
                  messages
                </span>
                <span className="rounded-lg bg-surface-300 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-border">
                  messaging_postbacks
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
