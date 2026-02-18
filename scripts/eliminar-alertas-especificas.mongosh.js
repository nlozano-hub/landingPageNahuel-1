/*******************************
 * ELIMINAR ALERTAS ESPECÍFICAS
 * 
 * Elimina alertas específicas de AMX y TWLO
 * según precio de entrada:
 * - AMX con entryPrice 20.70
 * - AMX con entryPrice 21.02
 * - TWLO con entryPrice 129.53
 *******************************/

const DRY_RUN = true; // Cambiar a false para ejecutar la eliminación

// Alertas a eliminar
const ALERTAS_A_ELIMINAR = [
  { symbol: "AMX", entryPrice: 20.70 },
  { symbol: "AMX", entryPrice: 21.02 },
  { symbol: "TWLO", entryPrice: 129.53 }
];

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;
const opsColl = db.getCollection("operations");

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura, no eliminará nada)" : "OFF (ELIMINARÁ las alertas)",
  alertasAEliminar: ALERTAS_A_ELIMINAR
});

/****************************************
 * 1) Buscar las alertas específicas
 ****************************************/
print("\n=== 1) Buscando alertas a eliminar ===");

const alertasEncontradas = [];

ALERTAS_A_ELIMINAR.forEach(({ symbol, entryPrice }) => {
  print(`\n--- Buscando ${symbol} con entryPrice ${entryPrice} ---`);
  
  // Buscar por entryPrice directo o por entryPriceRange
  const query = {
    symbol: symbol,
    $or: [
      { entryPrice: entryPrice },
      { "entryPriceRange.min": entryPrice },
      { "entryPriceRange.max": entryPrice }
    ]
  };
  
  const alertas = alertsColl.find(query).toArray();
  
  print(`Encontradas: ${alertas.length} alerta(s)`);
  
  alertas.forEach((alert, idx) => {
    const alertInfo = {
      _id: alert._id,
      symbol: alert.symbol,
      entryPrice: alert.entryPrice,
      entryPriceRange: alert.entryPriceRange,
      status: alert.status,
      action: alert.action,
      currentPrice: alert.currentPrice,
      createdAt: alert.createdAt,
      tipo: alert.tipo
    };
    
    print(`\n  ${idx + 1}. Alert ID: ${alert._id}`);
    print(`     Symbol: ${alert.symbol}`);
    print(`     Entry Price: ${alert.entryPrice || 'N/A'}`);
    print(`     Entry Price Range: ${alert.entryPriceRange ? `min: ${alert.entryPriceRange.min}, max: ${alert.entryPriceRange.max}` : 'N/A'}`);
    print(`     Status: ${alert.status}`);
    print(`     Action: ${alert.action}`);
    print(`     Current Price: ${alert.currentPrice}`);
    print(`     Tipo: ${alert.tipo}`);
    print(`     Created At: ${alert.createdAt}`);
    
    alertasEncontradas.push({
      _id: alert._id,
      symbol: alert.symbol,
      entryPrice: alert.entryPrice,
      entryPriceRange: alert.entryPriceRange,
      status: alert.status,
      tipo: alert.tipo || "TraderCall"
    });
  });
});

/****************************************
 * 2) Resumen de alertas encontradas
 ****************************************/
print("\n=== 2) Resumen ===");
print(`Total alertas encontradas: ${alertasEncontradas.length}`);

if (alertasEncontradas.length === 0) {
  print("⚠️ No se encontraron alertas con los criterios especificados.");
  print("Verificá que los símbolos y precios sean correctos.");
  quit();
}

// Verificar que encontramos exactamente las que esperamos
const esperadas = ALERTAS_A_ELIMINAR.length;
if (alertasEncontradas.length !== esperadas) {
  print(`⚠️ ADVERTENCIA: Se esperaban ${esperadas} alertas pero se encontraron ${alertasEncontradas.length}`);
  print("Revisá los resultados antes de continuar.");
}

/****************************************
 * 3) Buscar distribuciones de liquidez relacionadas
 ****************************************/
print("\n=== 3) Buscando distribuciones de liquidez ===");

const distribucionesEncontradas = [];

alertasEncontradas.forEach((alert) => {
  const pool = alert.tipo === "SmartMoney" ? "SmartMoney" : "TraderCall";
  const alertIdStr = alert._id.toString();
  
  // Buscar documentos de liquidez que contengan esta distribución
  const liquidityDocs = liquidityColl.find({
    pool: pool,
    "distributions.alertId": alertIdStr
  }).toArray();
  
  liquidityDocs.forEach((liquidityDoc) => {
    const distribution = (liquidityDoc.distributions || []).find(
      (d) => d.alertId && d.alertId.toString() === alertIdStr
    );
    
    if (distribution) {
      distribucionesEncontradas.push({
        alertId: alert._id,
        alertSymbol: alert.symbol,
        liquidityId: liquidityDoc._id,
        pool: pool,
        distribution: {
          allocatedAmount: distribution.allocatedAmount || 0,
          shares: distribution.shares || 0,
          entryPrice: distribution.entryPrice || 0,
          currentPrice: distribution.currentPrice || 0,
          profitLoss: distribution.profitLoss || 0,
          realizedProfitLoss: distribution.realizedProfitLoss || 0,
          isActive: distribution.isActive !== false
        }
      });
      
      print(`\n  Distribución encontrada para ${alert.symbol}:`);
      print(`     Liquidity ID: ${liquidityDoc._id}`);
      print(`     Pool: ${pool}`);
      print(`     Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
      print(`     Shares: ${(distribution.shares || 0).toFixed(6)}`);
      print(`     Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}`);
      print(`     Current Price: $${(distribution.currentPrice || 0).toFixed(2)}`);
      print(`     Profit/Loss: $${(distribution.profitLoss || 0).toFixed(2)}`);
      print(`     Realized P/L: $${(distribution.realizedProfitLoss || 0).toFixed(2)}`);
      print(`     Is Active: ${distribution.isActive !== false}`);
    }
  });
});

print(`\nTotal distribuciones encontradas: ${distribucionesEncontradas.length}`);

/****************************************
 * 4) Buscar operations relacionadas
 ****************************************/
print("\n=== 4) Buscando operations relacionadas ===");

const operationsEncontradas = [];

alertasEncontradas.forEach((alert) => {
  const ops = opsColl.find({ alertId: alert._id }).toArray();
  
  if (ops.length > 0) {
    operationsEncontradas.push({
      alertId: alert._id,
      alertSymbol: alert.symbol,
      operations: ops.map(op => ({
        _id: op._id,
        operationType: op.operationType,
        status: op.status,
        amount: op.amount
      }))
    });
    
    print(`\n  Operations para ${alert.symbol}:`);
    ops.forEach((op, idx) => {
      print(`     ${idx + 1}. Type: ${op.operationType}, Status: ${op.status}, Amount: $${(op.amount || 0).toFixed(2)}`);
    });
  }
});

print(`Total alertas con operations: ${operationsEncontradas.length}`);

/****************************************
 * 5) Eliminar las alertas y reasignar liquidez (si no es DRY_RUN)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 5) DRY RUN - No se eliminará nada ===");
  print("Para ejecutar la eliminación, cambiá DRY_RUN a false al inicio del script.");
  print("\nAlertas que se eliminarían:");
  alertasEncontradas.forEach((alert, idx) => {
    print(`  ${idx + 1}. ${alert.symbol} - ID: ${alert._id} - Status: ${alert.status}`);
  });
  
  if (distribucionesEncontradas.length > 0) {
    print("\nDistribuciones que se removerían:");
    distribucionesEncontradas.forEach((dist, idx) => {
      print(`  ${idx + 1}. ${dist.alertSymbol} - Liquidity ID: ${dist.liquidityId} - Amount: $${dist.distribution.allocatedAmount.toFixed(2)}`);
    });
  }
  
  if (operationsEncontradas.length > 0) {
    print("\n⚠️ ADVERTENCIA: Estas alertas tienen operations asociadas.");
    print("Considerá si también deberían eliminarse o marcarse como inactivas.");
  }
} else {
  print("\n=== 5) ELIMINANDO ALERTAS Y REASIGNANDO LIQUIDEZ ===");
  print("⚠️ ADVERTENCIA: Se procederá a eliminar las alertas y remover sus distribuciones.");
  
  let alertasEliminadas = 0;
  let distribucionesRemovidas = 0;
  let errores = 0;
  
  // Primero, remover distribuciones y recalcular liquidez
  if (distribucionesEncontradas.length > 0) {
    print("\n--- Removiendo distribuciones de liquidez ---");
    
    // Agrupar por liquidityId para procesar cada documento una vez
    const distribucionesPorLiquidity = {};
    
    distribucionesEncontradas.forEach((dist) => {
      const liquidityIdStr = dist.liquidityId.toString();
      if (!distribucionesPorLiquidity[liquidityIdStr]) {
        distribucionesPorLiquidity[liquidityIdStr] = {
          liquidityId: dist.liquidityId,
          pool: dist.pool,
          distributions: []
        };
      }
      distribucionesPorLiquidity[liquidityIdStr].distributions.push(dist);
    });
    
    // Procesar cada documento de liquidez
    Object.values(distribucionesPorLiquidity).forEach((grupo) => {
      try {
        const liquidityDoc = liquidityColl.findOne({ _id: grupo.liquidityId });
        if (!liquidityDoc) {
          print(`⚠️ No se encontró documento de liquidez ${grupo.liquidityId}`);
          return;
        }
        
        print(`\nProcesando Liquidity ID: ${grupo.liquidityId} (Pool: ${grupo.pool})`);
        
        // Remover cada distribución
        grupo.distributions.forEach((dist) => {
          const alertIdStr = dist.alertId.toString();
          
          // Remover la distribución del array
          const result = liquidityColl.updateOne(
            { _id: grupo.liquidityId },
            {
              $pull: {
                distributions: { alertId: alertIdStr }
              }
            }
          );
          
          if (result.modifiedCount > 0) {
            print(`  ✅ Distribución removida para ${dist.alertSymbol}`);
            distribucionesRemovidas++;
          } else {
            print(`  ⚠️ No se pudo remover distribución para ${dist.alertSymbol}`);
          }
        });
        
        // Recalcular liquidez después de remover distribuciones
        const updatedLiquidity = liquidityColl.findOne({ _id: grupo.liquidityId });
        const distributions = updatedLiquidity.distributions || [];
        
        // Calcular montos distribuidos (solo distribuciones activas con shares > 0)
        let montosDistribuidos = 0;
        let gananciasRealizadas = 0;
        let gananciasNoRealizadas = 0;
        
        distributions.forEach((d) => {
          if (d.isActive !== false && (d.shares || 0) > 0) {
            montosDistribuidos += d.allocatedAmount || 0;
            gananciasNoRealizadas += d.profitLoss || 0;
          }
          gananciasRealizadas += d.realizedProfitLoss || 0;
        });
        
        const initialLiquidity = updatedLiquidity.initialLiquidity || 0;
        const newTotalLiquidity = initialLiquidity + gananciasRealizadas + gananciasNoRealizadas;
        const newAvailableLiquidity = initialLiquidity - montosDistribuidos + gananciasRealizadas;
        
        // Actualizar liquidez
        liquidityColl.updateOne(
          { _id: grupo.liquidityId },
          {
            $set: {
              totalLiquidity: newTotalLiquidity,
              availableLiquidity: newAvailableLiquidity,
              distributedLiquidity: montosDistribuidos,
              updatedAt: new Date()
            }
          }
        );
        
        print(`  ✅ Liquidez recalculada:`);
        print(`     Total: $${newTotalLiquidity.toFixed(2)}`);
        print(`     Disponible: $${newAvailableLiquidity.toFixed(2)}`);
        print(`     Distribuida: $${montosDistribuidos.toFixed(2)}`);
        
      } catch (error) {
        print(`  ❌ Error procesando liquidez ${grupo.liquidityId}: ${error.message}`);
        errores++;
      }
    });
  }
  
  // Luego, eliminar las alertas
  print("\n--- Eliminando alertas ---");
  
  alertasEncontradas.forEach((alert, idx) => {
    try {
      const result = alertsColl.deleteOne({ _id: alert._id });
      
      if (result.deletedCount === 1) {
        print(`✅ ${idx + 1}. Eliminada: ${alert.symbol} - ID: ${alert._id}`);
        alertasEliminadas++;
      } else {
        print(`❌ ${idx + 1}. Error al eliminar: ${alert.symbol} - ID: ${alert._id} (no se encontró)`);
        errores++;
      }
    } catch (error) {
      print(`❌ ${idx + 1}. Error al eliminar: ${alert.symbol} - ID: ${alert._id}`);
      print(`   Error: ${error.message}`);
      errores++;
    }
  });
  
  // Advertencia sobre operations
  if (operationsEncontradas.length > 0) {
    print("\n⚠️ ADVERTENCIA: Estas alertas tenían operations asociadas:");
    operationsEncontradas.forEach((item) => {
      print(`  - ${item.alertSymbol}: ${item.operations.length} operation(s)`);
    });
    print("Las operations NO fueron eliminadas automáticamente.");
    print("Si necesitás eliminarlas también, hacelo manualmente o con otro script.");
  }
  
  print("\n=== 6) Resultado final ===");
  print(`Alertas eliminadas exitosamente: ${alertasEliminadas}`);
  print(`Distribuciones removidas: ${distribucionesRemovidas}`);
  print(`Errores: ${errores}`);
  print(`Total alertas procesadas: ${alertasEncontradas.length}`);
}

print("\n=== FIN DEL SCRIPT ===");
