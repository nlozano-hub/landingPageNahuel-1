import { NextApiRequest, NextApiResponse } from 'next';
import TelegramBot from 'node-telegram-bot-api';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramLinkCode from '@/models/TelegramLinkCode';

/**
 * Webhook para recibir mensajes del bot de Telegram
 * 
 * Este endpoint procesa:
 * - Comandos del bot (/start, /link, /help)
 * - Códigos de vinculación enviados por usuarios
 * - Mensajes directos al bot
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo aceptar POST (webhooks de Telegram)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar que el bot esté configurado
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
    return res.status(200).json({ ok: true, message: 'Bot no configurado' });
  }

  try {
    await dbConnect();
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    
    // Obtener información del bot (username, etc.)
    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;

    const update = req.body;
    
    // Verificar que sea un update válido de Telegram
    if (!update || !update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const telegramUserId = message.from?.id;
    const telegramUsername = message.from?.username;
    const text = message.text || '';

    console.log(`📨 [TELEGRAM WEBHOOK] Mensaje recibido de ${telegramUsername || telegramUserId}: ${text}`);

    // Procesar comandos
    if (text.startsWith('/')) {
      await handleCommand(bot, chatId, telegramUserId, telegramUsername, text, botUsername);
    } else {
      // Procesar como código de vinculación o mensaje normal
      await handleMessage(bot, chatId, telegramUserId, telegramUsername, text, botUsername);
    }

    // Responder a Telegram que recibimos el mensaje
    return res.status(200).json({ ok: true });

  } catch (error: any) {
    console.error('❌ [TELEGRAM WEBHOOK] Error procesando webhook:', error);
    return res.status(200).json({ ok: true }); // Siempre responder OK a Telegram
  }
}

/**
 * Maneja comandos del bot (/start, /link, /help)
 */
async function handleCommand(
  bot: TelegramBot,
  chatId: number,
  telegramUserId: number | undefined,
  telegramUsername: string | undefined,
  text: string,
  botUsername?: string
) {
  const command = text.split(' ')[0].toLowerCase();
  const botMention = botUsername ? `@${botUsername}` : 'el bot';

  switch (command) {
    case '/start':
    case '/help':
      await bot.sendMessage(
        chatId,
        `👋 ¡Hola! Soy el bot de Lozano Nahuel.\n\n` +
        `📋 *Comandos disponibles:*\n\n` +
        `🔗 /link - Vincular tu cuenta de Telegram con tu cuenta web\n` +
        `ℹ️ /help - Mostrar esta ayuda\n\n` +
        `*¿Cómo vincular mi cuenta?*\n\n` +
        `1️⃣ Ve a tu perfil en la web:\n` +
        `   ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil\n\n` +
        `2️⃣ Haz clic en "Generar Código de Vinculación"\n\n` +
        `3️⃣ Envíame el código de 6 dígitos aquí y te vincularé automáticamente\n\n` +
        `💡 También puedes enviarme directamente el código de 6 dígitos que generaste.\n\n` +
        `Ejemplo: \`123456\``,
        { parse_mode: 'Markdown' }
      );
      break;

    case '/link':
      await bot.sendMessage(
        chatId,
        `🔗 *Vincular cuenta*\n\n` +
        `Para vincular tu cuenta:\n\n` +
        `1️⃣ Ve a tu perfil:\n` +
        `   ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil\n\n` +
        `2️⃣ Haz clic en "Generar Código de Vinculación"\n\n` +
        `3️⃣ Envíame el código aquí (6 dígitos)\n\n` +
        `Ejemplo: \`123456\`\n\n` +
        `⏱️ Los códigos expiran en 15 minutos.`,
        { parse_mode: 'Markdown' }
      );
      break;

    default:
      await bot.sendMessage(
        chatId,
        `❓ Comando no reconocido. Usa /help para ver los comandos disponibles.`
      );
  }
}

/**
 * Maneja mensajes de texto (códigos de vinculación o mensajes normales)
 */
async function handleMessage(
  bot: TelegramBot,
  chatId: number,
  telegramUserId: number | undefined,
  telegramUsername: string | undefined,
  text: string,
  botUsername?: string
) {
  if (!telegramUserId) {
    await bot.sendMessage(chatId, `❌ No se pudo identificar tu usuario de Telegram.`);
    return;
  }

  // Limpiar texto (eliminar espacios y caracteres especiales)
  const cleanText = text.trim().replace(/\s+/g, '');

  // Verificar si es un código de 6 dígitos
  if (/^\d{6}$/.test(cleanText)) {
    await handleLinkCode(bot, chatId, telegramUserId, telegramUsername, cleanText);
  } else {
    // Mensaje normal - responder con ayuda
    await bot.sendMessage(
      chatId,
      `💬 Para vincular tu cuenta, necesitas enviarme un código de 6 dígitos.\n\n` +
      `📋 *Pasos:*\n` +
      `1. Ve a tu perfil:\n` +
      `   ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil\n\n` +
      `2. Haz clic en "Generar Código de Vinculación"\n\n` +
      `3. Envíame el código aquí (6 dígitos)\n\n` +
      `Ejemplo: \`123456\`\n\n` +
      `Usa /help para más información.`,
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Procesa un código de vinculación
 */
async function handleLinkCode(
  bot: TelegramBot,
  chatId: number,
  telegramUserId: number,
  telegramUsername: string | undefined,
  code: string
) {
  try {
    // Buscar código no usado y no expirado
    const linkCode = await TelegramLinkCode.findOne({
      code,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!linkCode) {
      await bot.sendMessage(
        chatId,
        `❌ Código inválido o expirado.\n\n` +
        `El código que enviaste no existe, ya fue usado o expiró (los códigos expiran en 15 minutos).\n\n` +
        `Genera un nuevo código desde tu perfil: ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
      );
      return;
    }

    // Verificar que el telegramUserId no esté ya vinculado a otra cuenta
    const existingUser = await User.findOne({
      telegramUserId,
      _id: { $ne: linkCode.userId }
    });

    if (existingUser) {
      await bot.sendMessage(
        chatId,
        `⚠️ Este Telegram ya está vinculado a otra cuenta (${existingUser.email}).\n\n` +
        `Si crees que es un error, contacta al soporte.`
      );
      return;
    }

    // Obtener el usuario que generó el código
    const user = await User.findById(linkCode.userId);
    if (!user) {
      await bot.sendMessage(chatId, `❌ Error: Usuario no encontrado.`);
      return;
    }

    // Verificar que el usuario no tenga ya Telegram vinculado
    if (user.telegramUserId && user.telegramUserId !== telegramUserId) {
      await bot.sendMessage(
        chatId,
        `⚠️ Esta cuenta web ya tiene otro Telegram vinculado.\n\n` +
        `Si necesitas cambiar la vinculación, desvincula primero desde tu perfil.`
      );
      return;
    }

    // Vincular la cuenta
    user.telegramUserId = telegramUserId;
    user.telegramUsername = telegramUsername || null;
    user.telegramLinkedAt = new Date();
    await user.save();

    // Marcar código como usado
    linkCode.used = true;
    linkCode.usedAt = new Date();
    linkCode.telegramUserId = telegramUserId;
    linkCode.telegramUsername = telegramUsername || null;
    await linkCode.save();

    console.log(`✅ [TELEGRAM LINK] Cuenta vinculada: ${user.email} -> ${telegramUserId} (@${telegramUsername || 'sin username'})`);

    // Enviar confirmación al usuario
    await bot.sendMessage(
      chatId,
      `✅ *¡Cuenta vinculada exitosamente!*\n\n` +
      `Tu cuenta de Telegram ha sido vinculada con:\n` +
      `📧 Email: ${user.email}\n` +
      `👤 Nombre: ${user.name}\n\n` +
      `Ahora recibirás todas las alertas de tus suscripciones activas en este chat.\n\n` +
      `💡 *Próximos pasos:*\n` +
      `1. Genera links de invitación desde tu perfil para unirte a los canales\n` +
      `2. Recibirás alertas automáticamente cuando estés en los canales\n\n` +
      `¡Gracias por ser parte de nuestra comunidad! 🚀`,
      { parse_mode: 'Markdown' }
    );

  } catch (error: any) {
    console.error('❌ [TELEGRAM WEBHOOK] Error procesando código:', error);
    await bot.sendMessage(
      chatId,
      `❌ Ocurrió un error al vincular tu cuenta. Por favor, intenta nuevamente o contacta al soporte.`
    );
  }
}
