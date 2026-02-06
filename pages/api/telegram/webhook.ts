import { NextApiRequest, NextApiResponse } from 'next';
import TelegramBot from 'node-telegram-bot-api';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramLinkCode from '@/models/TelegramLinkCode';
import TelegramConversationState from '@/models/TelegramConversationState';
import { sendEmail } from '@/lib/emailService';

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

    // Verificar si hay un estado de conversación activo
    const conversationState = await TelegramConversationState.findOne({
      telegramUserId,
      expiresAt: { $gt: new Date() }
    });

    // Procesar comandos
    if (text.startsWith('/')) {
      // Limpiar estado de conversación si hay comando
      if (conversationState) {
        await TelegramConversationState.deleteOne({ telegramUserId });
      }
      await handleCommand(bot, chatId, telegramUserId, telegramUsername, text, botUsername);
    } else {
      // Si hay estado de conversación, procesar según el estado
      if (conversationState) {
        if (conversationState.state === 'waiting_email') {
          await handleEmailInput(bot, chatId, telegramUserId, telegramUsername, text, botUsername);
        } else if (conversationState.state === 'waiting_code') {
          await handleLinkCode(bot, chatId, telegramUserId, telegramUsername, text, conversationState);
        }
      } else {
        // Procesar como código de vinculación o mensaje normal
        await handleMessage(bot, chatId, telegramUserId, telegramUsername, text, botUsername);
      }
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
      // Iniciar flujo de vinculación pidiendo email
      await TelegramConversationState.findOneAndUpdate(
        { telegramUserId },
        {
          telegramUserId,
          state: 'waiting_email',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
        },
        { upsert: true, new: true }
      );

      await bot.sendMessage(
        chatId,
        `👋 ¡Hola! Soy el bot de Lozano Nahuel.\n\n` +
        `🔗 Para vincular tu cuenta de Telegram, necesito tu email.\n\n` +
        `📧 *Por favor, envía tu email de registro:*\n\n` +
        `Ejemplo: \`usuario@ejemplo.com\`\n\n` +
        `Una vez que lo envíes, te mandaré un código por email para completar la vinculación.`,
        { parse_mode: 'Markdown' }
      );
      break;

    case '/grupos':
      if (!telegramUserId) {
        await bot.sendMessage(chatId, `❌ No se pudo identificar tu usuario de Telegram.`);
        break;
      }
      await handleGruposCommand(bot, chatId, telegramUserId);
      break;

    case '/help':
      await bot.sendMessage(
        chatId,
        `👋 ¡Hola! Soy el bot de Lozano Nahuel.\n\n` +
        `📋 *Comandos disponibles:*\n\n` +
        `🔗 /start - Iniciar vinculación de cuenta (te pedirá tu email)\n` +
        `👥 /grupos - Ver grupos disponibles según tus suscripciones\n` +
        `ℹ️ /help - Mostrar esta ayuda\n\n` +
        `*¿Cómo vincular mi cuenta?*\n\n` +
        `1️⃣ Escribe /start\n\n` +
        `2️⃣ Envía tu email de registro\n\n` +
        `3️⃣ Recibirás un código por email\n\n` +
        `4️⃣ Envía el código aquí y te vincularé automáticamente\n\n` +
        `💡 También puedes generar un código desde tu perfil en la web si prefieres.`,
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
 * Maneja la entrada de email del usuario
 */
async function handleEmailInput(
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

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const email = text.trim().toLowerCase();

  if (!emailRegex.test(email)) {
    await bot.sendMessage(
      chatId,
      `❌ Email inválido. Por favor, envía un email válido.\n\n` +
      `Ejemplo: \`usuario@ejemplo.com\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    // Buscar usuario por email
    const user = await User.findOne({ email });
    
    if (!user) {
      await bot.sendMessage(
        chatId,
        `❌ No encontramos una cuenta con ese email.\n\n` +
        `Verifica que el email sea correcto o crea una cuenta en:\n` +
        `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}\n\n` +
        `Si crees que es un error, contacta al soporte.`
      );
      // Limpiar estado
      await TelegramConversationState.deleteOne({ telegramUserId });
      return;
    }

    // Verificar si el usuario ya tiene Telegram vinculado
    if (user.telegramUserId && user.telegramUserId !== telegramUserId) {
      await bot.sendMessage(
        chatId,
        `⚠️ Esta cuenta ya tiene otro Telegram vinculado.\n\n` +
        `Si necesitas cambiar la vinculación, desvincula primero desde tu perfil:\n` +
        `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
      );
      await TelegramConversationState.deleteOne({ telegramUserId });
      return;
    }

    // Verificar si este Telegram ya está vinculado a otra cuenta
    const existingUser = await User.findOne({
      telegramUserId,
      _id: { $ne: user._id }
    });

    if (existingUser) {
      await bot.sendMessage(
        chatId,
        `⚠️ Este Telegram ya está vinculado a otra cuenta (${existingUser.email}).\n\n` +
        `Si crees que es un error, contacta al soporte.`
      );
      await TelegramConversationState.deleteOne({ telegramUserId });
      return;
    }

    // Generar código único de 6 dígitos
    let code: string = '';
    let codeExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (codeExists && attempts < maxAttempts) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await TelegramLinkCode.findOne({ code, used: false });
      codeExists = !!existing;
      attempts++;
    }

    if (attempts >= maxAttempts || !code) {
      await bot.sendMessage(
        chatId,
        `❌ Error generando código. Por favor, intenta nuevamente con /start`
      );
      await TelegramConversationState.deleteOne({ telegramUserId });
      return;
    }

    // Crear código de vinculación (expira en 15 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Invalidar códigos anteriores no usados del mismo usuario
    await TelegramLinkCode.updateMany(
      { userId: user._id, used: false },
      { used: true, usedAt: new Date() }
    );

    const linkCode = new TelegramLinkCode({
      code,
      userId: user._id,
      email: user.email,
      expiresAt
    });

    await linkCode.save();

    // Obtener información del bot para incluir en el email
    let botUsernameForEmail = botUsername || 'lozanoNahuel_bot';

    // Enviar email con el código
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0088cc 0%, #0066aa 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 3px solid #10B981; border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0; }
          .code { font-size: 36px; font-weight: bold; color: #10B981; letter-spacing: 8px; font-family: 'Courier New', monospace; }
          .instructions { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .instructions ol { margin: 10px 0; padding-left: 20px; }
          .instructions li { margin: 10px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔗 Código de Vinculación de Telegram</h1>
          </div>
          <div class="content">
            <p>Hola ${user.fullName || user.email},</p>
            
            <p>Has solicitado vincular tu cuenta de Telegram desde el bot. Aquí está tu código de vinculación:</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Tu código de vinculación es:</p>
              <div class="code">${code}</div>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">⏰ Expira en 15 minutos</p>
            </div>
            
            <div class="instructions">
              <h3 style="margin-top: 0;">📱 Pasos para vincular:</h3>
              <ol>
                <li>Vuelve al chat del bot de Telegram</li>
                <li>Envía el código: <strong style="color: #10B981; font-size: 18px;">${code}</strong></li>
                <li>El bot te confirmará cuando tu cuenta esté vinculada</li>
              </ol>
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este código expira en 15 minutos. Si no lo usas, deberás solicitar uno nuevo con /start.
            </div>
            
            <p style="margin-top: 30px;">
              Si no solicitaste este código, puedes ignorar este email de forma segura.
            </p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas.</p>
            <p>&copy; ${new Date().getFullYear()} Lozano Nahuel - Todos los derechos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: user.email,
      subject: '🔗 Código de Vinculación de Telegram',
      html: emailHtml
    });

    // Actualizar estado de conversación para esperar el código
    await TelegramConversationState.findOneAndUpdate(
      { telegramUserId },
      {
        state: 'waiting_code',
        email: user.email,
        userId: user._id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
      },
      { upsert: true, new: true }
    );

    console.log(`✅ [TELEGRAM LINK] Código enviado por email a ${user.email} para ${telegramUserId}: ${code}`);

    await bot.sendMessage(
      chatId,
      `✅ *Email verificado*\n\n` +
      `📧 Hemos enviado un código de vinculación a:\n` +
      `\`${user.email}\`\n\n` +
      `📱 *Próximo paso:*\n` +
      `Revisa tu email y envía el código de 6 dígitos aquí.\n\n` +
      `⏱️ El código expira en 15 minutos.\n\n` +
      `Ejemplo: \`123456\``,
      { parse_mode: 'Markdown' }
    );

  } catch (error: any) {
    console.error('❌ [TELEGRAM WEBHOOK] Error procesando email:', error);
    await bot.sendMessage(
      chatId,
      `❌ Ocurrió un error al procesar tu email. Por favor, intenta nuevamente con /start`
    );
    await TelegramConversationState.deleteOne({ telegramUserId });
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
      `💬 Para vincular tu cuenta, escribe /start y sigue las instrucciones.\n\n` +
      `O envía un código de 6 dígitos si ya lo tienes.\n\n` +
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
  code: string,
  conversationState?: any
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

    // Limpiar estado de conversación si existe
    if (conversationState) {
      await TelegramConversationState.deleteOne({ telegramUserId });
    }

    console.log(`✅ [TELEGRAM LINK] Cuenta vinculada: ${user.email} -> ${telegramUserId} (@${telegramUsername || 'sin username'})`);

    // Enviar confirmación al usuario
    await bot.sendMessage(
      chatId,
      `✅ *¡Cuenta vinculada exitosamente!*\n\n` +
      `Tu cuenta de Telegram ha sido vinculada con:\n` +
      `📧 Email: ${user.email}\n` +
      `👤 Nombre: ${user.name || user.email}\n\n` +
      `💡 *Próximos pasos:*\n` +
      `1. Poné /grupos para ver los grupos disponibles según suscripción.\n` +
      `2. Recibirás alertas automáticamente en el chat grupal cuando estés en los canales!\n\n` +
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

/**
 * Maneja el comando /grupos - muestra grupos disponibles según suscripciones
 */
async function handleGruposCommand(
  bot: TelegramBot,
  chatId: number,
  telegramUserId: number
) {
  try {
    await dbConnect();

    // Buscar usuario por telegramUserId
    const user = await User.findOne({ telegramUserId });
    
    if (!user) {
      await bot.sendMessage(
        chatId,
        `❌ No tienes tu cuenta vinculada.\n\n` +
        `Escribe /start para vincular tu cuenta primero.`
      );
      return;
    }

    // Verificar que el bot esté configurado
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
      await bot.sendMessage(
        chatId,
        `❌ Bot de Telegram no configurado. Contacta al soporte.`
      );
      return;
    }

    // Mapeo de servicios a canales y nombres
    const SERVICES_MAP: Record<string, { channelId: string; name: string; emoji: string }> = {
      'TraderCall': {
        channelId: process.env.TELEGRAM_CHANNEL_TRADERCALL || '',
        name: 'Trader Call',
        emoji: '📈'
      },
      'SmartMoney': {
        channelId: process.env.TELEGRAM_CHANNEL_SMARTMONEY || '',
        name: 'Smart Money',
        emoji: '💰'
      }
    };

    // Obtener suscripciones activas
    const activeSubscriptions = user.activeSubscriptions?.filter(
      (sub: any) => sub.isActive && new Date(sub.expiryDate) > new Date()
    ) || [];

    // Si es admin, mostrar todos los grupos
    const servicesToShow = user.role === 'admin' 
      ? Object.keys(SERVICES_MAP)
      : activeSubscriptions.map((sub: any) => sub.service).filter((s: string) => SERVICES_MAP[s]);

    if (servicesToShow.length === 0) {
      await bot.sendMessage(
        chatId,
        `📭 *No tienes suscripciones activas*\n\n` +
        `No hay grupos disponibles para ti en este momento.\n\n` +
        `Para acceder a los grupos, necesitas tener una suscripción activa a alguno de nuestros servicios.\n\n` +
        `Visita: ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Enviar mensaje de carga
    const loadingMessage = await bot.sendMessage(
      chatId,
      `⏳ Generando links de invitación...`
    );

    const botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    const expireDate = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 1 día en segundos

    let message = `👥 *Grupos Disponibles*\n\n`;
    message += `Según tus suscripciones activas, puedes acceder a los siguientes grupos:\n\n`;

    const inviteLinks: Array<{ service: string; name: string; emoji: string; link: string }> = [];

    // Generar links para cada servicio
    for (const service of servicesToShow) {
      const serviceInfo = SERVICES_MAP[service];
      if (!serviceInfo || !serviceInfo.channelId) {
        continue;
      }

      try {
        // Generar link de invitación temporal
        const inviteLink = await botInstance.createChatInviteLink(serviceInfo.channelId, {
          expire_date: expireDate,
          member_limit: 1, // Solo 1 uso
          name: `${user.email} - ${service} - ${new Date().toISOString().split('T')[0]}`
        });

        inviteLinks.push({
          service,
          name: serviceInfo.name,
          emoji: serviceInfo.emoji,
          link: inviteLink.invite_link
        });

        // Actualizar telegramChannelAccess en el usuario
        if (!user.telegramChannelAccess) {
          user.telegramChannelAccess = [];
        }

        const existingAccess = user.telegramChannelAccess.find(
          (access: any) => access.service === service
        );

        if (existingAccess) {
          existingAccess.inviteLink = inviteLink.invite_link;
        } else {
          user.telegramChannelAccess.push({
            service,
            channelId: serviceInfo.channelId,
            joinedAt: new Date(),
            inviteLink: inviteLink.invite_link
          });
        }

      } catch (error: any) {
        console.error(`❌ [TELEGRAM] Error generando link para ${service}:`, error);
        // Continuar con los demás servicios aunque uno falle
      }
    }

    // Guardar cambios en el usuario
    await user.save();

    // Construir mensaje con los links
    if (inviteLinks.length === 0) {
      await bot.editMessageText(
        `❌ Error generando links de invitación. Por favor, intenta nuevamente más tarde.`,
        { chat_id: chatId, message_id: loadingMessage.message_id }
      );
      return;
    }

    message += `*Grupos disponibles:*\n\n`;

    for (const invite of inviteLinks) {
      message += `${invite.emoji} *${invite.name}*\n`;
      message += `🔗 [Unirse al grupo](${invite.link})\n\n`;
    }

    message += `⏱️ *Importante:*\n`;
    message += `• Los links expiran en 24 horas\n`;
    message += `• Cada link solo puede usarse 1 vez\n`;
    message += `• Si expira, usa /grupos para generar nuevos links\n\n`;
    message += `💡 Haz clic en los links para unirte a los grupos.`;

    // Editar el mensaje de carga con los resultados
    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: loadingMessage.message_id,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });

    console.log(`✅ [TELEGRAM] Links de grupos generados para ${user.email} (${inviteLinks.length} grupos)`);

  } catch (error: any) {
    console.error('❌ [TELEGRAM WEBHOOK] Error en comando /grupos:', error);
    await bot.sendMessage(
      chatId,
      `❌ Ocurrió un error al obtener los grupos. Por favor, intenta nuevamente más tarde o contacta al soporte.`
    );
  }
}
