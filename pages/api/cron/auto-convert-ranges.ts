import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import User from '@/models/User';

interface AutoConvertCronResponse {
  success: boolean;
  message: string;
  processed?: number;
}

/**
 * Interfaz para acumular acciones del cron y enviar email de resumen
 */
interface AccionResumen {
  symbol: string;
  tipo: 'COMPRA_CONFIRMADA' | 'VENTA_EJECUTADA' | 'COMPRA_DESCARTADA' | 'VENTA_DESCARTADA';
  precio: number;
  alertaTipo: 'SmartMoney' | 'TraderCall';
  alertId: string;
  detalles: {
    rangoOriginal?: { min: number; max: number };
    porcentajeVendido?: number;
    profitPorcentaje?: number;
    motivo?: string;
    posicionCerrada?: boolean;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertCronResponse>) {
  // Permitir GET para cronjobs externos (cron-job.org)
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'ERROR - Método no permitido. Use GET.'
    });
  }

  // Detectar cron jobs externos por User-Agent
  const userAgent = req.headers['user-agent'] || '';
  const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
  
  if (isCronJobOrg) {
    console.log('🌐 CRON PÚBLICO DETECTADO (auto-convert-ranges):', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.url
    });
  }

  try {
    await dbConnect();
    console.log('🔄 CRON: Iniciando conversión automática de alertas de rango...');

    // Buscar alertas activas con rangos de precio (entrada o venta)
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { precioMinimo: { $exists: true, $ne: null }, precioMaximo: { $exists: true, $ne: null } },
        { sellRangeMin: { $exists: true, $ne: null }, sellRangeMax: { $exists: true, $ne: null } }
      ]
    });

    console.log(`📊 CRON: Encontradas ${alertsWithRange.length} alertas con rangos para convertir`);
    
    if (alertsWithRange.length > 0) {
      console.log(`🔍 CRON: Alertas encontradas:`, alertsWithRange.map(alert => ({
        symbol: alert.symbol,
        tipo: alert.tipo,
        entryPriceRange: alert.entryPriceRange,
        precioMinimo: alert.precioMinimo,
        precioMaximo: alert.precioMaximo,
        sellRangeMin: alert.sellRangeMin,
        sellRangeMax: alert.sellRangeMax,
        status: alert.status,
        participationPercentage: alert.participationPercentage
      })));
    }

    if (alertsWithRange.length === 0) {
      console.log(`⚠️ CRON: No hay alertas de rango para convertir`);
      
      // ✅ NUEVO: Si no hay alertas, enviar notificación de "sin operaciones"
      try {
        console.log(`📧 CRON: No hay alertas - Enviando notificación de "sin operaciones"...`);
        await enviarNotificacionSinOperaciones();
        console.log(`✅ CRON: Notificación de "sin operaciones" enviada correctamente`);
      } catch (err) {
        console.error('❌ CRON: Error enviando notificación de "sin operaciones":', err);
        // No fallar el cron si falla el envío de emails
      }
      
      return res.status(200).json({
        success: true,
        message: 'OK - No hay alertas para convertir',
        processed: 0
      });
    }

    // ✅ Buscar admin por ROL en lugar de por email
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.warn('⚠️ CRON: No se encontró ningún usuario admin por rol');
    } else {
      console.log(`✅ CRON: Usuario admin encontrado: ${adminUser.email}`);
    }

    const conversionDetails = [];
    
    // ✅ NUEVO: Acumulador de acciones para email de resumen consolidado
    const resumenAcciones: AccionResumen[] = [];

    for (const alert of alertsWithRange) {
      try {
        console.log(`📊 Procesando ${alert.symbol}:`, {
          entryPriceRange: alert.entryPriceRange,
          entryPrice: alert.entryPrice,
          currentPrice: alert.currentPrice,
          sellRangeMin: alert.sellRangeMin,
          sellRangeMax: alert.sellRangeMax,
          participationPercentage: alert.participationPercentage
        });

        // ✅ CRÍTICO: Usar el precio de cierre de la alerta (precio del momento de ejecución del cronjob)
        // Este precio se usará para registrar las operaciones de venta
        const closePrice = alert.currentPrice;
        
        if (!closePrice || closePrice <= 0) {
          console.warn(`⚠️ ${alert.symbol}: Precio de cierre inválido (${closePrice}), saltando...`);
          continue;
        }
        
        console.log(`💰 ${alert.symbol}: Precio de cierre para operaciones: $${closePrice}`);

        // Determinar qué rangos convertir
        const hasEntryRange = alert.entryPriceRange?.min && alert.entryPriceRange?.max;
        const hasSellRange = alert.sellRangeMin && alert.sellRangeMax;
        
        let oldEntryRange = 'N/A';
        let oldSellRange = 'N/A';
        
        if (hasEntryRange) {
            oldEntryRange = `$${alert.entryPriceRange.min}-$${alert.entryPriceRange.max}`;
        }
        
        if (hasSellRange) {
          oldSellRange = `$${alert.sellRangeMin}-$${alert.sellRangeMax}`;
        }

        // Preparar campos para actualizar
        const updateFields: any = {};
        const unsetFields: any = {};
        
        // Convertir rango de entrada si existe
        if (hasEntryRange) {
          const entryRangeMin = alert.entryPriceRange.min;
          const entryRangeMax = alert.entryPriceRange.max;
          
          // Verificar si el precio está dentro del rango de entrada
          if (closePrice < entryRangeMin || closePrice > entryRangeMax) {
            const motivo = closePrice < entryRangeMin 
              ? `Precio $${closePrice} < mínimo $${entryRangeMin}`
              : `Precio $${closePrice} > máximo $${entryRangeMax}`;
            
            console.log(`❌ ${alert.symbol}: ${motivo} - DESCARTANDO COMPRA`);
            
            // ✅ DEVOLVER LIQUIDEZ si fue asignada
            if (adminUser) {
              try {
                const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
                const LiquidityModule = await import('@/models/Liquidity');
                const Liquidity = LiquidityModule.default;
                
                const liquidity = await Liquidity.findOne({ 
                  createdBy: adminUser._id, 
                  pool: pool 
                });
                
                if (liquidity) {
                  const distribution = liquidity.distributions.find((d: any) => 
                    d.alertId && d.alertId.toString() === alert._id.toString()
                  );
                  
                  if (distribution && distribution.allocatedAmount > 0) {
                    console.log(`💰 ${alert.symbol}: Devolviendo liquidez asignada: $${distribution.allocatedAmount.toFixed(2)}`);
                    liquidity.removeDistribution(alert._id.toString());
                    await liquidity.save();
                    console.log(`✅ ${alert.symbol}: Liquidez devuelta al pool`);
                  }
                }
              } catch (liquidityError) {
                console.error(`⚠️ Error devolviendo liquidez para ${alert.symbol}:`, liquidityError);
              }
            }
            
          await Alert.updateOne(
            { _id: alert._id },
            { 
              $set: { 
                status: 'DESCARTADA',
                descartadaAt: new Date(),
                  descartadaMotivo: motivo,
                descartadaPrecio: closePrice
              }
            }
          );

          conversionDetails.push({
            symbol: alert.symbol,
            type: 'discarded',
            oldRange: oldEntryRange,
            newPrice: closePrice,
              reason: motivo
            });
          
            // ✅ MODIFICADO: Acumular en resumen en lugar de enviar notificación individual
            resumenAcciones.push({
              symbol: alert.symbol,
              tipo: 'COMPRA_DESCARTADA',
              precio: closePrice,
              alertaTipo: alert.tipo as 'SmartMoney' | 'TraderCall',
              alertId: alert._id.toString(),
              detalles: {
                rangoOriginal: { min: entryRangeMin, max: entryRangeMax },
                motivo: motivo
              }
            });
            
            continue;
          }
          
          console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango ${oldEntryRange} - Convirtiendo`);
          
          updateFields.entryPrice = closePrice;
          updateFields.tipoAlerta = 'precio';
          updateFields.finalPrice = closePrice;
          updateFields.finalPriceSetAt = new Date();
          unsetFields.entryPriceRange = 1;
          unsetFields.precioMinimo = 1;
          unsetFields.precioMaximo = 1;
          
          // ✅ MODIFICADO: Acumular en resumen en lugar de enviar notificación individual
          resumenAcciones.push({
            symbol: alert.symbol,
            tipo: 'COMPRA_CONFIRMADA',
            precio: closePrice,
            alertaTipo: alert.tipo as 'SmartMoney' | 'TraderCall',
            alertId: alert._id.toString(),
            detalles: {
              rangoOriginal: { min: entryRangeMin, max: entryRangeMax }
            }
          });
          
          // ✅ NUEVO: Actualizar el precio de la operación de COMPRA existente con el precio final confirmado
          await updateOperationPriceOnConfirmation(alert._id, closePrice);
        }
        
        // Procesar rango de venta si existe
        if (hasSellRange) {
          const sellRangeMin = alert.sellRangeMin;
          const sellRangeMax = alert.sellRangeMax;
          
          // ✅ Verificar si el precio está DENTRO del rango de venta
          const precioEnRango = closePrice >= sellRangeMin && closePrice <= sellRangeMax;
          
          if (precioEnRango) {
            console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango $${sellRangeMin}-$${sellRangeMax} → EJECUTANDO VENTA`);
            
            // Buscar venta programada pendiente
          const liquidityData = alert.liquidityData || {};
          const partialSales = liquidityData.partialSales || [];
            
            console.log(`🔍 ${alert.symbol}: Buscando ventas programadas (total: ${partialSales.length})`);
            
            // Buscar cualquier venta pendiente (no ejecutada)
            const pendingSale = partialSales.find((sale: any) => !sale.executed);
          
          if (pendingSale) {
              console.log(`✅ ${alert.symbol}: Ejecutando venta programada: ${pendingSale.percentage}%`);
              
              // Ejecutar la venta programada
              const saleResult = await executeScheduledSale(alert, pendingSale, closePrice, adminUser);
              
              if (saleResult.shouldClose) {
                updateFields.status = 'CLOSED';
                updateFields.exitPrice = closePrice;
                updateFields.exitDate = new Date();
                updateFields.exitReason = 'AUTOMATIC';
                updateFields.participationPercentage = 0;
                updateFields.profit = saleResult.profitPercentage;
                console.log(`🔒 ${alert.symbol}: Posición CERRADA - Profit: ${saleResult.profitPercentage.toFixed(2)}%`);
              } else {
                if (alert.participationPercentage !== saleResult.newParticipationPercentage) {
                  updateFields.participationPercentage = saleResult.newParticipationPercentage;
                  }
                console.log(`📊 ${alert.symbol}: Venta parcial - Participación restante: ${saleResult.newParticipationPercentage}%`);
              }
              
              updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // ✅ MODIFICADO: Acumular en resumen en lugar de enviar notificación individual
              resumenAcciones.push({
                symbol: alert.symbol,
                tipo: 'VENTA_EJECUTADA',
                precio: closePrice,
                alertaTipo: alert.tipo as 'SmartMoney' | 'TraderCall',
                alertId: alert._id.toString(),
                detalles: {
                  porcentajeVendido: pendingSale.percentage,
                  profitPorcentaje: saleResult.profitPercentage,
                  posicionCerrada: saleResult.shouldClose
                }
              });
              
          } else {
              // ✅ Si NO hay venta programada pero el precio está en rango, 
              // ejecutar venta del porcentaje restante (participationPercentage actual)
              const remainingPercentage = alert.participationPercentage || 100;
              console.log(`✅ ${alert.symbol}: Precio en rango sin venta programada - Ejecutando venta del ${remainingPercentage}% restante`);
              
              // Crear venta sintética para ejecutar
              const syntheticSale = {
                percentage: remainingPercentage,
                isCompleteSale: true, // Siempre es venta completa de lo que queda
                scheduledAt: new Date(),
                priceRange: { min: sellRangeMin, max: sellRangeMax }
              };
              
              // Ejecutar la venta
              const saleResult = await executeScheduledSale(alert, syntheticSale, closePrice, adminUser);
              
              if (saleResult.shouldClose) {
                    updateFields.status = 'CLOSED';
                    updateFields.exitPrice = closePrice;
                    updateFields.exitDate = new Date();
                    updateFields.exitReason = 'AUTOMATIC';
                    updateFields.participationPercentage = 0;
                updateFields.profit = saleResult.profitPercentage;
                console.log(`🔒 ${alert.symbol}: Posición CERRADA - Profit: ${saleResult.profitPercentage.toFixed(2)}%`);
              }
              
                    updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // ✅ MODIFICADO: Acumular en resumen en lugar de enviar notificación individual
              resumenAcciones.push({
                symbol: alert.symbol,
                tipo: 'VENTA_EJECUTADA',
                precio: closePrice,
                alertaTipo: alert.tipo as 'SmartMoney' | 'TraderCall',
                alertId: alert._id.toString(),
                detalles: {
                  porcentajeVendido: remainingPercentage,
                  profitPorcentaje: saleResult.profitPercentage,
                  posicionCerrada: saleResult.shouldClose
                }
              });
                  }
                } else {
            // ❌ Precio FUERA del rango → DESCARTAR la venta programada (no ejecutar)
            const motivo = closePrice < sellRangeMin 
              ? `Precio $${closePrice} < mínimo $${sellRangeMin}`
              : `Precio $${closePrice} > máximo $${sellRangeMax}`;
            
            console.log(`❌ ${alert.symbol}: ${motivo} → DESCARTANDO venta programada`);
            
            // Limpiar la venta programada (marcar como descartada)
            const liquidityData = alert.liquidityData || {};
            const partialSales = liquidityData.partialSales || [];
                    
            // Marcar todas las ventas pendientes como descartadas
            const updatedPartialSales = partialSales.map((sale: any) => {
              if (!sale.executed) {
                return {
                  ...sale,
                  executed: false,
                  discarded: true,
                  discardedAt: new Date(),
                  discardReason: motivo
                };
              }
              return sale;
            });
            
            // Actualizar la alerta: limpiar rangos pero mantener la posición activa
            await Alert.updateOne(
              { _id: alert._id },
              { 
                $set: { 
                  'liquidityData.partialSales': updatedPartialSales 
                },
                $unset: { 
                  sellRangeMin: 1, 
                  sellRangeMax: 1 
                }
              }
            );
            
            console.log(`🗑️ ${alert.symbol}: Venta descartada - Posición sigue ACTIVA sin venta programada`);
            
            // ✅ MODIFICADO: Acumular en resumen en lugar de enviar notificación individual
            resumenAcciones.push({
              symbol: alert.symbol,
              tipo: 'VENTA_DESCARTADA',
              precio: closePrice,
              alertaTipo: alert.tipo as 'SmartMoney' | 'TraderCall',
              alertId: alert._id.toString(),
              detalles: {
                rangoOriginal: { min: sellRangeMin, max: sellRangeMax },
                motivo: motivo
              }
            });
            
            conversionDetails.push({
              symbol: alert.symbol,
              type: 'discarded_sale',
              oldRange: oldSellRange,
              newPrice: closePrice,
              reason: motivo
            });
          }
        }

        // Actualizar la alerta
        if (Object.keys(updateFields).length > 0 || Object.keys(unsetFields).length > 0) {
        await Alert.updateOne(
          { _id: alert._id },
          { 
            $set: updateFields,
              ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {})
          }
        );
        }

        // Agregar detalles de conversión
        if (hasEntryRange) {
          conversionDetails.push({
            symbol: alert.symbol,
            type: 'entry',
            oldRange: oldEntryRange,
            newPrice: closePrice
          });
          console.log(`✅ CRON: ${alert.symbol}: Rango de entrada ${oldEntryRange} convertido a precio fijo $${closePrice}`);
        }
        
        if (hasSellRange && closePrice >= alert.sellRangeMin && closePrice <= alert.sellRangeMax) {
          conversionDetails.push({
            symbol: alert.symbol,
            type: 'sell',
            oldRange: oldSellRange,
            newPrice: closePrice
          });
          console.log(`✅ CRON: ${alert.symbol}: Venta ejecutada a $${closePrice}`);
        }

      } catch (alertError) {
        console.error(`❌ CRON: Error procesando alerta ${alert.symbol}:`, alertError);
      }
    }

    console.log(`🎉 CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`);
    console.log(`📧 CRON: ${resumenAcciones.length} acciones para notificar en resumen consolidado`);

    // ✅ CORREGIDO: Si hay alertas procesadas (aunque sean solo descartadas), enviar resumen normal
    // Solo enviar "sin operaciones" cuando realmente no hay alertas procesadas
    if (resumenAcciones.length > 0) {
      // Hay alertas procesadas → enviar resumen (incluye compras/ventas descartadas)
      try {
        console.log(`📧 CRON: Enviando resumen de operaciones (incluye descartadas)...`);
        await enviarResumenOperaciones(resumenAcciones);
        console.log(`✅ CRON: Resumen de operaciones enviado correctamente`);
      } catch (err) {
        console.error('❌ CRON: Error enviando resumen de operaciones:', err);
        // No fallar el cron si falla el envío de emails
      }
    } else {
      // No hay alertas procesadas → enviar mensaje de "sin operaciones"
      try {
        console.log(`📧 CRON: No hay alertas procesadas - Enviando notificación de "sin operaciones"...`);
        await enviarNotificacionSinOperaciones();
        console.log(`✅ CRON: Notificación de "sin operaciones" enviada correctamente`);
      } catch (err) {
        console.error('❌ CRON: Error enviando notificación de "sin operaciones":', err);
        // No fallar el cron si falla el envío de emails
      }
    }

    if (isCronJobOrg) {
      return res.status(200).json({
        success: true,
        message: 'OK',
        processed: conversionDetails.length
      });
    }

    return res.status(200).json({
      success: true,
      message: `OK - ${conversionDetails.length} alertas convertidas`,
      processed: conversionDetails.length
    });

  } catch (error) {
    console.error('❌ CRON: Error en conversión automática:', error);
    return res.status(200).json({ 
      success: true,
      message: 'OK',
      processed: 0
    });
  }
}

/**
 * Ejecuta una venta programada
 */
async function executeScheduledSale(
  alert: any, 
  sale: any, 
  closePrice: number, 
  adminUser: any
): Promise<{ shouldClose: boolean; profitPercentage: number; newParticipationPercentage: number }> {
  try {
    const percentage = sale.percentage || 0;
    const isCompleteSale = sale.isCompleteSale || percentage >= 100;
    const alertEntryPrice = alert.entryPrice || alert.entryPriceRange?.min || closePrice;
    
    // Calcular profit
    const profitPercentage = alertEntryPrice > 0 
      ? ((closePrice - alertEntryPrice) / alertEntryPrice) * 100 
      : 0;
    
    // ✅ CORREGIDO: Usar originalParticipationPercentage si existe, sino participationPercentage actual
    // Si no hay ninguno, asumir 100%
    const baseParticipation = alert.originalParticipationPercentage ?? alert.participationPercentage ?? 100;
    const currentParticipation = alert.participationPercentage ?? baseParticipation;
    
    // Calcular nueva participación: restar el porcentaje vendido
    const newParticipationPercentage = isCompleteSale ? 0 : Math.max(0, currentParticipation - percentage);
    
    console.log(`📊 ${alert.symbol}: Cálculo de participación - Base: ${baseParticipation}%, Actual: ${currentParticipation}%, Vendido: ${percentage}%, Nueva: ${newParticipationPercentage}%`);
    
    // ✅ CORREGIDO: Calcular realizedProfit basado en el P&L real de la venta
    // realizedProfit = (precioVenta - precioEntrada) * accionesVendidas
    const saleEntryPrice = alert.entryPrice || alert.entryPriceRange?.min || closePrice;
    const sharesToSell = sale.sharesToSell || 0;
    const costBasis = sharesToSell * saleEntryPrice; // Costo original de las acciones vendidas
    const proceeds = sharesToSell * closePrice; // Efectivo recibido
    const realizedProfit = proceeds - costBasis; // P&L real en dólares
    
    // Marcar la venta como ejecutada
    sale.executed = true;
    sale.executedAt = new Date();
    sale.sellPrice = closePrice;
    sale.realizedProfit = realizedProfit; // ✅ CORREGIDO: Guardar el P&L real calculado
    
    // Actualizar liquidityData
    const liquidityData = alert.liquidityData || {};
    const partialSales = liquidityData.partialSales || [];
    
    // Actualizar el partialSale correspondiente
    const saleIndex = partialSales.findIndex((s: any) => !s.executed || s === sale);
    if (saleIndex >= 0) {
      partialSales[saleIndex] = sale;
    }
    
    // ✅ NUEVO: Recargar la alerta para poder llamar a calculateTotalProfit
    const updatedAlert = await Alert.findById(alert._id);
    if (updatedAlert) {
      updatedAlert.liquidityData = {
        ...liquidityData,
        partialSales: partialSales
      };
      updatedAlert.participationPercentage = newParticipationPercentage;
      
      // ✅ NUEVO: Calcular ganancia realizada acumulada
      updatedAlert.calculateTotalProfit();
      
      await updatedAlert.save();
    } else {
      // Fallback: usar updateOne si no se puede recargar
      await Alert.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            'liquidityData.partialSales': partialSales,
            participationPercentage: newParticipationPercentage
          } 
        }
      );
    }
    
    console.log(`✅ ${alert.symbol}: Venta ejecutada - ${percentage}% vendido a $${closePrice} - Participación restante: ${newParticipationPercentage}%`);
    
    // Actualizar sistema de liquidez si hay admin
    if (adminUser) {
      try {
        const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        const LiquidityModule = await import('@/models/Liquidity');
        const Liquidity = LiquidityModule.default;
        const OperationModule = await import('@/models/Operation');
        const Operation = OperationModule.default;
        
        // ✅ CORREGIDO: Buscar liquidez que contenga la distribución del alertId
        // Esto asegura que encontremos el documento correcto sin importar quién lo creó
        let liquidity = await Liquidity.findOne({ 
          pool,
          'distributions.alertId': alert._id.toString()
        });
        
        let liquidityReleased = 0;
        let sharesToSellFinal = 0;
        
        if (liquidity) {
          const distribution = liquidity.distributions.find((d: any) => 
            d.alertId && d.alertId.toString() === alert._id.toString()
          );
          
          if (distribution && distribution.shares > 0) {
            // ✅ Caso 1: Tiene distribución de liquidez
            sharesToSellFinal = isCompleteSale 
              ? distribution.shares 
              : distribution.shares * (percentage / 100);
            
            const { returnedCash, remainingShares } = liquidity.sellShares(
              alert._id.toString(), 
              sharesToSellFinal, 
              closePrice
            );
            
            liquidityReleased = returnedCash;
            
            if (remainingShares <= 0) {
              liquidity.removeDistribution(alert._id.toString());
            }
            
            await liquidity.save();
            console.log(`✅ ${alert.symbol}: Liquidez actualizada (distribución) - +$${returnedCash.toFixed(2)} liberados`);
          } else {
            // ✅ Caso 2: No tiene distribución, buscar en operación de compra
            console.log(`⚠️ ${alert.symbol}: No tiene distribución de liquidez, buscando operación de compra...`);
            
            const buyOperation = await Operation.findOne({
              alertId: alert._id,
              operationType: 'COMPRA',
              system: pool
            }).sort({ date: -1 });
            
            if (buyOperation && buyOperation.portfolioPercentage > 0) {
              // ✅ CORREGIDO: Calcular liquidez liberada basándose en participationPercentage y precio actual
              // Primero calcular acciones a vender basándose en la posición actual
              const currentParticipation = alert.participationPercentage ?? 100;
              
              // Calcular el valor actual de la posición basado en participationPercentage
              // Si participationPercentage es 50%, significa que tenemos el 50% de la posición original
              const baseLiquidity = liquidity.initialLiquidity || liquidity.totalLiquidity || 1000;
              const totalAllocated = baseLiquidity * (buyOperation.portfolioPercentage / 100);
              
              // Calcular acciones totales actuales basándose en participationPercentage y precio actual
              const currentShares = (totalAllocated * (currentParticipation / 100)) / (alert.entryPrice || closePrice);
              
              // Calcular acciones a vender
              sharesToSellFinal = isCompleteSale 
                ? currentShares 
                : currentShares * (percentage / 100);
              
              // ✅ CORREGIDO: Calcular liquidez liberada basándose en participationPercentage y precio actual
              // La liquidez liberada = (participationPercentage / 100) * currentPrice * sharesToSell
              liquidityReleased = (currentParticipation / 100) * closePrice * sharesToSellFinal;
              
              // ✅ CORREGIDO: Calcular ganancia realizada
              const proceeds = sharesToSellFinal * closePrice;
              const costBasis = sharesToSellFinal * (alert.entryPrice || closePrice);
              const realizedProfit = proceeds - costBasis;
              
              // ✅ CORREGIDO: Actualizar totalLiquidity con el efectivo total recibido (proceeds)
              // Cuando vendemos, recibimos proceeds en efectivo que debe agregarse a totalLiquidity
              // El costBasis que estaba en distributedLiquidity se libera reduciendo distributedLiquidity
              // La ganancia (realizedProfit) es dinero nuevo que también debe estar en totalLiquidity
              // Por lo tanto, sumamos proceeds completo (costBasis + realizedProfit) a totalLiquidity
              liquidity.totalLiquidity = (liquidity.totalLiquidity || baseLiquidity) + proceeds;
              
              // ✅ CORREGIDO: Reducir distributedLiquidity en el monto liberado
              // Esto aumenta availableLiquidity automáticamente
              liquidity.distributedLiquidity = Math.max(0, (liquidity.distributedLiquidity || 0) - liquidityReleased);
              
              // ✅ CORREGIDO: Recalcular availableLiquidity
              liquidity.availableLiquidity = liquidity.totalLiquidity - liquidity.distributedLiquidity;
              
              await liquidity.save();
              
              console.log(`✅ ${alert.symbol}: Liquidez actualizada (desde operación)`);
              console.log(`   - Liquidez liberada: $${liquidityReleased.toFixed(2)}`);
              console.log(`   - Ganancia realizada: $${realizedProfit.toFixed(2)}`);
              console.log(`   - totalLiquidity: $${liquidity.totalLiquidity.toFixed(2)}`);
              console.log(`   - distributedLiquidity: $${liquidity.distributedLiquidity.toFixed(2)}`);
              console.log(`   - availableLiquidity: $${liquidity.availableLiquidity.toFixed(2)}`);
              console.log(`📊 portfolioPercentage: ${buyOperation.portfolioPercentage}%, base: $${baseLiquidity}`);
            } else {
              console.log(`⚠️ ${alert.symbol}: No se encontró operación de compra con portfolioPercentage`);
            }
          }
        }
        
        // Registrar operación de venta si se liberó liquidez
        if (liquidityReleased > 0) {
          await registerSaleOperation(alert, sharesToSellFinal, closePrice, pool, adminUser, percentage, isCompleteSale, liquidityReleased);
        }
        
      } catch (liquidityError) {
        console.error(`⚠️ Error actualizando liquidez para ${alert.symbol}:`, liquidityError);
      }
    }
    
    const shouldClose = isCompleteSale || newParticipationPercentage <= 0;
    
    return {
      shouldClose,
      profitPercentage,
      newParticipationPercentage
    };
    
  } catch (error) {
    console.error(`❌ Error ejecutando venta programada para ${alert.symbol}:`, error);
    return { shouldClose: false, profitPercentage: 0, newParticipationPercentage: 100 };
  }
}

/**
 * Registra una operación de venta
 * ✅ CORREGIDO: Ahora actualiza la operación pendiente existente en lugar de crear una nueva
 */
async function registerSaleOperation(
  alert: any,
  sharesToSell: number,
  closePrice: number,
  pool: string,
  adminUser: any,
  percentage: number,
  isCompleteSale: boolean,
  liquidityReleased?: number
) {
  try {
    const OperationModule = await import('@/models/Operation');
    const Operation = OperationModule.default;
    
    const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
      .sort({ date: -1 })
      .select('balance');
    const currentBalance = currentBalanceDoc?.balance || 0;
    
    const actualLiquidityReleased = liquidityReleased ?? (sharesToSell * closePrice);
    const newBalance = currentBalance + actualLiquidityReleased;
    
    const buyOperation = await Operation.findOne({ 
      alertId: alert._id, 
      operationType: 'COMPRA',
      system: pool
    }).sort({ date: -1 });
    
    const entryPrice = alert.entryPrice || closePrice;
    const marketValue = sharesToSell * closePrice;
    const realizedProfit = marketValue - actualLiquidityReleased;
    
    // ✅ NUEVO: Buscar operación de VENTA pendiente (con rango) para actualizarla
    const pendingOperation = await Operation.findOne({
      alertId: alert._id,
      operationType: 'VENTA',
      system: pool,
      $or: [
        { priceRange: { $exists: true } },
        { isPriceConfirmed: { $ne: true } }
      ]
    }).sort({ date: -1 });
    
    if (pendingOperation) {
      // ✅ ACTUALIZAR la operación existente en lugar de crear una nueva
      console.log(`🔄 ${alert.symbol}: Actualizando operación de venta pendiente...`);
      
      pendingOperation.price = closePrice;
      pendingOperation.quantity = -sharesToSell;
      pendingOperation.amount = actualLiquidityReleased;
      pendingOperation.balance = newBalance;
      pendingOperation.isPriceConfirmed = true;
      pendingOperation.priceRange = undefined; // Limpiar el rango
      pendingOperation.executedBy = 'SYSTEM';
      pendingOperation.executionMethod = 'AUTOMATIC';
      pendingOperation.liquidityData = {
        entryPrice: entryPrice,
        realizedProfit: realizedProfit
      };
      pendingOperation.notes = `Venta ${isCompleteSale ? 'completa' : 'parcial'} (${percentage}%) ejecutada automáticamente a precio de cierre $${closePrice} - ${alert.symbol}`;
      
      await pendingOperation.save();
      console.log(`✅ ${alert.symbol}: Operación de venta actualizada (precio confirmado: $${closePrice})`);
    } else {
      // Si no hay operación pendiente, crear una nueva
      console.log(`📝 ${alert.symbol}: Creando nueva operación de venta...`);
      
      const operation = new Operation({
        ticker: alert.symbol.toUpperCase(),
        operationType: 'VENTA',
        quantity: -sharesToSell,
        price: closePrice,
        amount: actualLiquidityReleased,
        date: new Date(),
        balance: newBalance,
        alertId: alert._id,
        alertSymbol: alert.symbol.toUpperCase(),
        system: pool,
        createdBy: adminUser._id,
        isPartialSale: !isCompleteSale,
        partialSalePercentage: percentage,
        portfolioPercentage: buyOperation?.portfolioPercentage,
        isPriceConfirmed: true,
        liquidityData: {
          entryPrice: entryPrice,
          realizedProfit: realizedProfit
        },
        executedBy: 'SYSTEM',
        executionMethod: 'AUTOMATIC',
        notes: `Venta ${isCompleteSale ? 'completa' : 'parcial'} (${percentage}%) ejecutada automáticamente a precio de cierre $${closePrice} - ${alert.symbol}`
      });
      
      await operation.save();
      console.log(`✅ ${alert.symbol}: Operación de venta registrada`);
    }
  } catch (error) {
    console.error(`⚠️ Error registrando operación de venta para ${alert.symbol}:`, error);
  }
}
      
/**
 * Actualiza el precio de la operación de COMPRA cuando se confirma la alerta
 * Esto asegura que el precio en OPERACIONES coincida con el del email de confirmación
 */
export async function updateOperationPriceOnConfirmation(alertId: any, finalPrice: number) {
  try {
    const Operation = (await import('@/models/Operation')).default;
    const Liquidity = (await import('@/models/Liquidity')).default;
    
    // Buscar la operación de COMPRA asociada a esta alerta
    const operation = await Operation.findOne({
      alertId: alertId,
      operationType: 'COMPRA'
    });
    
    if (!operation) {
      console.log(`⚠️ No se encontró operación de COMPRA para alerta ${alertId}`);
      return;
    }
    
    const oldPrice = operation.price;
    
    // Actualizar el precio y recalcular el monto
    operation.price = finalPrice;
    operation.amount = operation.quantity * finalPrice;
    
    // ✅ NUEVO: Marcar el precio como confirmado y limpiar el rango
    operation.isPriceConfirmed = true;
    operation.priceRange = undefined;
    
    // Actualizar también el precio de entrada en liquidityData si existe
    if (operation.liquidityData) {
      operation.liquidityData.entryPrice = finalPrice;
      // Recalcular allocatedAmount basado en shares y nuevo precio
      if (operation.liquidityData.shares) {
        operation.liquidityData.allocatedAmount = operation.liquidityData.shares * finalPrice;
      }
    }
    
    // Agregar nota de actualización
    const existingNotes = operation.notes || '';
    operation.notes = `${existingNotes} | Precio confirmado: $${finalPrice.toFixed(2)} (anterior: $${oldPrice.toFixed(2)})`;
    
    await operation.save();
    
    console.log(`✅ Operación actualizada: ${operation.ticker} - Precio: $${oldPrice.toFixed(2)} → $${finalPrice.toFixed(2)}`);
    
    // ✅ NUEVO: También actualizar la distribución de liquidez para mantener consistencia
    try {
      const alertIdString = alertId.toString();
      
      // Buscar todas las liquidez que tengan esta distribución
      const liquidities = await Liquidity.find({
        'distributions.alertId': alertIdString
      });
      
      for (const liquidity of liquidities) {
        const distribution = liquidity.distributions.find(
          (dist: any) => dist.alertId?.toString() === alertIdString
        );
        
        if (distribution) {
          const oldEntryPrice = distribution.entryPrice;
          
          // Actualizar el precio de entrada
          distribution.entryPrice = finalPrice;
          distribution.currentPrice = finalPrice;
          
          // Recalcular allocatedAmount manteniendo el mismo número de shares
          if (distribution.shares) {
            distribution.allocatedAmount = distribution.shares * finalPrice;
          }
          
          distribution.updatedAt = new Date();
          
          // Recalcular totales de liquidez
          liquidity.recalculateDistributions();
          await liquidity.save();
          
          console.log(`✅ Distribución de liquidez actualizada: alertId=${alertIdString} - Precio: $${oldEntryPrice.toFixed(2)} → $${finalPrice.toFixed(2)}`);
        }
      }
    } catch (liquidityError) {
      console.error(`⚠️ Error actualizando distribución de liquidez:`, liquidityError);
      // No fallar la operación principal por un error en liquidez
    }
    
  } catch (error) {
    console.error(`⚠️ Error actualizando precio de operación para alerta ${alertId}:`, error);
  }
}

/**
 * ✅ NUEVO: Envía un email de resumen consolidado con todas las operaciones del cron
 * Esta función reemplaza el envío de múltiples emails individuales por UN solo email de resumen
 */
async function enviarResumenOperaciones(acciones: AccionResumen[]): Promise<void> {
  try {
    console.log(`📧 [RESUMEN] Iniciando envío de resumen con ${acciones.length} acciones...`);
    
    if (acciones.length === 0) {
      console.log('📧 [RESUMEN] No hay acciones para notificar');
      return;
    }
    
    // Agrupar acciones por tipo de alerta (SmartMoney, TraderCall)
    const accionesPorTipo: Record<string, AccionResumen[]> = {
      SmartMoney: [],
      TraderCall: []
    };
    
    for (const accion of acciones) {
      if (accionesPorTipo[accion.alertaTipo]) {
        accionesPorTipo[accion.alertaTipo].push(accion);
      }
    }
    
    // Importar módulos necesarios
    const { sendEmail } = await import('@/lib/emailService');
    const User = (await import('@/models/User')).default;
    
    // Procesar cada tipo de alerta por separado
    for (const [tipoAlerta, accionesTipo] of Object.entries(accionesPorTipo)) {
      if (accionesTipo.length === 0) continue;
      
      console.log(`📧 [RESUMEN] Procesando ${accionesTipo.length} acciones para ${tipoAlerta}...`);
      
      // Buscar usuarios suscritos UNA sola vez
      const now = new Date();
      console.log(`🔍 [RESUMEN] Buscando usuarios suscritos a ${tipoAlerta}...`);
      const subscribedUsers = await User.find({
        $or: [
          {
            'activeSubscriptions': {
              $elemMatch: {
                service: tipoAlerta,
                isActive: true,
                expiryDate: { $gte: now }
              }
            }
          },
          {
            'suscripciones': {
              $elemMatch: {
                servicio: tipoAlerta,
                activa: true,
                fechaVencimiento: { $gte: now }
              }
            }
          }
        ]
      }, 'email name role activeSubscriptions suscripciones').lean();
      
      // Filtrar usuarios válidos - verificar AMBOS sistemas de suscripciones
      const validUsers = subscribedUsers.filter(user => {
        // Verificar activeSubscriptions (sistema nuevo)
        const hasActiveSub = (user as any).activeSubscriptions?.some((sub: any) => 
          sub.service === tipoAlerta && 
          sub.isActive === true && 
          new Date(sub.expiryDate) >= now
        );
        
        // Verificar suscripciones (sistema legacy)
        const hasLegacySub = (user as any).suscripciones?.some((sub: any) => 
          sub.servicio === tipoAlerta && 
          sub.activa === true && 
          new Date(sub.fechaVencimiento) >= now
        );
        
        return hasActiveSub || hasLegacySub;
      });
      
      console.log(`👥 [RESUMEN] ${subscribedUsers.length} usuarios encontrados, ${validUsers.length} válidos para ${tipoAlerta}`);
      
      if (validUsers.length === 0) {
        console.log(`⚠️ [RESUMEN] No hay usuarios válidos para ${tipoAlerta}, saltando...`);
        continue;
      }
      
      // ✅ TESTING MODE: Solo enviar emails a administradores si está activado
      const TESTING_MODE = process.env.EMAIL_TESTING_MODE === 'true';
      const usersToEmail = TESTING_MODE 
        ? validUsers.filter((user: any) => user.role === 'admin')
        : validUsers;
      
      if (TESTING_MODE) {
        console.log(`🧪 [RESUMEN] MODO TESTING - Solo enviando a ${usersToEmail.length} admins`);
      }
      
      if (usersToEmail.length === 0) {
        console.log(`⚠️ [RESUMEN] No hay usuarios para enviar emails de ${tipoAlerta}, saltando...`);
        continue;
      }
      
      console.log(`📤 [RESUMEN] Preparando envío a ${usersToEmail.length} usuarios de ${tipoAlerta}...`);
      
      // Generar HTML del resumen
      const htmlResumen = generarEmailResumenHTML(tipoAlerta, accionesTipo);
      const fechaHoy = new Date().toLocaleDateString('es-AR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      
      // Enviar a Telegram primero (un solo mensaje consolidado)
      try {
        await enviarResumenTelegram(tipoAlerta, accionesTipo);
      } catch (telegramError) {
        console.error(`❌ [RESUMEN] Error enviando a Telegram:`, telegramError);
      }
      
      // Enviar emails
      let emailsSent = 0;
      for (const user of usersToEmail) {
        try {
          await sendEmail({
            to: (user as any).email,
            subject: `📊 Resumen de Operaciones ${tipoAlerta} - ${fechaHoy}`,
            html: htmlResumen
          });
          emailsSent++;
          
          // Pequeña pausa para evitar rate limiting (100ms en lugar de 500ms)
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (emailError) {
          console.error(`❌ [RESUMEN] Error enviando email a ${(user as any).email}:`, emailError);
        }
      }
      
      console.log(`✅ [RESUMEN] ${tipoAlerta}: ${emailsSent}/${usersToEmail.length} emails enviados`);
    }
    
    console.log('🎉 [RESUMEN] Resumen de operaciones enviado completamente');
    
  } catch (error) {
    console.error('❌ [RESUMEN] Error general enviando resumen:', error);
    throw error;
  }
}

/**
 * Genera el HTML del email de resumen de operaciones
 */
function generarEmailResumenHTML(tipoAlerta: string, acciones: AccionResumen[]): string {
  const fechaHoy = new Date().toLocaleDateString('es-AR', { 
    weekday: 'long',
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  
  // Agrupar acciones por tipo
  const comprasConfirmadas = acciones.filter(a => a.tipo === 'COMPRA_CONFIRMADA');
  const ventasEjecutadas = acciones.filter(a => a.tipo === 'VENTA_EJECUTADA');
  const comprasDescartadas = acciones.filter(a => a.tipo === 'COMPRA_DESCARTADA');
  const ventasDescartadas = acciones.filter(a => a.tipo === 'VENTA_DESCARTADA');
  
  // Calcular estadísticas
  const totalAcciones = acciones.length;
  
  // Generar secciones HTML
  let seccionesHTML = '';
  
  if (comprasConfirmadas.length > 0) {
    seccionesHTML += `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #22c55e; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #22c55e; padding-bottom: 8px;">
          ✅ COMPRAS CONFIRMADAS (${comprasConfirmadas.length})
        </h3>
        ${comprasConfirmadas.map(a => `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
            <div style="font-weight: 600; color: #166534; font-size: 15px;">📈 ${a.symbol}</div>
            <div style="color: #15803d; margin-top: 5px;">
              Entrada confirmada a <strong>$${a.precio.toFixed(2)}</strong>
              ${a.detalles.rangoOriginal ? `<br><span style="color: #64748b; font-size: 13px;">Rango original: $${a.detalles.rangoOriginal.min.toFixed(2)} - $${a.detalles.rangoOriginal.max.toFixed(2)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  if (ventasEjecutadas.length > 0) {
    seccionesHTML += `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #ef4444; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">
          🔴 VENTAS EJECUTADAS (${ventasEjecutadas.length})
        </h3>
        ${ventasEjecutadas.map(a => {
          const profitSign = (a.detalles.profitPorcentaje || 0) >= 0 ? '+' : '';
          const profitColor = (a.detalles.profitPorcentaje || 0) >= 0 ? '#22c55e' : '#ef4444';
          return `
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
              <div style="font-weight: 600; color: #dc2626; font-size: 15px;">📉 ${a.symbol}</div>
              <div style="color: #b91c1c; margin-top: 5px;">
                ${a.detalles.posicionCerrada ? 'Posición cerrada' : `Vendido ${a.detalles.porcentajeVendido}%`} a <strong>$${a.precio.toFixed(2)}</strong>
                <br><span style="color: ${profitColor}; font-weight: 600;">Profit: ${profitSign}${(a.detalles.profitPorcentaje || 0).toFixed(2)}%</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  if (comprasDescartadas.length > 0) {
    seccionesHTML += `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #f97316; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #f97316; padding-bottom: 8px;">
          ❌ COMPRAS DESCARTADAS (${comprasDescartadas.length})
        </h3>
        ${comprasDescartadas.map(a => `
          <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
            <div style="font-weight: 600; color: #c2410c; font-size: 15px;">🚫 ${a.symbol}</div>
            <div style="color: #9a3412; margin-top: 5px;">
              Precio de cierre: <strong>$${a.precio.toFixed(2)}</strong> - Fuera del rango
              ${a.detalles.rangoOriginal ? `<br><span style="color: #64748b; font-size: 13px;">Rango: $${a.detalles.rangoOriginal.min.toFixed(2)} - $${a.detalles.rangoOriginal.max.toFixed(2)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  if (ventasDescartadas.length > 0) {
    seccionesHTML += `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #a855f7; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #a855f7; padding-bottom: 8px;">
          ⏸️ VENTAS DESCARTADAS (${ventasDescartadas.length})
        </h3>
        ${ventasDescartadas.map(a => `
          <div style="background: #faf5ff; border-left: 4px solid #a855f7; padding: 12px 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
            <div style="font-weight: 600; color: #7e22ce; font-size: 15px;">⏸️ ${a.symbol}</div>
            <div style="color: #6b21a8; margin-top: 5px;">
              Precio de cierre: <strong>$${a.precio.toFixed(2)}</strong> - Fuera del rango de venta
              ${a.detalles.rangoOriginal ? `<br><span style="color: #64748b; font-size: 13px;">Rango: $${a.detalles.rangoOriginal.min.toFixed(2)} - $${a.detalles.rangoOriginal.max.toFixed(2)}</span>` : ''}
              <br><span style="color: #64748b; font-size: 13px;">La posición sigue activa sin venta programada</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Construir email completo
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Resumen de Operaciones - ${tipoAlerta}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: white; padding: 30px 25px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
          📊 Resumen de Operaciones
        </h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 15px;">
          ${tipoAlerta} • ${fechaHoy}
        </p>
      </div>
      
      <!-- Stats Summary -->
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; text-align: center;">
        <div style="display: inline-block;">
          <div style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase;">Total Operaciones</div>
          <div style="color: white; font-size: 28px; font-weight: 700;">${totalAcciones}</div>
        </div>
      </div>
      
      <!-- Content -->
      <div style="padding: 25px; background: white;">
        ${seccionesHTML}
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; padding: 20px 25px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">
          Este es un email automático de <strong>Nahuel Lozano Trading</strong>
        </p>
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">
          Para configurar tus preferencias de notificación, visita tu <a href="/perfil" style="color: #3b82f6;">perfil</a>
        </p>
      </div>
      
    </body>
    </html>
  `;
}

/**
 * ✅ NUEVO: Envía notificación cuando no hay compras ni ventas
 */
async function enviarNotificacionSinOperaciones(): Promise<void> {
  try {
    console.log(`📧 [SIN OPERACIONES] Iniciando envío de notificación...`);
    
    const mensaje = "👋🏻 ¡Buenas a todos! ¿Cómo están? Hoy no tenemos activos para comprar ni para vender. Por lo que mantenemos la cartera tal cual como la tenemos hasta ahora.";
    
    // Importar módulos necesarios
    const { sendEmail } = await import('@/lib/emailService');
    const User = (await import('@/models/User')).default;
    const { sendMessageToChannel } = await import('@/lib/telegramBot');
    
    // Procesar ambos servicios (TraderCall y SmartMoney)
    const servicios = ['TraderCall', 'SmartMoney'];
    
    for (const tipoAlerta of servicios) {
      try {
        // Buscar usuarios suscritos
        const now = new Date();
        const subscribedUsers = await User.find({
          $or: [
            {
              'activeSubscriptions': {
                $elemMatch: {
                  service: tipoAlerta,
                  isActive: true,
                  expiryDate: { $gte: now }
                }
              }
            },
            {
              'suscripciones': {
                $elemMatch: {
                  servicio: tipoAlerta,
                  activa: true,
                  fechaVencimiento: { $gte: now }
                }
              }
            }
          ]
        }, 'email name role activeSubscriptions suscripciones').lean();
        
        // Filtrar usuarios válidos
        const validUsers = subscribedUsers.filter(user => {
          const hasActiveSub = (user as any).activeSubscriptions?.some((sub: any) => 
            sub.service === tipoAlerta && 
            sub.isActive === true && 
            new Date(sub.expiryDate) >= now
          );
          
          const hasLegacySub = (user as any).suscripciones?.some((sub: any) => 
            sub.servicio === tipoAlerta && 
            sub.activa === true && 
            new Date(sub.fechaVencimiento) >= now
          );
          
          return hasActiveSub || hasLegacySub;
        });
        
        console.log(`👥 [SIN OPERACIONES] ${validUsers.length} usuarios válidos para ${tipoAlerta}`);
        
        if (validUsers.length === 0) {
          console.log(`⚠️ [SIN OPERACIONES] No hay usuarios válidos para ${tipoAlerta}, saltando...`);
          continue;
        }
        
        // ✅ TESTING MODE: Solo enviar emails a administradores si está activado
        const TESTING_MODE = process.env.EMAIL_TESTING_MODE === 'true';
        const usersToEmail = TESTING_MODE 
          ? validUsers.filter((user: any) => user.role === 'admin')
          : validUsers;
        
        if (TESTING_MODE) {
          console.log(`🧪 [SIN OPERACIONES] MODO TESTING - Solo enviando a ${usersToEmail.length} admins`);
        }
        
        // Enviar a Telegram
        try {
          await sendMessageToChannel(tipoAlerta, mensaje);
          console.log(`✅ [SIN OPERACIONES] Telegram enviado para ${tipoAlerta}`);
        } catch (telegramError) {
          console.error(`❌ [SIN OPERACIONES] Error enviando a Telegram:`, telegramError);
        }
        
        // Generar HTML del email
        const fechaHoy = new Date().toLocaleDateString('es-AR', { 
          weekday: 'long',
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
        
        const htmlEmail = `
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sin Operaciones - ${tipoAlerta}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: white; padding: 30px 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                👋🏻 Actualización del Día
              </h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 15px;">
                ${tipoAlerta} • ${fechaHoy}
              </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 25px; background: white;">
              <p style="margin: 0; font-size: 16px; line-height: 1.8; color: #334155;">
                ${mensaje}
              </p>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 20px 25px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">
                Este es un email automático de <strong>Nahuel Lozano Trading</strong>
              </p>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Para configurar tus preferencias de notificación, visita tu <a href="/perfil" style="color: #3b82f6;">perfil</a>
              </p>
            </div>
            
          </body>
          </html>
        `;
        
        // Enviar emails
        let emailsSent = 0;
        for (const user of usersToEmail) {
          try {
            await sendEmail({
              to: (user as any).email,
              subject: `👋🏻 Actualización ${tipoAlerta} - ${fechaHoy}`,
              html: htmlEmail
            });
            emailsSent++;
            
            // Pequeña pausa para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (emailError) {
            console.error(`❌ [SIN OPERACIONES] Error enviando email a ${(user as any).email}:`, emailError);
          }
        }
        
        console.log(`✅ [SIN OPERACIONES] ${tipoAlerta}: ${emailsSent}/${usersToEmail.length} emails enviados`);
      } catch (error) {
        console.error(`❌ [SIN OPERACIONES] Error procesando ${tipoAlerta}:`, error);
      }
    }
    
    console.log('🎉 [SIN OPERACIONES] Notificación enviada completamente');
    
  } catch (error) {
    console.error('❌ [SIN OPERACIONES] Error general enviando notificación:', error);
    throw error;
  }
}

/**
 * Envía un mensaje de resumen consolidado a Telegram
 */
async function enviarResumenTelegram(tipoAlerta: string, acciones: AccionResumen[]): Promise<void> {
  try {
    const { sendMessageToChannel } = await import('@/lib/telegramBot');
    
    // Agrupar acciones
    const comprasConfirmadas = acciones.filter(a => a.tipo === 'COMPRA_CONFIRMADA');
    const ventasEjecutadas = acciones.filter(a => a.tipo === 'VENTA_EJECUTADA');
    const comprasDescartadas = acciones.filter(a => a.tipo === 'COMPRA_DESCARTADA');
    const ventasDescartadas = acciones.filter(a => a.tipo === 'VENTA_DESCARTADA');
    
    let mensaje = `📊 *RESUMEN DE OPERACIONES - ${tipoAlerta}*\n`;
    mensaje += `📅 ${new Date().toLocaleDateString('es-AR')}\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (comprasConfirmadas.length > 0) {
      mensaje += `✅ *COMPRAS CONFIRMADAS (${comprasConfirmadas.length})*\n`;
      comprasConfirmadas.forEach(a => {
        const rangoInfo = a.detalles.rangoOriginal 
          ? ` (Rango: $${a.detalles.rangoOriginal.min.toFixed(2)} - $${a.detalles.rangoOriginal.max.toFixed(2)})`
          : '';
        mensaje += `• *${a.symbol}*: Entrada confirmada a $${a.precio.toFixed(2)}${rangoInfo}\n`;
      });
      mensaje += `\n`;
    }
    
    if (ventasEjecutadas.length > 0) {
      mensaje += `🔴 *VENTAS EJECUTADAS (${ventasEjecutadas.length})*\n`;
      ventasEjecutadas.forEach(a => {
        const profitPorcentaje = a.detalles.profitPorcentaje || 0;
        const profitSign = profitPorcentaje >= 0 ? '+' : '';
        const profitEmoji = profitPorcentaje >= 0 ? '📈' : '📉';
        const ventaInfo = a.detalles.posicionCerrada 
          ? 'Posición cerrada'
          : (a.detalles.porcentajeVendido 
              ? `Venta parcial (${a.detalles.porcentajeVendido}%)`
              : 'Venta ejecutada');
        mensaje += `• *${a.symbol}*: ${ventaInfo} a $${a.precio.toFixed(2)} ${profitEmoji} ${profitSign}${profitPorcentaje.toFixed(2)}%\n`;
      });
      mensaje += `\n`;
    }
    
    if (comprasDescartadas.length > 0) {
      mensaje += `❌ *COMPRAS DESCARTADAS (${comprasDescartadas.length})*\n`;
      comprasDescartadas.forEach(a => {
        mensaje += `• ${a.symbol}: Precio fuera de rango\n`;
      });
      mensaje += `\n`;
    }
    
    if (ventasDescartadas.length > 0) {
      mensaje += `⏸️ *VENTAS DESCARTADAS (${ventasDescartadas.length})*\n`;
      ventasDescartadas.forEach(a => {
        mensaje += `• ${a.symbol}: Precio fuera de rango\n`;
      });
    }
    
    // ✅ NUEVO: Crear botones inline para ir a operaciones
    const baseUrl = process.env.NEXTAUTH_URL || 'https://lozanonahuel.com';
    const operacionesUrl = tipoAlerta === 'TraderCall' 
      ? `${baseUrl}/alertas/trader-call?tab=operaciones`
      : `${baseUrl}/alertas/smart-money?tab=operaciones`;
    
    const inlineKeyboard = [
      [
        {
          text: '📊 Ver Operaciones',
          url: operacionesUrl
        }
      ]
    ];
    
    await sendMessageToChannel(tipoAlerta, mensaje, { inlineKeyboard });
    console.log(`✅ [TELEGRAM] Resumen enviado para ${tipoAlerta} con botón de operaciones`);
    
  } catch (error) {
    console.error(`❌ [TELEGRAM] Error enviando resumen:`, error);
  }
}
