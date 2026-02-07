import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Pricing from '@/models/Pricing';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    
    if (req.method === 'GET') {
      // Obtener precios actuales (público)
      let pricing = await Pricing.findOne().sort({ createdAt: -1 });
      
      if (!pricing) {
        // Crear precios por defecto si no existen
        pricing = await Pricing.create({
          updatedBy: 'sistema',
          alertas: {
            traderCall: {
              monthly: 15000,
              yearly: 150000,
              currency: 'ARS',
              description: 'Alertas de Trader Call'
            },
            smartMoney: {
              monthly: 20000,
              yearly: 200000,
              currency: 'ARS',
              description: 'Alertas de Smart Money'
            }
          },
          entrenamientos: {
            swingTrading: {
              price: 50000,
              currency: 'ARS',
              description: 'Entrenamiento de Zero 2 Trader'
            },
            dayTrading: {
              price: 75000,
              currency: 'ARS',
              description: 'Entrenamiento de Day Trading'
            },
            advanced: {
              price: 100000,
              currency: 'ARS',
              description: 'Entrenamiento Avanzado'
            }
          },
          asesorias: {
            consultorioFinanciero: {
              price: 50000,
              currency: 'ARS',
              description: 'Consultorio Financiero Individual',
              duration: '45 minutos'
            }
          },
          indicadores: {
            mediasMovilesAutomaticas: {
              price: 30000,
              currency: 'ARS',
              description: 'Indicador Medias Móviles Automáticas para TradingView',
              originalPrice: undefined,
              discount: undefined
            },
            rsiConHistoricos: {
              price: 20000,
              currency: 'ARS',
              description: 'Indicador RSI con Históricos para TradingView',
              originalPrice: undefined,
              discount: undefined
            },
            smartMACD: {
              price: 20000,
              currency: 'ARS',
              description: 'Indicador Smart MACD para TradingView',
              originalPrice: undefined,
              discount: undefined
            },
            koncordePro: {
              price: 30000,
              currency: 'ARS',
              description: 'Indicador Koncorde Pro para TradingView',
              originalPrice: undefined,
              discount: undefined
            },
            packIndicadores: {
              price: 70000,
              currency: 'ARS',
              description: 'Pack completo con todos los indicadores para TradingView',
              originalPrice: undefined,
              discount: undefined
            }
          },
          currency: 'ARS',
          showDiscounts: false
        });
      }
      
      // ✅ Cache por 60 segundos en CDN
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({
        success: true,
        data: pricing
      });
    }
    
    if (req.method === 'PUT') {
      // Verificar autenticación para actualizar
      const session = await getServerSession(req, res, authOptions);
      
      if (!session?.user?.email) {
        return res.status(401).json({
          success: false,
          error: 'No autorizado'
        });
      }
      
      // Verificar si es admin usando el sistema de roles
      if (session.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permisos insuficientes'
        });
      }
      
      const updateData = req.body;
      
      // Validar estructura de datos
      if (!updateData.alertas || !updateData.entrenamientos || !updateData.asesorias) {
        return res.status(400).json({
          success: false,
          error: 'Estructura de datos inválida'
        });
      }
      
      // Actualizar o crear precios
      const pricing = await Pricing.findOneAndUpdate(
        {},
        {
          ...updateData,
          lastUpdated: new Date(),
          updatedBy: session.user.email
        },
        { upsert: true, new: true }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Precios actualizados correctamente',
        data: pricing
      });
    }
    
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ 
      success: false, 
      error: `Método ${req.method} no permitido` 
    });
    
  } catch (error) {
    console.error('Error en /api/pricing:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
} 