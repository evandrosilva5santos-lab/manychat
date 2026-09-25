/**
 * Calcula se a janela de 24 horas da Meta para mensagens no Direct do Instagram está ativa.
 *
 * Pela política oficial da Meta:
 * - A janela de 24h abre quando o seguidor envia uma mensagem ou comenta.
 * - Dentro dessas 24 horas, você pode enviar DMs livremente (automáticas ou manuais).
 * - Após as 24 horas, o envio livre é bloqueado até que o seguidor mande uma nova mensagem.
 */
export function check24hWindow(lastInboundAt: Date | string | null): {
  is24hActive: boolean;
  remainingHours: number;
} {
  if (!lastInboundAt) return { is24hActive: false, remainingHours: 0 };
  const lastTime = new Date(lastInboundAt).getTime();
  const diffMs = Date.now() - lastTime;
  const max24hMs = 24 * 60 * 60 * 1000;

  if (diffMs < max24hMs) {
    const remainingMs = max24hMs - diffMs;
    const remainingHours = Math.max(1, Math.round(remainingMs / (1000 * 60 * 60)));
    return { is24hActive: true, remainingHours };
  }
  return { is24hActive: false, remainingHours: 0 };
}
