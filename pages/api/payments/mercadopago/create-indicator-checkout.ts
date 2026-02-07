import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Pricing from '@/models/Pricing';
import { createMercadoPagoPreference } from '@/lib/mercadopago';

/**
 * Crea un checkout de MercadoPago para indicadores (MediasMovilesAutomaticas o RSIConHistoricos)
 * Cobro único, acceso vitalicio administrado manualmente en TradingView.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔧 create-indicator-checkout - Iniciando request:', req.method);
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    console.log('🔧 Conectando a MongoDB...');
    await dbConnect();

    console.log('🔧 Obteniendo sesión...');
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.log('❌ No hay sesión activa');
      return res.status(401).json({ success: false, error: 'Debes iniciar sesión' });
    }
    
    console.log('✅ Sesión encontrada:', session.user.email);

    console.log('🔧 Buscando usuario en BD...');
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado en BD');
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    console.log('✅ Usuario encontrado:', user._id);

    // Obtener producto del body
    const { product } = req.body;
    if (!product || !['MediasMovilesAutomaticas', 'RSIConHistoricos', 'SmartMACD', 'KoncordePro'].includes(product)) {
      return res.status(400).json({ success: false, error: 'Producto inválido' });
    }
    
    // Obtener precio desde Pricing
    console.log('🔧 Obteniendo configuración de precios...');
    const pricing = await Pricing.findOne().sort({ createdAt: -1 });
    if (!pricing) {
      console.log('❌ No hay configuración de precios');
      return res.status(500).json({ success: false, error: 'No hay configuración de precios' });
    }
    
    // Obtener precio según el producto
    let amount = 0;
    let currency = 'ARS';
    let productName = '';
    
    if (product === 'MediasMovilesAutomaticas') {
      amount = pricing.indicadores?.mediasMovilesAutomaticas?.price || 30000;
      currency = pricing.indicadores?.mediasMovilesAutomaticas?.currency || 'ARS';
      productName = 'Medias Móviles Automáticas';
    } else if (product === 'RSIConHistoricos') {
      amount = pricing.indicadores?.rsiConHistoricos?.price || 20000;
      currency = pricing.indicadores?.rsiConHistoricos?.currency || 'ARS';
      productName = 'RSI con Históricos';
    } else if (product === 'SmartMACD') {
      amount = pricing.indicadores?.smartMACD?.price || 20000;
      currency = pricing.indicadores?.smartMACD?.currency || 'ARS';
      productName = 'Smart MACD';
    } else if (product === 'KoncordePro') {
      amount = pricing.indicadores?.koncordePro?.price || 30000;
      currency = pricing.indicadores?.koncordePro?.currency || 'ARS';
      productName = 'Koncorde Pro';
    }
    
    console.log('💰 Precio configurado:', { product, amount, currency });

    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
    const externalReference = `indicator_${product}_${user._id}_${Date.now()}`;

    const successUrl = `${baseUrl}/payment/indicator-success?reference=${externalReference}`;
    const failureUrl = `${baseUrl}/payment/failure?reference=${externalReference}`;
    const pendingUrl = `${baseUrl}/payment/pending?reference=${externalReference}`;

    console.log('🔧 URLs configuradas:', { successUrl, failureUrl, pendingUrl });
    console.log('🔧 External reference:', externalReference);
    console.log('🔧 MercadoPago Access Token configurado:', process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Sí' : 'No');

    console.log('🔧 Creando preferencia de MercadoPago...');
    const pref = await createMercadoPagoPreference(
      `Indicador ${productName}`,
      amount,
      currency,
      externalReference,
      successUrl,
      failureUrl,
      pendingUrl
    );
    
    console.log('📊 Resultado de createMercadoPagoPreference:', pref);

    if (!pref.success) {
      console.log('❌ Error creando preferencia:', pref.error);
      return res.status(500).json({ success: false, error: pref.error || 'Error creando preferencia' });
    }

    console.log('✅ Preferencia creada exitosamente:', pref.preferenceId);
    console.log('🔗 URL de checkout:', pref.initPoint);

    console.log('🔧 Creando registro de pago en BD...');
    const payment = new Payment({
      userId: user._id,
      userEmail: user.email,
      service: product,
      amount,
      currency,
      status: 'pending',
      mercadopagoPaymentId: null,
      externalReference,
      paymentMethodId: '',
      paymentTypeId: '',
      installments: 1,
      transactionDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      metadata: {
        type: 'one-time',
        category: 'indicator',
        preferenceId: pref.preferenceId
      }
    });

    await payment.save();
    console.log('✅ Registro de pago guardado en BD');

    console.log('🎉 Enviando respuesta exitosa al cliente');
    return res.status(200).json({
      success: true,
      checkoutUrl: pref.initPoint,
      externalReference
    });
  } catch (error) {
    console.error('Error en create-indicator-checkout:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}


