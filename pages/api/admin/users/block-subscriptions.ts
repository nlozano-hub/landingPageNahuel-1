import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { blockUserSubscriptions } from '@/lib/subscriptionBlockService';

/**
 * API para bloquear suscripciones de un usuario
 * POST: Bloquea al usuario y cancela todas sus suscripciones activas
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
        error: 'Acceso denegado. Solo administradores pueden bloquear usuarios.' 
      });
    }

    await dbConnect();

    const { userId, reason } = req.body;

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

    // Verificar que no se está bloqueando a sí mismo
    if (user.email === session.user.email) {
      return res.status(400).json({ 
        success: false,
        error: 'No puedes bloquear tu propia cuenta' 
      });
    }

    // Verificar que no se está bloqueando a otro admin
    if (user.role === 'admin') {
      return res.status(400).json({ 
        success: false,
        error: 'No puedes bloquear a otro administrador' 
      });
    }

    // Bloquear usuario y cancelar suscripciones
    const result = await blockUserSubscriptions(userId, reason);

    return res.status(200).json({
      success: true,
      message: `Usuario bloqueado exitosamente. ${result.cancelled} suscripción(es) cancelada(s).`,
      cancelled: result.cancelled,
      details: result.details,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionBlocked: true
      }
    });

  } catch (error: any) {
    console.error('❌ Error bloqueando usuario:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    });
  }
}
