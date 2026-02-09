import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Lista usuarios SIN Telegram vinculado.
 * Solo lectura - NO envía emails ni realiza ninguna acción.
 * GET: Devuelve usuarios que no tienen telegramUserId
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    await dbConnect();

    const now = new Date();

    const usersWithoutTelegram = await User.find({
      $or: [
        { telegramUserId: { $exists: false } },
        { telegramUserId: null }
      ]
    })
      .select('email name role suscripciones subscriptions activeSubscriptions createdAt')
      .lean();

    const usersWithSubscriptionInfo = usersWithoutTelegram.map((u: any) => {
      const servicesWithActiveSubscription: string[] = [];

      for (const service of ['TraderCall', 'SmartMoney']) {
        const suscripcionActiva = u.suscripciones?.find(
          (s: any) => s.servicio === service && s.activa === true && new Date(s.fechaVencimiento) > now
        );
        const subscriptionActiva = u.subscriptions?.find(
          (s: any) => s.tipo === service && s.activa === true && (s.fechaFin ? new Date(s.fechaFin) > now : true)
        );
        const activeSubscription = u.activeSubscriptions?.find(
          (s: any) => s.service === service && s.isActive === true && new Date(s.expiryDate) > now
        );

        if (suscripcionActiva || subscriptionActiva || activeSubscription) {
          servicesWithActiveSubscription.push(service === 'TraderCall' ? 'Trader Call' : 'Smart Money');
        }
      }

      return {
        _id: u._id.toString(),
        email: u.email,
        name: u.name || '-',
        role: u.role,
        servicesWithActiveSubscription,
        hasActiveSubscription: servicesWithActiveSubscription.length > 0,
        createdAt: u.createdAt
      };
    });

    // Ordenar: primero los que tienen suscripción activa, luego por email
    usersWithSubscriptionInfo.sort((a: any, b: any) => {
      if (a.hasActiveSubscription && !b.hasActiveSubscription) return -1;
      if (!a.hasActiveSubscription && b.hasActiveSubscription) return 1;
      return (a.email || '').localeCompare(b.email || '');
    });

    return res.status(200).json({
      success: true,
      users: usersWithSubscriptionInfo,
      total: usersWithSubscriptionInfo.length,
      withActiveSubscription: usersWithSubscriptionInfo.filter((u: any) => u.hasActiveSubscription).length
    });
  } catch (error: any) {
    console.error('Error en /api/admin/users-telegram-unlinked:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios',
      details: error.message
    });
  }
}
