"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  CheckCircle2,
  CircleAlert,
  PauseCircle,
  Plus,
  Radio,
  RefreshCw,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  accountStatusLabel,
  describeValidity,
  tokenStoredLabel,
  type AccountTone,
} from "@/components/layout/account-status";
import {
  deleteCurrentInstagramProfile,
  disconnectCurrentInstagramProfile,
  renewMetaToken,
  subscribeMetaWebhooks,
  testMetaConnection,
  type MetaSettingsData,
} from "./actions";

type Notice = { ok: boolean; message: string };
type DialogKind = "disconnect" | "delete" | null;

const TONE_TEXT: Record<AccountTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-ink-muted",
};

export function StatusIcon({ tone, size = 16 }: { tone: AccountTone; size?: number }) {
  if (tone === "success") return <CheckCircle2 size={size} aria-hidden />;
  if (tone === "warning") return <CircleAlert size={size} aria-hidden />;
  return <PauseCircle size={size} aria-hidden />;
}

/** Card "Perfil carregado": estado em palavras, ações de rotina e zona de risco. */
export function ProfileCard({ settings }: { settings: MetaSettingsData }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();
  const account = settings.account;
  if (!account) return null;

  const status = accountStatusLabel(account.status);
  const connected = account.status === "CONNECTED";
  const isFacebook = account.authProvider === "FACEBOOK_LOGIN";
  const username = account.username;
  const loginHref = (mode: "instagram" | "facebook") => `${settings.oauthLoginUrl}?mode=${mode}`;
  const loginLabel = connected ? "Adicionar outro perfil" : "Carregar perfil de novo";
  const closeDialog = () => setDialog(null);

  const runRoutine = (action: () => Promise<Notice>) => {
    setNotice(null);
    startTransition(async () => setNotice(await action()));
  };

  const handleTest = () =>
    runRoutine(async () => {
      const res = await testMetaConnection();
      if (!res.ok) return { ok: false, message: res.error || "Falha ao validar credenciais da Meta." };
      return {
        ok: true,
        message: res.mock ? "Conexão validada em modo simulado." : `Conectado a @${res.username} (${res.name || "Instagram"}).`,
      };
    });

  const handleRenew = () =>
    runRoutine(async () => {
      const res = await renewMetaToken();
      if (!res.ok) return { ok: false, message: res.error || "Não foi possível renovar o acesso." };
      router.refresh();
      return { ok: true, message: res.message ?? `Acesso renovado. Válido por mais ${res.expiresInDays} dias.` };
    });

  const handleSubscribe = () =>
    runRoutine(async () => {
      const res = await subscribeMetaWebhooks();
      return res.ok
        ? { ok: true, message: "Webhooks de comentários e mensagens inscritos." }
        : { ok: false, message: res.error || "Não foi possível inscrever os webhooks." };
    });

  const confirmDisconnect = () =>
    startTransition(async () => {
      const res = await disconnectCurrentInstagramProfile();
      closeDialog();
      if (res.ok) {
        setNotice({ ok: true, message: `@${username} foi descarregado. As automações estão paradas.` });
        router.refresh();
      } else {
        setNotice({ ok: false, message: res.error ?? "Não foi possível descarregar o perfil." });
      }
    });

  const confirmDelete = (typed: string) =>
    startTransition(async () => {
      const res = await deleteCurrentInstagramProfile(typed);
      closeDialog();
      if (!res.ok) {
        setNotice({ ok: false, message: res.error ?? "Não foi possível excluir o perfil." });
        return;
      }
      setNotice({
        ok: true,
        message:
          res.status === "PENDING"
            ? "Excluindo… pode levar alguns minutos."
            : `@${username} e seus dados foram excluídos.`,
      });
      router.refresh();
    });

  return (
    <section aria-labelledby="perfil-carregado-title" className="rounded-xl border border-border bg-surface-200 p-6 shadow-card md:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
            <AtSign size={24} />
          </div>
          <div className="min-w-0">
            <h2 id="perfil-carregado-title" className="text-lg font-bold text-ink">
              Perfil carregado
            </h2>
            <p className="truncate text-base font-semibold text-ink">@{username}</p>
            <p className={`mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold ${TONE_TEXT[status.tone]}`}>
              <StatusIcon tone={status.tone} />
              {status.label}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={loginHref("instagram")} className="fx-btn fx-btn-primary">
            <Plus size={16} aria-hidden />
            {loginLabel}
          </a>
          <a href={loginHref("facebook")} className="fx-btn">
            {loginLabel} via Facebook
          </a>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Login">{isFacebook ? "Facebook" : "Instagram"}</Fact>
        <Fact label="Validade do acesso">{describeValidity(account)}</Fact>
        <Fact label="Token guardado">
          {tokenStoredLabel({ status: account.status, tokenStatus: account.tokenStatus, hasStoredToken: account.hasStoredToken })}
        </Fact>
        <Fact label="ID da conta do Instagram">
          <span className="font-mono select-all">{account.igUserId}</span>
        </Fact>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleTest} disabled={isPending || !connected} className="fx-btn">
          <Zap size={16} className="text-primary" aria-hidden />
          Testar conexão
        </button>
        {!isFacebook && (
          <button type="button" onClick={handleRenew} disabled={isPending || !connected} className="fx-btn">
            <RefreshCw size={16} className={isPending ? "animate-spin" : ""} aria-hidden />
            Renovar token
          </button>
        )}
        <button type="button" onClick={handleSubscribe} disabled={isPending || !connected} className="fx-btn">
          <Radio size={16} aria-hidden />
          Inscrever webhooks
        </button>
      </div>
      {!connected && (
        <p className="mt-2 text-sm text-ink-muted">Estas ações voltam a funcionar quando o perfil estiver conectado.</p>
      )}

      <div role="status" className="mt-4 empty:hidden">
        {notice && (
          <p
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${
              notice.ok ? "border-success bg-success-soft text-ink" : "border-danger bg-danger-soft text-ink"
            }`}
          >
            {notice.ok ? <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden /> : <TriangleAlert size={16} className="shrink-0 text-danger" aria-hidden />}
            <span>{notice.message}</span>
          </p>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-danger p-4" role="group" aria-labelledby="zona-risco-title">
        <h3 id="zona-risco-title" className="text-sm font-bold text-danger">
          Zona de risco
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setDialog("disconnect")}
              disabled={isPending || account.status === "DISCONNECTED"}
              className="fx-btn fx-btn-danger"
            >
              Descarregar perfil
            </button>
            <p className="text-sm text-ink-muted">Desconecta o Instagram do Fluxo</p>
          </div>
          <div className="space-y-1.5">
            <button type="button" onClick={() => setDialog("delete")} disabled={isPending} className="fx-btn fx-btn-danger">
              Excluir perfil e dados
            </button>
            <p className="text-sm text-ink-muted">Apaga para sempre os dados deste perfil no Fluxo</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "disconnect"}
        tone="danger"
        title={`Descarregar @${username}?`}
        description={
          <>
            <p>
              Isto desconecta o Instagram do Fluxo. Enquanto o perfil estiver descarregado, as automações ficam paradas: ninguém recebe
              respostas nem mensagens. Execuções em andamento são encerradas. Seus fluxos, contatos e conversas continuam guardados.
            </p>
            <p>
              Para voltar, clique em Carregar perfil de novo e entre com o Instagram. As automações voltam a funcionar sozinhas.
            </p>
          </>
        }
        confirmLabel="Descarregar perfil"
        busyLabel="Descarregando…"
        busy={isPending}
        onConfirm={() => confirmDisconnect()}
        onCancel={closeDialog}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        tone="danger"
        title={`Excluir @${username} e todos os dados?`}
        description={
          <p>
            Isto não pode ser desfeito. Serão apagados para sempre: contatos, conversas, fluxos, etiquetas, cards e links deste perfil. Nada é
            apagado no seu Instagram nem nos perfis de outros clientes. A exclusão acontece em partes e costuma levar alguns minutos (até 24
            horas em perfis muito grandes); você pode sair desta tela.
          </p>
        }
        confirmLabel="Excluir perfil e dados"
        busyLabel="Excluindo…"
        busy={isPending}
        requireText={username}
        requireTextLabel={`Para confirmar, digite o nome do perfil: @${username}`}
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      />
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-100 p-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{children}</dd>
    </div>
  );
}
