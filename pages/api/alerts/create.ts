/**
 * API para crear nuevas alertas de trading
 * Solo los administradores pueden crear alertas
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';
import { createAlertNotification } from '@/lib/notificationUtils';
import { validateOriginMiddleware } from '@/lib/securityValidation';

// ✅ NUEVO: Interface para ventas parciales históricas
interface VentaParcialRequest {
  fecha: string;
  precio: number;
  porcentajeVendido: number;
}

interface AlertRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice?: number; // Opcional para alertas de rango
  stopLoss: number;
  takeProfit: number;
  analysis: string;
  date: string;
  tipo?: 'TraderCall' | 'SmartMoney';
  // ✅ NUEVO: Campos para alertas de rango
  tipoAlerta?: 'precio' | 'rango';
  precioMinimo?: number;
  precioMaximo?: number;
  horarioCierre?: string;
  // ✅ NUEVO: Campos para liquidez
  liquidityPercentage?: number;
  liquidityAmount?: number;
  // ✅ NUEVO: Campos para operaciones históricas
  esOperacionHistorica?: boolean;
  fechaEntrada?: string; // Fecha real de entrada (ISO string)
  ventasParciales?: VentaParcialRequest[]; // Ventas parciales previas
  chartImage?: {
    public_id: string;
    url: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    caption?: string;
    order?: number;
  };
  images?: Array<{
    public_id: string;
    url: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    caption?: string;
    order?: number;
  }>;
}

interface AlertResponse {
  success?: boolean;
  alert?: any;
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlertResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // 🔒 SEGURIDAD: Validar origen de la request
  if (!validateOriginMiddleware(req, res)) return;

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Obtener información del usuario y verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // NUEVA RESTRICCIÓN: Solo administradores pueden crear alertas
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Permisos insuficientes. Solo los administradores pueden crear alertas.' 
      });
    }

    // Validar datos de entrada
    const { 
      symbol, 
      action, 
      entryPrice, 
      stopLoss, 
      takeProfit, 
      analysis, 
      date, 
      tipo = 'TraderCall', 
      chartImage, 
      images,
      tipoAlerta = 'precio',
      precioMinimo,
      precioMaximo,
      horarioCierre = '17:30',
      emailMessage,
      emailImageUrl,
      liquidityPercentage = 0,
      liquidityAmount = 0,
      // ✅ NUEVO: Campos para operaciones históricas
      esOperacionHistorica = false,
      fechaEntrada,
      ventasParciales = []
    }: AlertRequest & { emailMessage?: string; emailImageUrl?: string } = req.body;

    // ✅ DEBUG: Log para verificar chartImage recibido
    console.log(`🔍 [ALERTS CREATE] Datos recibidos para crear alerta:`, {
      symbol,
      action,
      hasChartImage: !!chartImage,
      chartImageType: typeof chartImage,
      chartImageValue: chartImage,
      chartImageIsNull: chartImage === null,
      chartImageIsUndefined: chartImage === undefined,
      hasImages: !!(images && images.length > 0),
      imagesCount: images ? images.length : 0,
      emailImageUrl: emailImageUrl
    });

    if (!symbol || !action || !stopLoss || !takeProfit) {
      return res.status(400).json({ error: 'Todos los campos básicos son requeridos' });
    }

    if (!['BUY', 'SELL'].includes(action)) {
      return res.status(400).json({ error: 'Acción debe ser BUY o SELL' });
    }

    if (!['precio', 'rango'].includes(tipoAlerta)) {
      return res.status(400).json({ error: 'Tipo de alerta debe ser precio o rango' });
    }

    // Validaciones específicas según el tipo de alerta
    if (tipoAlerta === 'precio') {
      if (!entryPrice || entryPrice <= 0) {
        return res.status(400).json({ error: 'Precio de entrada es requerido para alertas de precio específico' });
      }
    } else if (tipoAlerta === 'rango') {
      if (!precioMinimo || !precioMaximo || precioMinimo <= 0 || precioMaximo <= 0) {
        return res.status(400).json({ error: 'Precio mínimo y máximo son requeridos para alertas de rango' });
      }
      if (precioMinimo >= precioMaximo) {
        return res.status(400).json({ error: 'El precio mínimo debe ser menor al precio máximo' });
      }
    }

    if (stopLoss <= 0 || takeProfit <= 0) {
      return res.status(400).json({ error: 'Stop Loss y Take Profit deben ser mayores a 0' });
    }

    // ✅ NUEVO: Validar que el porcentaje de liquidez no sea 0
    if (liquidityPercentage <= 0) {
      return res.status(400).json({ error: 'El porcentaje de liquidez debe ser mayor a 0' });
    }

    // ✅ NUEVO: Obtener precio actual del mercado para asignación de liquidez
    let currentMarketPrice = entryPrice; // Valor por defecto
    
    if (liquidityPercentage > 0 && liquidityAmount > 0) {
      try {
        console.log(`🔍 [DEBUG] Obteniendo precio actual del mercado para ${symbol.toUpperCase()}`);
        
        // Intentar obtener precio actual del mercado
        const marketPriceResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/stock-price?symbol=${symbol.toUpperCase()}`);
        if (marketPriceResponse.ok) {
          const marketData = await marketPriceResponse.json();
          if (marketData.price && marketData.price > 0) {
            currentMarketPrice = marketData.price;
            console.log(`✅ [DEBUG] Precio actual del mercado obtenido: $${currentMarketPrice} para ${symbol.toUpperCase()}`);
          } else {
            console.log(`⚠️ [DEBUG] Precio del mercado no válido, usando entryPrice: $${entryPrice}`);
          }
        } else {
          console.log(`⚠️ [DEBUG] Error obteniendo precio del mercado, usando entryPrice: $${entryPrice}`);
        }
      } catch (error) {
        console.log(`⚠️ [DEBUG] Error en fetch de precio del mercado, usando entryPrice: $${entryPrice}`, error);
      }
    }

    // ✅ NUEVO: Procesar ventas parciales históricas si existen
    let participacionRestante = 100;
    let gananciaRealizadaTotal = 0;
    const ventasParcialesProcesadas: any[] = [];
    
    if (esOperacionHistorica && ventasParciales && ventasParciales.length > 0) {
      for (const venta of ventasParciales) {
        // ✅ CORREGIDO: Crear fecha en UTC-3 (Argentina) para evitar desfase de 1 día
        const fechaVenta = (() => {
          if (typeof venta.fecha === 'string' && venta.fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = venta.fecha.split('-').map(Number);
            // Crear fecha en UTC-3 (Argentina) - usar Date.UTC y luego ajustar a UTC-3
            // Argentina está en UTC-3, así que creamos la fecha a las 00:00:00 en UTC-3
            // Esto es equivalente a crear la fecha a las 03:00:00 UTC
            const fechaUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
            return fechaUTC;
          }
          return new Date(venta.fecha);
        })();
        const precioVenta = venta.precio;
        const porcentajeVendido = venta.porcentajeVendido;
        
        // ✅ CORREGIDO: Calcular ganancia porcentual simple (sin ajustar por porcentaje vendido)
        // Ganancia % = (precioVenta - precioEntrada) / precioEntrada * 100
        const precioEntradaCalc = entryPrice || 0;
        let gananciaVenta = 0;
        if (precioEntradaCalc > 0) {
          gananciaVenta = ((precioVenta - precioEntradaCalc) / precioEntradaCalc) * 100;
        }
        
        ventasParcialesProcesadas.push({
          fecha: fechaVenta,
          precio: precioVenta,
          porcentajeVendido,
          gananciaRealizada: gananciaVenta, // ✅ Ahora es solo la ganancia porcentual simple
          sharesVendidos: 0 // Se calculará después con la liquidez
        });
        
        participacionRestante -= porcentajeVendido;
        gananciaRealizadaTotal += gananciaVenta; // ✅ Se sumará para calcular promedio después
      }
      
      // Asegurar que no sea negativo
      participacionRestante = Math.max(0, participacionRestante);
      
      // ✅ CORREGIDO: Calcular promedio de ganancias porcentuales (no suma)
      if (ventasParcialesProcesadas.length > 0) {
        gananciaRealizadaTotal = gananciaRealizadaTotal / ventasParcialesProcesadas.length;
      }
    }

    // Crear la nueva alerta en MongoDB
    const alertData: any = {
      symbol: symbol.toUpperCase(),
      action,
      stopLoss,
      takeProfit,
      status: 'ACTIVE',
      profit: 0, // Inicial en 0%
      date: date ? new Date(date) : new Date(),
      analysis: analysis || '',
      createdBy: user._id,
      tipo, // Recibido desde el frontend
      tipoAlerta,
      horarioCierre,
      chartImage: chartImage || null, // Imagen principal del gráfico
      images: images || [], // Imágenes adicionales
      // ✅ NUEVO: Inicializar porcentajes de participación
      participationPercentage: participacionRestante, // Usar participación restante después de ventas
      originalParticipationPercentage: 100, // Porcentaje original al crear
      // ✅ NUEVO: Guardar porcentaje de liquidez cuando se crea la alerta
      liquidityPercentage: liquidityPercentage || 0,
      // ✅ NUEVO: Campos para operaciones históricas
      esOperacionHistorica: esOperacionHistorica || false,
      fechaEntrada: esOperacionHistorica && fechaEntrada ? (() => {
        // ✅ CORREGIDO: Crear fecha en UTC-3 (Argentina) para evitar desfase de 1 día
        // Parsear YYYY-MM-DD y crear Date en UTC-3 (America/Argentina/Buenos_Aires)
        if (typeof fechaEntrada === 'string' && fechaEntrada.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = fechaEntrada.split('-').map(Number);
          // Crear fecha en UTC-3 (Argentina) - usar Date.UTC y luego ajustar a UTC-3
          // Argentina está en UTC-3, así que creamos la fecha a las 00:00:00 en UTC-3
          // Esto es equivalente a crear la fecha a las 03:00:00 UTC
          const fechaUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
          return fechaUTC;
        }
        return new Date(fechaEntrada);
      })() : undefined,
      ventasParciales: ventasParcialesProcesadas,
      gananciaRealizada: gananciaRealizadaTotal,
      gananciaNoRealizada: 0 // Se calculará después
    };

    // ✅ DEBUG: Log para verificar qué se está guardando
    console.log(`🔍 [ALERTS CREATE] Datos que se guardarán en alertData:`, {
      symbol: alertData.symbol,
      hasChartImage: !!alertData.chartImage,
      chartImageValue: alertData.chartImage,
      chartImageType: typeof alertData.chartImage,
      hasImages: !!(alertData.images && alertData.images.length > 0),
      imagesCount: alertData.images ? alertData.images.length : 0
    });

    // Agregar campos específicos según el tipo de alerta
    if (tipoAlerta === 'precio') {
      alertData.entryPrice = entryPrice;
      alertData.currentPrice = currentMarketPrice; // ✅ CORREGIDO: Usar precio actual del mercado
    } else if (tipoAlerta === 'rango') {
      // ✅ CORREGIDO: Crear entryPriceRange para compatibilidad con el sistema
      alertData.entryPriceRange = {
        min: precioMinimo,
        max: precioMaximo
      };
      alertData.precioMinimo = precioMinimo; // Mantener para compatibilidad
      alertData.precioMaximo = precioMaximo; // Mantener para compatibilidad
      
      // ✅ NUEVO: Guardar entryPrice estático (precio actual al momento de creación)
      // El entryPrice viene del frontend como el precio actual obtenido en ese momento
      if (entryPrice && entryPrice > 0) {
        alertData.entryPrice = entryPrice;
        alertData.currentPrice = entryPrice; // El precio actual es el mismo que el entryPrice al momento de creación
        console.log(`📊 Alerta de ${action} con rango creada para ${symbol}: rango $${precioMinimo}-$${precioMaximo}, entryPrice estático: $${entryPrice}, currentPrice inicial: $${entryPrice} (P&L: 0%)`);
      } else {
        // Fallback: usar precio actual del mercado si está disponible, sino promedio del rango
        if (currentMarketPrice && precioMinimo && precioMaximo && currentMarketPrice > precioMinimo && currentMarketPrice < precioMaximo) {
          alertData.entryPrice = currentMarketPrice;
          alertData.currentPrice = currentMarketPrice;
          console.log(`📊 Alerta de ${action} con rango creada para ${symbol}: rango $${precioMinimo}-$${precioMaximo}, entryPrice estático: $${currentMarketPrice} (precio real del mercado, P&L: 0%)`);
        } else {
          // Usar promedio del rango como último recurso
          const averagePrice = ((precioMinimo || 0) + (precioMaximo || 0)) / 2;
          alertData.entryPrice = averagePrice;
          alertData.currentPrice = averagePrice;
          console.log(`📊 Alerta de ${action} con rango creada para ${symbol}: rango $${precioMinimo}-$${precioMaximo}, entryPrice estático: $${averagePrice} (promedio del rango, P&L: 0%)`);
        }
      }
      
      // ✅ NUEVO: Establecer horario de cierre por defecto a 17:30 para alertas de rango
      alertData.horarioCierre = '17:30';
    }

    const newAlert = await Alert.create(alertData);

    console.log('Nueva alerta creada por usuario:', user.name || user.email, newAlert._id);

    // ✅ DEBUG: Log de parámetros de liquidez recibidos
    console.log('🔍 [DEBUG] Parámetros de liquidez recibidos:', {
      liquidityPercentage,
      liquidityAmount,
      tipo,
      symbol: symbol.toUpperCase()
    });

    // ✅ NUEVO: Crear distribución de liquidez automáticamente si se asignó liquidez
    if (liquidityPercentage > 0 && liquidityAmount > 0) {
      try {
        console.log(`💰 Asignando liquidez automáticamente: ${liquidityPercentage}% ($${liquidityAmount}) para ${symbol}`);
        
        // Determinar el pool según el tipo de alerta
        const pool = tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        
        // ✅ CORREGIDO: Usar la misma lógica que /api/liquidity/summary
        // Disponible = Inicial - Distribuida + Ganancias Realizadas (un solo documento principal)
        const allLiquidityDocs = await Liquidity.find({ pool })
          .select({ initialLiquidity: 1, distributions: 1, updatedAt: 1, createdAt: 1 })
          .lean();
        
        const docsWithDistributions = allLiquidityDocs.filter((doc: any) => 
          doc.distributions && doc.distributions.length > 0
        );
        const mainDoc = docsWithDistributions.length > 0 
          ? docsWithDistributions.sort((a: any, b: any) => 
              new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
            )[0]
          : allLiquidityDocs[0];
        
        let liquidezDisponible = 0;
        if (mainDoc) {
          const liquidezInicialGlobal = mainDoc.initialLiquidity || 0;
          const allDocDistributions = mainDoc.distributions || [];
          
          let montosDistribuidos = 0;
          allDocDistributions.forEach((d: any) => {
            if (d.isActive && d.shares > 0) {
              montosDistribuidos += d.allocatedAmount || 0;
            }
          });
          
          let gananciasRealizadas = 0;
          allDocDistributions.forEach((d: any) => {
            gananciasRealizadas += d.realizedProfitLoss || 0;
          });
          
          liquidezDisponible = liquidezInicialGlobal - montosDistribuidos + gananciasRealizadas;
          console.log(`📊 [CREATE ALERT] Liquidez disponible (misma fórmula que summary): $${liquidezDisponible.toFixed(2)}`);
        }
        
        // ✅ NUEVO: Validar que haya suficiente liquidez disponible
        if (liquidityAmount > liquidezDisponible) {
          return res.status(400).json({ 
            error: `Liquidez insuficiente. Disponible: $${liquidezDisponible.toFixed(2)}. Intenta asignar: $${liquidityAmount.toFixed(2)}` 
          });
        }
        
        // ✅ CORREGIDO: Buscar el documento principal del pool (no por usuario)
        // Esto asegura que siempre usemos el mismo documento consolidado
        console.log(`🔍 [DEBUG] Buscando documento principal de liquidez para pool ${pool}`);
        let liquidity = await Liquidity.findOne({ pool })
          .sort({ updatedAt: -1, createdAt: -1 }); // El más reciente
        
        // Si no existe, buscar el que tiene más distribuciones
        if (!liquidity) {
          const allLiquidityDocs = await Liquidity.find({ pool }).lean();
          if (allLiquidityDocs.length > 0) {
            liquidity = allLiquidityDocs.reduce((prev, curr) => {
              const prevDist = (prev.distributions || []).length;
              const currDist = (curr.distributions || []).length;
              return currDist > prevDist ? curr : prev;
            });
            // Convertir a documento de Mongoose
            liquidity = await Liquidity.findById(liquidity._id);
          }
        }
        
        console.log(`🔍 [DEBUG] Liquidez encontrada:`, liquidity ? 'SÍ' : 'NO');
        
        if (!liquidity) {
          // Si no existe, crear uno con liquidez por defecto
          // ✅ NUEVO: Usar el primer admin como createdBy para consistencia
          const adminUser = await User.findOne({ role: 'admin' });
          liquidity = await Liquidity.create({
            initialLiquidity: liquidityAmount * (100 / liquidityPercentage),
            totalLiquidity: liquidityAmount * (100 / liquidityPercentage),
            availableLiquidity: 0, // Se calculará después
            distributedLiquidity: liquidityAmount,
            distributions: [],
            totalProfitLoss: 0,
            totalProfitLossPercentage: 0,
            createdBy: adminUser?._id || user._id,
            pool
          });
          console.log(`📊 Documento de liquidez creado para pool ${pool}: $${liquidity.totalLiquidity}`);
        }

        // Verificar si ya existe una distribución para esta alerta
        const existingDistribution = liquidity.distributions.find(
          (d: any) => d.alertId.toString() === newAlert._id.toString()
        );

        if (!existingDistribution) {
          // ✅ NUEVO: Para operaciones históricas, usar el precio de entrada histórico
          // Para operaciones normales, usar el precio actual del mercado
          const priceForShares = esOperacionHistorica && entryPrice ? entryPrice : newAlert.currentPrice;

          console.log(`🔍 [DEBUG] Precios para asignación de liquidez:`, {
            symbol: symbol.toUpperCase(),
            entryPrice: entryPrice,
            currentPrice: newAlert.currentPrice,
            currentMarketPrice: currentMarketPrice,
            precioMinimo: precioMinimo,
            priceForShares: priceForShares,
            liquidityAmount: liquidityAmount,
            esOperacionHistorica: esOperacionHistorica
          });

          // ✅ CORREGIDO: Permitir shares fraccionarias
          const sharesTotales = liquidityAmount / priceForShares;
          
          // ✅ NUEVO: Para operaciones históricas con ventas, calcular shares restantes
          const sharesRestantes = esOperacionHistorica 
            ? sharesTotales * (participacionRestante / 100)
            : sharesTotales;
          
          // ✅ NUEVO: Calcular monto asignado actual (después de ventas)
          const allocatedAmountActual = esOperacionHistorica
            ? liquidityAmount * (participacionRestante / 100)
            : liquidityAmount;
          
          // ✅ NUEVO: Calcular ganancia realizada en dólares para ventas históricas
          let realizedProfitLossUSD = 0;
          if (esOperacionHistorica && ventasParcialesProcesadas.length > 0) {
            // Calcular P&L realizado basado en las ventas
            for (const venta of ventasParcialesProcesadas) {
              // ✅ CORREGIDO: Permitir shares fraccionarias
              const sharesVendidos = sharesTotales * (venta.porcentajeVendido / 100);
              const montoVendido = sharesVendidos * venta.precio;
              const montoOriginal = sharesVendidos * priceForShares;
              realizedProfitLossUSD += (montoVendido - montoOriginal);
              
              // Actualizar sharesVendidos en la venta
              venta.sharesVendidos = sharesVendidos;
            }
          }

          // Crear nueva distribución
          const newDistribution = {
            alertId: newAlert._id,
            symbol: symbol.toUpperCase(),
            percentage: liquidityPercentage,
            allocatedAmount: allocatedAmountActual, // Monto actual después de ventas
            entryPrice: priceForShares, // Precio de entrada histórico o actual
            currentPrice: newAlert.currentPrice, // Precio actual del mercado
            shares: sharesRestantes, // Shares restantes después de ventas
            profitLoss: 0, // Se calculará con updatePrices
            profitLossPercentage: 0, // Se calculará con updatePrices
            realizedProfitLoss: realizedProfitLossUSD, // Ganancia realizada de ventas previas
            soldShares: sharesTotales - sharesRestantes, // Shares ya vendidos
            isActive: true,
            createdAt: esOperacionHistorica && fechaEntrada ? new Date(fechaEntrada) : new Date()
          };

          // ✅ NUEVO: Guardar información original en la alerta para ventas futuras
          newAlert.originalParticipationPercentage = 100;
          newAlert.participationPercentage = participacionRestante;
          newAlert.liquidityData = {
            allocatedAmount: allocatedAmountActual,
            shares: sharesRestantes,
            originalAllocatedAmount: liquidityAmount,
            originalShares: sharesTotales,
            originalParticipationPercentage: 100
          };

          // Agregar la distribución
          console.log(`🔍 [DEBUG] Agregando distribución:`, newDistribution);
          liquidity.distributions.push(newDistribution);

          // Actualizar totales
          liquidity.distributedLiquidity = liquidity.distributions
            .filter((d: any) => d.isActive)
            .reduce((sum: number, d: any) => sum + d.allocatedAmount, 0);
          
          liquidity.availableLiquidity = liquidity.totalLiquidity - liquidity.distributedLiquidity;

          console.log(`🔍 [DEBUG] Totales actualizados:`, {
            totalLiquidity: liquidity.totalLiquidity,
            distributedLiquidity: liquidity.distributedLiquidity,
            availableLiquidity: liquidity.availableLiquidity
          });

          // Guardar cambios
          await liquidity.save();
          console.log(`🔍 [DEBUG] Liquidez guardada exitosamente`);

          // ✅ NUEVO: Registrar operación de compra DESPUÉS de asignar la liquidez
          try {
            const OperationModule = await import('@/models/Operation');
            const Operation = OperationModule.default;
            
            // ✅ CORREGIDO: Buscar usuario admin por rol, no por email
            const adminUser = await User.findOne({ role: 'admin' });
            
            if (!adminUser) {
              console.error('⚠️ No se encontró ningún usuario con rol admin');
            } else {
              // ✅ NUEVO: Para operaciones históricas, usar fecha de entrada
              const operationDate = esOperacionHistorica && fechaEntrada 
                ? (() => {
                    // ✅ CORREGIDO: Crear fecha en UTC-3 (Argentina) para evitar desfase de 1 día
                    if (typeof fechaEntrada === 'string' && fechaEntrada.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      const [year, month, day] = fechaEntrada.split('-').map(Number);
                      // Crear fecha en UTC-3 (Argentina) - usar Date.UTC y luego ajustar a UTC-3
                      // Argentina está en UTC-3, así que creamos la fecha a las 00:00:00 en UTC-3
                      // Esto es equivalente a crear la fecha a las 03:00:00 UTC
                      const fechaUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
                      return fechaUTC;
                    }
                    return new Date(fechaEntrada);
                  })()
                : new Date();
              
              // ✅ CORREGIDO: Para operaciones históricas, calcular balance basado en operaciones anteriores a esa fecha
              // Para operaciones normales, usar el balance más reciente
              let currentBalance = 0;
              if (esOperacionHistorica && fechaEntrada) {
                // Buscar el balance más reciente ANTES de la fecha histórica
                const previousBalanceDoc = await Operation.findOne({ 
                  createdBy: adminUser._id, 
                  system: pool,
                  date: { $lt: operationDate }
                })
                  .sort({ date: -1 })
                  .select('balance');
                currentBalance = previousBalanceDoc?.balance || 0;
                console.log(`📅 [HISTORICAL] Balance antes de ${fechaEntrada}: $${currentBalance}`);
              } else {
                // Para operaciones normales, usar el balance más reciente
                const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
                  .sort({ date: -1 })
                  .select('balance');
                currentBalance = currentBalanceDoc?.balance || 0;
              }
              
              const newBalance = currentBalance - liquidityAmount;

              // ✅ NUEVO: Determinar si tiene rango de precio
              const hasRange = tipoAlerta === 'rango' && newAlert.entryPriceRange?.min && newAlert.entryPriceRange?.max;
              const isPriceConfirmed = !hasRange; // Si no hay rango, el precio ya está confirmado

              const operation = new Operation({
                ticker: symbol.toUpperCase(),
                operationType: 'COMPRA',
                quantity: sharesTotales, // Usar shares totales originales
                price: priceForShares,
                amount: liquidityAmount,
                date: operationDate,
                balance: newBalance,
                alertId: newAlert._id,
                alertSymbol: symbol.toUpperCase(),
                system: pool,
                createdBy: adminUser._id,
                portfolioPercentage: liquidityPercentage,
                // ✅ NUEVO: Guardar el rango de precio si existe
                priceRange: hasRange ? {
                  min: newAlert.entryPriceRange.min,
                  max: newAlert.entryPriceRange.max
                } : undefined,
                isPriceConfirmed: isPriceConfirmed,
                liquidityData: {
                  allocatedAmount: liquidityAmount,
                  shares: sharesTotales,
                  entryPrice: priceForShares
                },
                executedBy: user.email,
                executionMethod: esOperacionHistorica ? 'ADMIN' : 'AUTOMATIC',
                status: esOperacionHistorica ? 'COMPLETED' : 'ACTIVE', // ✅ Solo operaciones históricas aparecen como "Completado"
                notes: esOperacionHistorica 
                  ? `Operación histórica importada - ${liquidityPercentage}% de la cartera - Entrada: ${fechaEntrada}`
                  : `Compra automática al crear alerta - ${liquidityPercentage}% de la cartera`,
                // ✅ NUEVO: Copiar la imagen de la alerta a la operación
                image: newAlert.chartImage ? {
                  public_id: newAlert.chartImage.public_id,
                  url: newAlert.chartImage.url,
                  secure_url: newAlert.chartImage.secure_url,
                  width: newAlert.chartImage.width,
                  height: newAlert.chartImage.height,
                  format: newAlert.chartImage.format,
                  bytes: newAlert.chartImage.bytes,
                  caption: newAlert.chartImage.caption,
                  order: newAlert.chartImage.order || 0
                } : undefined
              });

              await operation.save();
              console.log(`✅ Operación de compra registrada: ${symbol} - ${sharesTotales} acciones por $${priceForShares} (${esOperacionHistorica ? 'HISTÓRICA' : 'AUTOMÁTICA'})`);
              console.log(`📋 Operación guardada con system: ${pool}, alertId: ${newAlert._id}, operationId: ${operation._id}`);
              console.log(`🔍 [DEBUG] Operación guardada:`, {
                _id: operation._id,
                ticker: operation.ticker,
                system: operation.system,
                date: operation.date,
                operationType: operation.operationType,
                createdBy: operation.createdBy
              });
              
              // ✅ NUEVO: Para operaciones históricas con ventas, registrar también las operaciones de venta
              if (esOperacionHistorica && ventasParcialesProcesadas.length > 0) {
                // Ordenar ventas por fecha para calcular balance correctamente
                const ventasOrdenadas = [...ventasParcialesProcesadas].sort((a, b) => 
                  new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
                );
                
                // Calcular balance acumulado para cada venta
                let runningBalance = newBalance; // Balance después de la compra
                
                for (const venta of ventasOrdenadas) {
                  // El balance antes de esta venta es el balance acumulado hasta ahora
                  const balanceAntesVenta = runningBalance;
                  // Actualizar balance acumulado sumando el monto de esta venta
                  runningBalance += venta.sharesVendidos * venta.precio;
                  const ventaBalance = runningBalance;
                  
                  const ventaOperation = new Operation({
                    ticker: symbol.toUpperCase(),
                    operationType: 'VENTA',
                    quantity: venta.sharesVendidos,
                    price: venta.precio,
                    amount: venta.sharesVendidos * venta.precio,
                    date: venta.fecha,
                    balance: ventaBalance,
                    alertId: newAlert._id,
                    alertSymbol: symbol.toUpperCase(),
                    system: pool,
                    createdBy: adminUser._id,
                    portfolioPercentage: venta.porcentajeVendido,
                    liquidityData: {
                      allocatedAmount: venta.sharesVendidos * venta.precio,
                      shares: venta.sharesVendidos,
                      entryPrice: venta.precio
                    },
                    executedBy: user.email,
                    executionMethod: 'ADMIN',
                    status: 'COMPLETED', // ✅ Las ventas históricas también aparecen como "Completado"
                    notes: `Venta histórica importada - ${venta.porcentajeVendido}% vendido a $${venta.precio}`
                  });
                  await ventaOperation.save();
                  console.log(`✅ Operación de venta histórica registrada: ${symbol} - ${venta.sharesVendidos} acciones por $${venta.precio}`);
                }
              }
            }
          } catch (operationError) {
            console.error('⚠️ Error registrando operación de compra después de asignar liquidez:', operationError);
            // No fallar la creación de la alerta por un error en la operación
          }

          console.log(`✅ Distribución de liquidez creada automáticamente:`, {
            alertId: newAlert._id.toString(),
            symbol: symbol.toUpperCase(),
            percentage: liquidityPercentage,
            amount: liquidityAmount,
            shares: sharesRestantes,
            pool: pool
          });
        } else {
          console.log(`⚠️ Ya existe una distribución para la alerta ${newAlert._id}`);
        }

      } catch (liquidityError) {
        console.error('❌ Error al crear distribución de liquidez automática:', liquidityError);
        // No fallar la creación de la alerta si la distribución de liquidez falla
        // Solo registrar el error
      }
    }

    // 🔔 Crear notificación automática (email a suscriptores)
    // ✅ NUEVO: No enviar notificación para operaciones históricas
    if (!esOperacionHistorica) {
      try {
        // Preparar parámetros para la notificación según el tipo de alerta
        const notificationParams: any = {
          message: emailMessage,
          imageUrl: emailImageUrl || newAlert?.chartImage?.secure_url || newAlert?.chartImage?.url || undefined
        };

        // Si es alerta de rango, pasar priceRange; si no, pasar price
        if (tipoAlerta === 'rango' && newAlert.entryPriceRange) {
          notificationParams.priceRange = {
            min: newAlert.entryPriceRange.min,
            max: newAlert.entryPriceRange.max
          };
        } else if (tipoAlerta === 'precio') {
          notificationParams.price = typeof newAlert.entryPrice === 'number' 
            ? newAlert.entryPrice 
            : (typeof newAlert.currentPrice === 'number' ? newAlert.currentPrice : undefined);
        }

        // ✅ NUEVO: Pasar el porcentaje de liquidez siempre para alertas de compra
        if (newAlert.action === 'BUY') {
          notificationParams.liquidityPercentage = liquidityPercentage;
        }

        await createAlertNotification(newAlert, notificationParams);
        console.log('✅ Notificación automática enviada para alerta:', newAlert._id);
      } catch (notificationError) {
        console.error('❌ Error al enviar notificación automática:', notificationError);
        // No fallar la creación de la alerta si la notificación falla
      }
    } else {
      console.log('📝 Operación histórica creada - No se envía notificación a suscriptores');
    }

    // Formatear la respuesta para el frontend - con validación de números
    const alertResponse = {
      id: newAlert._id.toString(),
      symbol: newAlert.symbol,
      action: newAlert.action,
      entryPrice: newAlert.entryPrice ? `$${Number(newAlert.entryPrice).toFixed(2)}` : null,
      currentPrice: `$${Number(newAlert.currentPrice || 0).toFixed(2)}`,
      stopLoss: `$${Number(newAlert.stopLoss || 0).toFixed(2)}`,
      takeProfit: `$${Number(newAlert.takeProfit || 0).toFixed(2)}`,
      profit: `${Number(newAlert.profit || 0) >= 0 ? '+' : ''}${Number(newAlert.profit || 0).toFixed(1)}%`,
      status: newAlert.status,
      date: newAlert.date ? newAlert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      analysis: newAlert.analysis || '',
      // ✅ NUEVO: Campos para alertas de rango
      tipoAlerta: newAlert.tipoAlerta,
      precioMinimo: newAlert.precioMinimo ? `$${Number(newAlert.precioMinimo).toFixed(2)}` : null,
      precioMaximo: newAlert.precioMaximo ? `$${Number(newAlert.precioMaximo).toFixed(2)}` : null,
      horarioCierre: newAlert.horarioCierre
    };

    // TODO: Enviar notificación a todos los suscriptores (opcional)

    return res.status(201).json({
      success: true,
      message: 'Alerta creada exitosamente',
      alert: alertResponse
    });

  } catch (error) {
    console.error('Error al crear alerta:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudo crear la alerta'
    });
  }
}

/**
 * ✅ NUEVO: Obtener precio actual de una acción usando la API correcta (Yahoo Finance)
 */
async function fetchCorrectStockPrice(symbol: string): Promise<number | null> {
  try {
    // Usar la misma API que funciona correctamente en /api/stock-price
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Error al obtener datos de Yahoo Finance');
    }

    const data = await response.json();

    if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      console.log(`✅ Yahoo Finance - ${symbol}: $${price}`);
      return price;
    } else {
      // Si Yahoo Finance falla, usar precio simulado
      console.log(`⚠️ Yahoo Finance no disponible para ${symbol}, usando precio simulado`);
      return generateSimulatedPrice(symbol);
    }

  } catch (error: any) {
    console.error(`❌ Error obteniendo precio desde Yahoo Finance para ${symbol}:`, error.message);
    // Fallback a precio simulado si Yahoo Finance falla
    console.log(`🔄 Usando precio simulado para ${symbol}`);
    return generateSimulatedPrice(symbol);
  }
}

/**
 * ✅ NUEVO: Obtener precio actual de una acción desde Google Finance (DEPRECATED - usar fetchCorrectStockPrice)
 */
async function fetchCurrentStockPrice(symbol: string): Promise<number | null> {
  try {
    // Usar Google Finance API
    const googleFinanceUrl = `https://www.google.com/finance/quote/${symbol}`;
    
    // Intentar obtener precio desde Google Finance
    const response = await fetch(googleFinanceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extraer precio del HTML de Google Finance
      const priceMatch = html.match(/"price":\s*"([^"]+)"/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        return isNaN(price) ? null : price;
      }
      
      // Fallback - buscar en diferentes formatos de Google Finance
      const alternativePriceMatch = html.match(/(\d+\.?\d*)\s*USD/);
      if (alternativePriceMatch) {
        const price = parseFloat(alternativePriceMatch[1]);
        return isNaN(price) ? null : price;
      }
    }
    
    // Si Google Finance falla, usar precio simulado como fallback
    console.log(`🔄 Google Finance no disponible para ${symbol}, usando precio simulado`);
    return generateSimulatedPrice(symbol);

  } catch (error: any) {
    console.error(`❌ Error obteniendo precio desde Google Finance para ${symbol}:`, error.message);
    
    // Fallback a precio simulado si Google Finance falla
    console.log(`🔄 Usando precio simulado para ${symbol}`);
    return generateSimulatedPrice(symbol);
  }
}

/**
 * ✅ NUEVO: Generar precio simulado para testing/fallback
 */
function generateSimulatedPrice(symbol: string): number {
  // Generar precio realista basado en el símbolo
  const basePrice = symbol.charCodeAt(0) * 10 + symbol.charCodeAt(1);
  const variation = (Math.random() - 0.5) * 0.1; // ±5% variación
  return Math.round((basePrice * (1 + variation)) * 100) / 100;
} 