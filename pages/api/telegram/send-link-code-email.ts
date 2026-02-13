import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramLinkCode from '@/models/TelegramLinkCode';
import { sendEmail } from '@/lib/emailService';

/**
 * API para enviar código de vinculación de Telegram por email
 * 
 * POST: Genera un código único y lo envía por email al usuario
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Si ya tiene Telegram vinculado, no necesita generar código
  if (user.telegramUserId) {
    return res.status(400).json({ 
      error: 'Ya tienes Telegram vinculado',
      telegramUserId: user.telegramUserId,
      telegramUsername: user.telegramUsername
    });
  }

  try {
    // Invalidar códigos anteriores no usados del mismo usuario
    await TelegramLinkCode.updateMany(
      { userId: user._id, used: false },
      { used: true, usedAt: new Date() }
    );

    // Generar código único de 6 dígitos
    let code: string = '';
    let codeExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (codeExists && attempts < maxAttempts) {
      // Generar código de 6 dígitos (100000 a 999999)
      code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Verificar que no exista
      const existing = await TelegramLinkCode.findOne({ code, used: false });
      codeExists = !!existing;
      attempts++;
    }

    if (attempts >= maxAttempts || !code) {
      return res.status(500).json({ error: 'Error generando código único. Intenta nuevamente.' });
    }

    // Crear código de vinculación (expira en 15 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const linkCode = new TelegramLinkCode({
      code,
      userId: user._id,
      email: user.email,
      expiresAt
    });

    await linkCode.save();

    // Usar variable de entorno o default - evita fetch HTTP que agregaba 300-1500ms de latencia
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'lozanoNahuel_bot';

    // Enviar email con el código (sin esperar fetch a bot-info)
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
          .button { display: inline-block; background: #0088cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
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
            
            <p>Has solicitado vincular tu cuenta de Telegram. Aquí está tu código de vinculación:</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Tu código de vinculación es:</p>
              <div class="code">${code}</div>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">⏰ Expira en 15 minutos</p>
            </div>
            
            <div class="instructions">
              <h3 style="margin-top: 0;">📱 Pasos para vincular:</h3>
              <ol>
                <li>Abre Telegram en tu dispositivo</li>
                <li>Busca el bot: <strong>@${botUsername}</strong> o <a href="https://t.me/${botUsername}" style="color: #0088cc;">haz clic aquí</a></li>
                <li>Envía el código: <strong style="color: #10B981; font-size: 18px;">${code}</strong></li>
                <li>El bot te confirmará cuando tu cuenta esté vinculada</li>
              </ol>
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este código expira en 15 minutos. Si no lo usas, deberás solicitar uno nuevo.
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

    console.log(`✅ [TELEGRAM LINK] Código enviado por email a ${user.email}: ${code}`);

    return res.status(200).json({
      success: true,
      code,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: 15,
      message: `Código enviado por email a ${user.email}`
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM LINK] Error enviando código por email:', error);
    return res.status(500).json({ error: 'Error enviando código por email' });
  }
}
