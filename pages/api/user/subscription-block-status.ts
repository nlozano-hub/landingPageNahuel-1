import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { isUserBlocked } from '@/lib/subscriptionBlockService';

/**
 * API para verificar si el usuario actual está bloqueado para suscripciones
 * GET: Retorna el estado de bloqueo del usuario
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(200).json({ 
        isBlocked: false,
        message: 'Usuario no autenticado' 
      });
    }

    await dbConnect();

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(200).json({ 
        isBlocked: false,
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar si está bloqueado
    const blocked = await isUserBlocked(user);

    return res.status(200).json({
      isBlocked: blocked,
      subscriptionBlocked: user.subscriptionBlocked === true,
      reason: user.subscriptionBlockedReason || null
    });

  } catch (error: any) {
    console.error('❌ Error verificando bloqueo:', error);
    return res.status(500).json({ 
      isBlocked: false,
      error: error.message || 'Error interno del servidor' 
    });
  }
}
