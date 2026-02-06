import { NextApiRequest, NextApiResponse } from 'next';
import TelegramBot from 'node-telegram-bot-api';

/**
 * API para obtener información del bot de Telegram
 * 
 * GET: Retorna información pública del bot (username, etc.)
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
    return res.status(200).json({
      success: false,
      enabled: false,
      message: 'Bot de Telegram no configurado'
    });
  }

  try {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    const botInfo = await bot.getMe();
    
    return res.status(200).json({
      success: true,
      enabled: true,
      username: botInfo.username,
      firstName: botInfo.first_name,
      id: botInfo.id
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error obteniendo info del bot:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error obteniendo información del bot',
      details: error.message 
    });
  }
}
