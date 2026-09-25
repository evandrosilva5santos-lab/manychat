// Prévia da conversa como o contato vê no Instagram (componente DmPreview do design system).
import { formatDelay } from "@/lib/flow/nodes";
import type { Recipe } from "@/lib/flow/recipe";

function Bot({ text, button }: { text: string; button?: string }) {
  if (!button) return <div className="fx-bubble">{text || "…"}</div>;
  return (
    <div className="fx-dm-card">
      <div className="fx-bubble">{text || "…"}</div>
      <div className="fx-dm-btn">{button || "BOTÃO"}</div>
    </div>
  );
}

const Me = ({ children }: { children: React.ReactNode }) => <div className="fx-bubble fx-bubble-me">{children}</div>;

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="self-center py-1 text-center text-[11px] text-ink-subtle">{children}</div>
);

export function DmPreview({ recipe }: { recipe: Recipe }) {
  const keyword = recipe.trigger.keywords[0] ?? "palavra-chave";
  const publicReply = recipe.trigger.publicReplies.enabled
    ? recipe.trigger.publicReplies.variations.find((reply) => reply.trim())
    : undefined;

  return (
    <div className="fx-phone w-[340px]! gap-2!" aria-label="Prévia da conversa">
      <Note>Comentário na publicação</Note>
      <div className="fx-bubble">
        <b>@contato</b> {keyword}
      </div>
      {publicReply && (
        <div className="fx-bubble ml-6">
          <b>@seu_perfil</b> {publicReply}
        </div>
      )}

      <Note>Direct</Note>
      <Bot text={recipe.welcome.text} button={recipe.welcome.buttonTitle} />
      <Me>{recipe.welcome.buttonTitle || "BOTÃO"}</Me>

      {recipe.followGate.enabled && (
        <>
          <Note>Se ainda não segue o perfil</Note>
          <Bot text={recipe.followGate.text} button={recipe.followGate.buttonTitle} />
          <Me>{recipe.followGate.buttonTitle || "BOTÃO"}</Me>
          <Note>Já segue: continua</Note>
        </>
      )}

      <Bot text={recipe.link.text} button={recipe.link.buttonTitle} />

      {recipe.reminder.enabled && (
        <>
          <Note>Não abriu o link em {formatDelay(recipe.reminder.delaySeconds)}</Note>
          <Bot text={recipe.reminder.text} button={recipe.reminder.buttonTitle} />
        </>
      )}
    </div>
  );
}
