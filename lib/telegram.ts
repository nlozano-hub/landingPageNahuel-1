/**
 * Helper para operaciones de Telegram con timeouts y manejo de rate limits.
 * NO loguear tokens.
 */

const REQUEST_TIMEOUT_MS = 8000;
const KICK_ERROR_MAX_LEN = 200;

export interface TelegramKickResult {
  success: boolean;
  error?: string;
  retryAfterSeconds?: number;
  errorType?: 'rate_limit' | 'transient' | 'permanent';
}

/**
 * Ejecuta kick (ban + unban) de usuario en un canal de Telegram.
 * Timeout 8s, manejo de 429, errores comunes capturados.
 */
export async function telegramKickUser(
  channelId: string,
  telegramUserId: number,
  botToken: string
): Promise<TelegramKickResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const baseUrl = `https://api.telegram.org/bot${botToken}`;

    const banRes = await fetch(`${baseUrl}/banChatMember`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        user_id: telegramUserId,
        revoke_messages: false
      })
    });

    clearTimeout(timeoutId);

    const banData = await banRes.json();
    if (!banData.ok) {
      if (banData.error_code === 429) {
        const retryAfter = banData.parameters?.retry_after ?? 60;
        return {
          success: false,
          error: `RATE_LIMIT retry_after=${retryAfter}`,
          retryAfterSeconds: retryAfter,
          errorType: 'rate_limit'
        };
      }
      const desc = (banData.description || '').toLowerCase();
      if (
        desc.includes('user_not_participant') ||
        desc.includes('not in the chat') ||
        desc.includes('not a member')
      ) {
        return { success: true };
      }
      if (
        desc.includes('not enough rights') ||
        desc.includes('user is an administrator') ||
        desc.includes('admin')
      ) {
        return {
          success: false,
          error: truncateError(banData.description || 'Permanent'),
          errorType: 'permanent'
        };
      }
      return {
        success: false,
        error: truncateError(
          banData.description || banData.error_code?.toString() || 'Unknown'
        ),
        errorType: 'permanent'
      };
    }

    await sleep(300);

    try {
      await fetch(`${baseUrl}/unbanChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: telegramUserId,
          only_if_banned: true
        })
      });
    } catch {
      // Unban fallido no es crítico
    }

    return { success: true };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Timeout (8s)',
        errorType: 'transient'
      };
    }
    const msg = err.message || 'Unknown error';
    const isTransient =
      /timeout|econnreset|enotfound|network|econnrefused/i.test(msg);
    return {
      success: false,
      error: truncateError(msg),
      errorType: isTransient ? 'transient' : 'permanent'
    };
  }
}

function truncateError(msg: string): string {
  if (msg.length <= KICK_ERROR_MAX_LEN) return msg;
  return msg.slice(0, KICK_ERROR_MAX_LEN - 3) + '...';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía mensaje al usuario explicando que fue expulsado por suscripción vencida.
 * No lanza: fallos se ignoran para no bloquear el flujo del cron.
 */
export async function sendKickNotification(
  telegramUserId: number,
  service: 'TraderCall' | 'SmartMoney',
  botToken: string
): Promise<void> {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  const serviceName = service === 'TraderCall' ? 'Trader Call' : 'Smart Money';
  const alertasPath = service === 'TraderCall' ? 'trader-call' : 'smart-money';
  const baseUrlSite = process.env.NEXTAUTH_URL || 'https://lozanonahuel.com';

  const motivoMensaje = `Tu suscripción a *${serviceName}* ha *expirado*.`;
  const solucionMensaje =
    `Para seguir recibiendo alertas, renueva tu suscripción en:\n` +
    `🔗 ${baseUrlSite}/alertas/${alertasPath}\n\n` +
    `Una vez renovada, podrás gestionar un nuevo link de invitación.`;

  const text =
    `⚠️ *Has sido removido del canal de ${serviceName}*\n\n` +
    `${motivoMensaje}-\n\n` +
    `*¿Qué hacer ahora?*\n\n` +
    `${solucionMensaje}\n\n` +
    `💡 *¿Necesitas ayuda?*\n` +
    `Contacta a soporte: soporte@lozanonahuel.com\n\n` +
    `¡Gracias por ser parte de nuestra comunidad! 🚀`;

  try {
    const res = await fetch(`${baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text,
        parse_mode: 'Markdown'
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(
        `[telegram] No se pudo notificar kick a ${telegramUserId}: ${data.description || 'Unknown'}`
      );
    }
  } catch (err: any) {
    console.warn(`[telegram] Error enviando notificación de kick: ${err?.message || 'Unknown'}`);
  }
}

/**
 * Verifica si un error es "recuperable" (reintentar en próxima corrida).
 */
export function isRetryableError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('timeout') ||
    lower.includes('network')
  );
}
