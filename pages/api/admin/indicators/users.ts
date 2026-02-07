import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import User from '@/models/User';

/**
 * Obtiene la lista de usuarios que compraron el servicio de indicadores
 * GET: Lista todos los usuarios con sus datos de compra y TradingView
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/admin/indicators/users`);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    // Verificar acceso de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    await dbConnect();

    // ✅ CORREGIDO: No usar .lean() para asegurar que metadata se lea correctamente
    // Buscar todos los pagos del servicio de indicadores que estén aprobados
    const payments = await Payment.find({
      service: { $in: ['MediasMovilesAutomaticas', 'RSIConHistoricos', 'SmartMACD', 'KoncordePro'] },
      status: 'approved'
    }).sort({ transactionDate: -1 });

    console.log(`📊 Encontrados ${payments.length} pagos de indicadores`);

    // Obtener información de usuarios para cada pago
    const usersWithIndicatorData = await Promise.all(
      payments.map(async (payment: any) => {
        const paymentUser = await User.findOne({ email: payment.userEmail }).lean();
        
        // ✅ CORREGIDO: Leer metadata correctamente (sin .lean() el payment es un documento de Mongoose)
        const metadata = payment.metadata || {};
        const notificationSent = metadata.notificationSent === true || metadata.notificationSent === 'true';
        
        // ✅ DEBUG: Log para verificar estado
        if (payment.userEmail === 'lozanonahuel@gmail.com') {
          console.log('🔍 DEBUG - Pago encontrado:', {
            paymentId: payment._id.toString(),
            userEmail: payment.userEmail,
            metadata: metadata,
            notificationSent: notificationSent,
            metadataNotificationSent: metadata.notificationSent,
            metadataType: typeof metadata.notificationSent,
            metadataRaw: JSON.stringify(metadata)
          });
        }
        
        return {
          _id: payment._id.toString(),
          userEmail: payment.userEmail,
          userName: (paymentUser as any)?.name || 'Usuario desconocido',
          amount: payment.amount,
          currency: payment.currency,
          transactionDate: payment.transactionDate,
          tradingViewUser: metadata.tradingViewUser || null,
          formSubmitted: metadata.formSubmitted || false,
          notificationSent: notificationSent, // ✅ CORREGIDO: Usar comparación estricta
          paymentId: payment._id.toString()
        };
      })
    );

    // ✅ DEBUG: Contar usuarios notificados
    const notifiedCount = usersWithIndicatorData.filter(u => u.notificationSent).length;
    console.log(`✅ Datos de usuarios obtenidos: ${usersWithIndicatorData.length} total, ${notifiedCount} notificados`);

    return res.status(200).json({
      success: true,
      users: usersWithIndicatorData,
      count: usersWithIndicatorData.length
    });

  } catch (error) {
    console.error('❌ Error en /api/admin/indicators/users:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
