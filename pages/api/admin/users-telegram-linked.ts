import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Lista usuarios CON Telegram vinculado.
 * Incluye toda la información: email, nombre, rol, telegramUserId, telegramUsername,
 * telegramLinkedAt, telegramChannelAccess, suscripciones, subscriptions, activeSubscriptions.
 * GET: Devuelve usuarios que tienen telegramUserId
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

    const usersWithTelegram = await User.find({
      telegramUserId: { $exists: true, $ne: null }
    })
      .select(
        'email name role picture createdAt lastLogin telegramUserId telegramUsername telegramLinkedAt telegramChannelAccess suscripciones subscriptions activeSubscriptions'
      )
      .lean();

    // Ordenar por fecha de vinculación (más reciente primero)
    usersWithTelegram.sort((a: any, b: any) => {
      const aDate = a.telegramLinkedAt ? new Date(a.telegramLinkedAt).getTime() : 0;
      const bDate = b.telegramLinkedAt ? new Date(b.telegramLinkedAt).getTime() : 0;
      return bDate - aDate;
    });

    const usersWithFullInfo = usersWithTelegram.map((u: any) => {
      const servicesWithActiveSubscription: string[] = [];
      const subscriptionDetails: { service: string; expiryDate?: string; type?: string }[] = [];

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

        const serviceLabel = service === 'TraderCall' ? 'Trader Call' : 'Smart Money';

        if (suscripcionActiva || subscriptionActiva || activeSubscription) {
          servicesWithActiveSubscription.push(serviceLabel);
        }

        // Detalles de suscripción para mostrar
        if (activeSubscription) {
          subscriptionDetails.push({
            service: serviceLabel,
            expiryDate: new Date(activeSubscription.expiryDate).toLocaleDateString('es-AR'),
            type: activeSubscription.subscriptionType || 'full'
          });
        } else if (suscripcionActiva) {
          subscriptionDetails.push({
            service: serviceLabel,
            expiryDate: new Date(suscripcionActiva.fechaVencimiento).toLocaleDateString('es-AR'),
            type: 'legacy'
          });
        } else if (subscriptionActiva && subscriptionActiva.fechaFin) {
          subscriptionDetails.push({
            service: serviceLabel,
            expiryDate: new Date(subscriptionActiva.fechaFin).toLocaleDateString('es-AR'),
            type: 'admin'
          });
        }
      }

      return {
        _id: u._id.toString(),
        email: u.email,
        name: u.name || '-',
        role: u.role,
        picture: u.picture,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        // Telegram
        telegramUserId: u.telegramUserId,
        telegramUsername: u.telegramUsername ? `@${u.telegramUsername.replace(/^@/, '')}` : null,
        telegramLinkedAt: u.telegramLinkedAt ? new Date(u.telegramLinkedAt).toLocaleString('es-AR') : null,
        telegramChannelAccess: (u.telegramChannelAccess || []).map((a: any) => ({
          service: a.service === 'TraderCall' ? 'Trader Call' : a.service === 'SmartMoney' ? 'Smart Money' : a.service,
          joinedAt: a.joinedAt ? new Date(a.joinedAt).toLocaleString('es-AR') : null,
          channelId: a.channelId
        })),
        // Suscripciones
        servicesWithActiveSubscription,
        hasActiveSubscription: servicesWithActiveSubscription.length > 0,
        subscriptionDetails,
        // Datos completos para referencia
        suscripciones: u.suscripciones || [],
        subscriptions: u.subscriptions || [],
        activeSubscriptions: (u.activeSubscriptions || []).map((s: any) => ({
          service: s.service,
          isActive: s.isActive,
          expiryDate: new Date(s.expiryDate).toLocaleDateString('es-AR'),
          subscriptionType: s.subscriptionType
        }))
      };
    });

    return res.status(200).json({
      success: true,
      users: usersWithFullInfo,
      total: usersWithFullInfo.length,
      withActiveSubscription: usersWithFullInfo.filter((u: any) => u.hasActiveSubscription).length
    });
  } catch (error: any) {
    console.error('Error en /api/admin/users-telegram-linked:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios vinculados',
      details: error.message
    });
  }
}
