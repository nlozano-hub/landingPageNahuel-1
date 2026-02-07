import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import { sendEmail } from '@/lib/emailService';
import { z } from 'zod';

// Schema de validación
const tradingViewUserSchema = z.object({
  tradingViewUser: z.string().min(1, 'Usuario de TradingView es requerido'),
  paymentReference: z.string().min(1, 'Referencia de pago es requerida')
});

/**
 * API para enviar datos del usuario de TradingView al admin
 * POST: Envía email al admin con los datos del formulario post-pago
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/indicators/submit-tradingview-user`);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false,
        error: 'Debes iniciar sesión para enviar el formulario' 
      });
    }

    // Validar datos de entrada
    const validatedData = tradingViewUserSchema.parse(req.body);
    const { tradingViewUser, paymentReference } = validatedData;

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar el pago correspondiente (indicadores o pack)
    const payment = await Payment.findOne({ 
      externalReference: paymentReference,
      userEmail: session.user.email,
      service: { $in: ['MediasMovilesAutomaticas', 'RSIConHistoricos', 'SmartMACD', 'KoncordePro', 'PackIndicadores'] }
    });

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        error: 'Pago no encontrado' 
      });
    }

    // Verificar que el pago esté aprobado
    if (payment.status !== 'approved') {
      return res.status(400).json({ 
        success: false,
        error: 'El pago debe estar aprobado para enviar el formulario' 
      });
    }

    // Obtener email del admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error('❌ ADMIN_EMAIL no configurado en variables de entorno');
      return res.status(500).json({ 
        success: false,
        error: 'Configuración de email no disponible' 
      });
    }

    // Crear template HTML para el email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nuevo Usuario de TradingView - Indicador Medias Móviles</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #3b82f6; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Nuevo Usuario de TradingView</h1>
            <p>${payment.service === 'PackIndicadores' ? 'Pack de Indicadores (4 indicadores)' : `Indicador: ${payment.service === 'RSIConHistoricos' ? 'RSI con Históricos' : payment.service === 'SmartMACD' ? 'Smart MACD' : payment.service === 'KoncordePro' ? 'Koncorde Pro' : 'Medias Móviles Automáticas'}`}</p>
          </div>
          
          <div class="content">
            <div class="info-box">
              <div class="label">👤 Usuario de TradingView:</div>
              <div class="value">${tradingViewUser}</div>
            </div>
            
            <div class="info-box">
              <div class="label">📧 Email del Cliente:</div>
              <div class="value">${user.email}</div>
            </div>
            
            <div class="info-box">
              <div class="label">👨‍💼 Nombre del Cliente:</div>
              <div class="value">${user.name || 'No especificado'}</div>
            </div>
            
            <div class="info-box">
              <div class="label">💰 Referencia de Pago:</div>
              <div class="value">${paymentReference}</div>
            </div>
            
            <div class="info-box">
              <div class="label">💳 Monto Pagado:</div>
              <div class="value">$${payment.amount} ${payment.currency}</div>
            </div>
            
            <div class="info-box">
              <div class="label">📅 Fecha de Pago:</div>
              <div class="value">${new Date(payment.transactionDate).toLocaleString('es-AR')}</div>
            </div>
            
            <div class="info-box">
              <div class="label">🆔 ID de Pago:</div>
              <div class="value">${payment._id}</div>
            </div>
            
            <p><strong>📋 Acción requerida:</strong> ${payment.service === 'PackIndicadores' ? 'Habilitar el acceso a TODOS los indicadores del pack (Medias Móviles Automáticas, RSI con Históricos, Smart MACD y Koncorde Pro)' : `Habilitar el acceso al indicador "${payment.service === 'RSIConHistoricos' ? 'RSI con Históricos' : payment.service === 'SmartMACD' ? 'Smart MACD' : payment.service === 'KoncordePro' ? 'Koncorde Pro' : 'Medias Móviles Automáticas'}"`} en TradingView para el usuario: <strong>${tradingViewUser}</strong></p>
          </div>
          
          <div class="footer">
            <p>Este email fue generado automáticamente desde el sistema de pagos.</p>
            <p>Fecha: ${new Date().toLocaleString('es-AR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email al admin
    const indicatorName = payment.service === 'PackIndicadores' ? 'Pack de Indicadores' : payment.service === 'RSIConHistoricos' ? 'RSI con Históricos' : payment.service === 'SmartMACD' ? 'Smart MACD' : payment.service === 'KoncordePro' ? 'Koncorde Pro' : 'Medias Móviles Automáticas';
    await sendEmail({
      to: adminEmail,
      subject: `🎯 Nuevo Usuario TradingView - ${indicatorName} - ${tradingViewUser}`,
      html
    });

    // Actualizar el pago con la información del usuario de TradingView
    payment.metadata = {
      ...payment.metadata,
      tradingViewUser,
      formSubmittedAt: new Date(),
      formSubmitted: true
    };

    await payment.save();

    console.log('✅ Email enviado al admin y pago actualizado:', {
      adminEmail,
      tradingViewUser,
      userEmail: user.email,
      paymentReference
    });

    return res.status(200).json({
      success: true,
      message: 'Formulario enviado exitosamente. Recibirás el acceso en menos de 24 horas.'
    });

  } catch (error) {
    console.error('❌ Error enviando formulario de TradingView:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
