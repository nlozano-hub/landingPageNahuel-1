import { NextApiRequest, NextApiResponse } from 'next';
import TelegramBot from 'node-telegram-bot-api';
import { verifyAdminAccess } from '@/lib/adminAuth';

/**
 * Endpoint para configurar el webhook de Telegram
 * 
 * POST: Configura el webhook del bot para recibir mensajes
 * Solo accesible por administradores
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar que sea admin
  const verification = await verifyAdminAccess({ req, res } as any);
  if (!verification.isAdmin) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
    return res.status(400).json({ error: 'Bot de Telegram no configurado' });
  }

  try {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    
    // URL del webhook (debe ser HTTPS en producción)
    const webhookUrl = `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/api/telegram/webhook`;
    
    // Configurar webhook
    await bot.setWebHook(webhookUrl);
    
    // Obtener información del webhook
    const webhookInfo = await bot.getWebHookInfo();
    
    console.log(`✅ [TELEGRAM] Webhook configurado: ${webhookUrl}`);
    
    return res.status(200).json({
      success: true,
      webhookUrl,
      webhookInfo: {
        url: webhookInfo.url,
        hasCustomCertificate: webhookInfo.has_custom_certificate,
        pendingUpdateCount: webhookInfo.pending_update_count,
        lastErrorDate: webhookInfo.last_error_date,
        lastErrorMessage: webhookInfo.last_error_message,
        maxConnections: webhookInfo.max_connections
      },
      message: 'Webhook configurado correctamente'
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error configurando webhook:', error);
    return res.status(500).json({ 
      error: 'Error configurando webhook',
      details: error.message 
    });
  }
}
