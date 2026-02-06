import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Pricing from '@/models/Pricing';
import { createMercadoPagoPreference } from '@/lib/mercadopago';

/**
 * API para crear checkout de renovación de suscripción desde Telegram
 * GET /api/payments/mercadopago/create-renewal-checkout-telegram?service=TraderCall&telegramUserId=123456
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { service, telegramUserId } = req.query;

    if (!service || !telegramUserId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const serviceStr = Array.isArray(service) ? service[0] : service;
    const telegramUserIdNum = Array.isArray(telegramUserId) ? Number(telegramUserId[0]) : Number(telegramUserId);

    if (!['TraderCall', 'SmartMoney', 'CashFlow'].includes(serviceStr)) {
      return res.status(400).json({ error: 'Servicio inválido' });
    }

    await dbConnect();

    // Buscar usuario por telegramUserId
    const user = await User.findOne({ telegramUserId: telegramUserIdNum });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si tiene suscripción activa (para confirmación)
    const existingActiveSub = user.activeSubscriptions?.find(
      (sub: any) => sub.service === serviceStr && sub.isActive && new Date(sub.expiryDate) > new Date()
    );

    console.log('🔄 [TELEGRAM RENEWAL] Generando checkout de renovación:', {
      email: user.email,
      service: serviceStr,
      telegramUserId: telegramUserIdNum,
      hasActiveSub: !!existingActiveSub,
      currentExpiry: existingActiveSub?.expiryDate
    });

    // Obtener precio dinámico del servicio desde el modelo Pricing
    const pricing = await Pricing.findOne().sort({ createdAt: -1 });
    if (!pricing) {
      return res.status(500).json({ error: 'No se encontró configuración de precios' });
    }

    const serviceNames: Record<string, string> = {
      'TraderCall': 'Trader Call',
      'SmartMoney': 'Smart Money',
      'CashFlow': 'Cash Flow'
    };

    // Obtener precio del servicio
    const priceKey = `${serviceStr.toLowerCase()}Price` as keyof typeof pricing;
    const amount = (pricing as any)[priceKey] || 0;
    const currency = pricing.currency || 'ARS';

    if (!amount || amount <= 0) {
      return res.status(500).json({ error: `No se encontró precio para ${serviceNames[serviceStr]}` });
    }

    // Crear registro de pago pendiente
    const payment = new Payment({
      userEmail: user.email,
      userId: user._id,
      service: serviceStr,
      amount,
      currency,
      status: 'pending',
      transactionDate: new Date(),
      expiryDate: new Date(), // Se actualizará cuando se apruebe el pago
      source: 'telegram-renewal',
      metadata: {
        isRenewal: true,
        telegramUserId: telegramUserIdNum,
        existingExpiry: existingActiveSub?.expiryDate
      }
    });

    await payment.save();

    const baseUrl = process.env.NEXTAUTH_URL || '';
    const finalAmount = Number(amount);
    
    console.log('🔧 [TELEGRAM RENEWAL] Creando preferencia MercadoPago con:', {
      title: `Renovación - ${serviceNames[serviceStr]}`,
      amount: finalAmount,
      currency,
      externalReference: payment.externalReference
    });
    
    const result = await createMercadoPagoPreference(
      `Renovación - ${serviceNames[serviceStr]}`,
      finalAmount,
      currency,
      payment.externalReference,
      `${baseUrl}/payment/success`,
      `${baseUrl}/payment/failure`,
      `${baseUrl}/payment/pending`
    );

    if (!result.success || !result.initPoint) {
      throw new Error(result.error || 'Error al crear preferencia');
    }

    console.log('✅ [TELEGRAM RENEWAL] Checkout de renovación creado:', {
      email: user.email,
      service: serviceStr,
      amount,
      checkoutUrl: result.initPoint,
      isRenewal: true
    });

    // Redirigir directamente al checkout
    return res.redirect(result.initPoint);

  } catch (error) {
    console.error('❌ [TELEGRAM RENEWAL] Error creando checkout de renovación:', error);
    return res.status(500).json({ 
      error: 'Error al crear checkout',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
