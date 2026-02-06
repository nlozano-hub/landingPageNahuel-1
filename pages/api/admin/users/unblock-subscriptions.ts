import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { unblockUserSubscriptions } from '@/lib/subscriptionBlockService';

/**
 * API para desbloquear suscripciones de un usuario
 * POST: Desbloquea al usuario (no restaura suscripciones canceladas)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    // Verificar acceso de administrador
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Acceso denegado. Solo administradores pueden desbloquear usuarios.' 
      });
    }

    await dbConnect();

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'userId es requerido' 
      });
    }

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Desbloquear usuario
    const result = await unblockUserSubscriptions(userId);

    return res.status(200).json({
      success: true,
      message: 'Usuario desbloqueado exitosamente',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionBlocked: false
      }
    });

  } catch (error: any) {
    console.error('❌ Error desbloqueando usuario:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    });
  }
}
