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

    // ✅ CORREGIDO: Obtener precio del servicio usando la estructura correcta del modelo Pricing
    let amount = 0;
    let currency = 'ARS';
    
    if (serviceStr === 'TraderCall') {
      const monthlyPrice = (pricing as any).alertas?.traderCall?.monthly;
      amount = monthlyPrice ? Number(monthlyPrice) : 0;
      currency = (pricing as any).alertas?.traderCall?.currency || 'ARS';
      
      console.log('💰 [TELEGRAM RENEWAL] Obteniendo precio TraderCall:', {
        rawValue: monthlyPrice,
        convertedAmount: amount,
        type: typeof monthlyPrice,
        currency,
        pricingData: JSON.stringify((pricing as any).alertas?.traderCall)
      });
    } else if (serviceStr === 'SmartMoney') {
      const monthlyPrice = (pricing as any).alertas?.smartMoney?.monthly;
      amount = monthlyPrice ? Number(monthlyPrice) : 0;
      currency = (pricing as any).alertas?.smartMoney?.currency || 'ARS';
      
      console.log('💰 [TELEGRAM RENEWAL] Obteniendo precio SmartMoney:', {
        rawValue: monthlyPrice,
        convertedAmount: amount,
        type: typeof monthlyPrice,
        currency,
        pricingData: JSON.stringify((pricing as any).alertas?.smartMoney)
      });
    } else if (serviceStr === 'CashFlow') {
      // Para CashFlow, usar un precio por defecto o agregar al modelo Pricing si es necesario
      amount = 99;
      currency = 'ARS';
    }

    // ✅ VALIDACIÓN: Asegurar que el amount sea un número válido y positivo
    if (!amount || amount <= 0 || isNaN(amount)) {
      console.error('❌ [TELEGRAM RENEWAL] Precio inválido obtenido:', {
        service: serviceStr,
        amount,
        rawPricing: JSON.stringify(pricing, null, 2)
      });
      return res.status(500).json({ 
        error: `No se encontró precio para ${serviceNames[serviceStr]}`,
        details: 'El precio no está configurado en el sistema. Contacta al administrador.'
      });
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
