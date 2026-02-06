import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramLinkCode from '@/models/TelegramLinkCode';

/**
 * API para generar código de vinculación de Telegram
 * 
 * POST: Genera un código único de 6 dígitos que el usuario puede enviar al bot
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

    console.log(`✅ [TELEGRAM LINK] Código generado para ${user.email}: ${code}`);

    return res.status(200).json({
      success: true,
      code,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: 15,
      instructions: `Envía el código "${code}" al bot de Telegram para vincular tu cuenta.`
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM LINK] Error generando código:', error);
    return res.status(500).json({ error: 'Error generando código de vinculación' });
  }
}
