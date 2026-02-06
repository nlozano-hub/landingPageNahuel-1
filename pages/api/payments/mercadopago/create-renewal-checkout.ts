import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Pricing from '@/models/Pricing';
import { createMercadoPagoPreference } from '@/lib/mercadopago';
import { isUserBlocked } from '@/lib/subscriptionBlockService';

/**
 * API para crear checkout de renovación de suscripción en MercadoPago
 * POST /api/payments/mercadopago/create-renewal-checkout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    await dbConnect();

    const { service } = req.body;

    if (!service || !['TraderCall', 'SmartMoney', 'CashFlow'].includes(service)) {
      return res.status(400).json({ error: 'Servicio inválido' });
    }

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // ✅ Verificar si el usuario está bloqueado para suscripciones
    const blocked = await isUserBlocked(user);
    if (blocked) {
      return res.status(403).json({ 
        success: false,
        error: 'Tu cuenta no puede contratar servicios. Contacta al soporte para más información.' 
      });
    }

    // Verificar si tiene suscripción activa (para confirmación)
    const existingActiveSub = user.activeSubscriptions?.find(
      (sub: any) => sub.service === service && sub.isActive && new Date(sub.expiryDate) > new Date()
    );

    console.log('🔄 Generando checkout de renovación:', {
      email: user.email,
      service,
      hasActiveSub: !!existingActiveSub,
      currentExpiry: existingActiveSub?.expiryDate
    });

    // ✅ CORREGIDO: Obtener precio dinámico del servicio desde el modelo Pricing
    const pricing = await Pricing.findOne().sort({ createdAt: -1 });
    if (!pricing) {
      return res.status(500).json({ 
        success: false,
        error: 'No hay configuración de precios disponible' 
      });
    }

    let amount = 0;
    let currency = 'ARS';
    
    // ✅ CORREGIDO: Obtener precio y convertir explícitamente a número
    if (service === 'TraderCall') {
      const monthlyPrice = (pricing as any).alertas?.traderCall?.monthly;
      amount = monthlyPrice ? Number(monthlyPrice) : 0;
      currency = (pricing as any).alertas?.traderCall?.currency || 'ARS';
      
      console.log('💰 [RENEWAL] Obteniendo precio TraderCall:', {
        rawValue: monthlyPrice,
        convertedAmount: amount,
        type: typeof monthlyPrice,
        currency,
        pricingData: JSON.stringify((pricing as any).alertas?.traderCall)
      });
    } else if (service === 'SmartMoney') {
      const monthlyPrice = (pricing as any).alertas?.smartMoney?.monthly;
      amount = monthlyPrice ? Number(monthlyPrice) : 0;
      currency = (pricing as any).alertas?.smartMoney?.currency || 'ARS';
      
      console.log('💰 [RENEWAL] Obteniendo precio SmartMoney:', {
        rawValue: monthlyPrice,
        convertedAmount: amount,
        type: typeof monthlyPrice,
        currency,
        pricingData: JSON.stringify((pricing as any).alertas?.smartMoney)
      });
    } else if (service === 'CashFlow') {
      // Para CashFlow, usar un precio por defecto o agregar al modelo Pricing si es necesario
      amount = 99;
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Servicio inválido' 
      });
    }

    // ✅ VALIDACIÓN: Asegurar que el amount sea un número válido y positivo
    if (!amount || amount <= 0 || isNaN(amount)) {
      console.error('❌ [RENEWAL] Precio inválido obtenido:', {
        service,
        amount,
        rawPricing: JSON.stringify(pricing, null, 2)
      });
      return res.status(500).json({ 
        success: false,
        error: `No se pudo obtener un precio válido para el servicio ${service}. Por favor, contacta al administrador.` 
      });
    }

    // ✅ VALIDACIÓN: Asegurar que la moneda sea ARS (pesos argentinos)
    if (currency !== 'ARS') {
      console.warn('⚠️ [RENEWAL] Moneda no es ARS, forzando ARS:', currency);
      currency = 'ARS';
    }

    console.log('✅ [RENEWAL] Precio final para renovación:', {
      service,
      amount: Number(amount),
      currency,
      formattedAmount: new Intl.NumberFormat('es-AR', { 
        style: 'currency', 
        currency: 'ARS' 
      }).format(Number(amount))
    });

    // Crear registro de pago pendiente
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días desde ahora (se ajustará en el webhook)
    
    const payment = new Payment({
      userId: user._id,
      userEmail: user.email,
      service,
      amount: Number(amount), // ✅ Asegurar que sea número
      currency,
      status: 'pending',
      externalReference: `renewal_${service}_${user._id}_${Date.now()}`,
      paymentMethodId: '',
      paymentTypeId: '',
      installments: 1,
      transactionDate: new Date(),
      expiryDate,
      metadata: {
        isRenewal: true,
        previousExpiry: existingActiveSub?.expiryDate || null
      }
    });

    await payment.save();

    // Crear preferencia en MercadoPago
    const serviceNames: { [key: string]: string } = {
      'TraderCall': 'Trader Call',
      'SmartMoney': 'Smart Money',
      'CashFlow': 'Cash Flow'
    };

    const baseUrl = process.env.NEXTAUTH_URL || '';
    // ✅ Asegurar que amount sea un número válido antes de enviar a MercadoPago
    const finalAmount = Number(amount);
    
    console.log('🔧 [RENEWAL] Creando preferencia MercadoPago con:', {
      title: `Renovación - ${serviceNames[service]}`,
      amount: finalAmount,
      currency,
      externalReference: payment.externalReference
    });
    
    const result = await createMercadoPagoPreference(
      `Renovación - ${serviceNames[service]}`,
      finalAmount,
      currency,
      payment.externalReference,
      `${baseUrl}/payment/success`,
      `${baseUrl}/payment/failure`,
      `${baseUrl}/payment/pending`
    );

    if (!result.success) {
      throw new Error(result.error || 'Error al crear preferencia');
    }

    console.log('✅ Checkout de renovación creado:', {
      email: user.email,
      service,
      amount,
      checkoutUrl: result.initPoint,
      isRenewal: true
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: result.initPoint,
      sandboxCheckoutUrl: result.sandboxInitPoint,
      preferenceId: result.preferenceId,
      isRenewal: true,
      message: existingActiveSub 
        ? 'Tu tiempo actual se mantendrá y se agregará 1 mes más'
        : 'Se creará una nueva suscripción de 1 mes'
    });

  } catch (error) {
    console.error('❌ Error creando checkout de renovación:', error);
    return res.status(500).json({ 
      error: 'Error al crear checkout',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

