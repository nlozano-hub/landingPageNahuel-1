/*******************************
 * ELIMINAR TODAS LAS ALERTAS CSCO
 * 
 * Elimina todas las alertas de CSCO y libera su liquidez
 *******************************/

const DRY_RUN = false; // Cambiar a false para ejecutar la eliminación

const SYMBOL = "CSCO";
const POOL = "TraderCall"; // Solo alertas de TraderCall

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;
const opsColl = db.getCollection("operations");
const apiCacheColl = db.apicaches;

print("=== ELIMINACIÓN DE ALERTAS CSCO (TRADERCALL) ===\n");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura, no eliminará nada)" : "OFF (ELIMINARÁ las alertas)",
  symbol: SYMBOL,
  pool: POOL
});

/****************************************
 * 1) Buscar todas las alertas de CSCO de TraderCall
 ****************************************/
print("\n=== 1) Buscando alertas de CSCO (TraderCall) ===");

// Buscar solo alertas de CSCO que sean de TraderCall (tipo !== "SmartMoney")
const alertas = alertsColl.find({ 
  symbol: SYMBOL,
  tipo: { $ne: "SmartMoney" } // Excluir SmartMoney, incluir TraderCall y undefined (que son TraderCall por defecto)
}).toArray();

print(`Total alertas encontradas: ${alertas.length}\n`);

if (alertas.length === 0) {
  print("✅ No se encontraron alertas de CSCO para eliminar.");
  quit();
}

alertas.forEach((alert, idx) => {
  print(`\nAlerta ${idx + 1}:`);
  print(`  ID: ${alert._id}`);
  print(`  Status: ${alert.status}`);
  print(`  Entry Price: ${alert.entryPrice ? `$${alert.entryPrice.toFixed(2)}` : "N/A"}`);
  print(`  Current Price: $${(alert.currentPrice || 0).toFixed(2)}`);
  print(`  Tipo: ${alert.tipo || "N/A"}`);
  print(`  Created At: ${alert.createdAt || "N/A"}`);
  
  if (alert.liquidityData) {
    print(`  LiquidityData:`);
    print(`    Shares: ${(alert.liquidityData.shares || 0).toFixed(6)}`);
    print(`    Allocated Amount: $${(alert.liquidityData.allocatedAmount || 0).toFixed(2)}`);
  }
});

/****************************************
 * 2) Buscar distribuciones de liquidez relacionadas
 ****************************************/
print("\n=== 2) Buscando distribuciones de liquidez ===");

const liquidityDoc = liquidityColl.findOne({ pool: POOL });

if (!liquidityDoc) {
  print(`⚠️ No se encontró documento de liquidez para ${POOL}`);
  print("Continuando con la eliminación de alertas...");
} else {
  const distributions = liquidityDoc.distributions || [];
  const distribucionesEncontradas = [];
  
  alertas.forEach((alert) => {
    const alertIdStr = alert._id.toString();
    
    const distribution = distributions.find((d) => {
      const distAlertId = d.alertId ? (typeof d.alertId === 'string' ? d.alertId : d.alertId.toString()) : null;
      return distAlertId === alertIdStr;
    });
    
    if (distribution) {
      distribucionesEncontradas.push({
        alertId: alert._id,
        alertIdStr: alertIdStr,
        symbol: alert.symbol,
        liquidityId: liquidityDoc._id,
        pool: POOL,
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
      
      print(`\nAlerta ${alert._id}:`);
      print(`  ✅ Tiene distribución:`);
      print(`     Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
      print(`     Shares: ${(distribution.shares || 0).toFixed(6)}`);
      print(`     Is Active: ${distribution.isActive !== false}`);
    }
  });
  
  print(`\nTotal distribuciones encontradas: ${distribucionesEncontradas.length}`);
}

/****************************************
 * 3) Buscar operations relacionadas
 ****************************************/
print("\n=== 3) Buscando operations relacionadas ===");

const operationsEncontradas = [];

alertas.forEach((alert) => {
  const ops = opsColl.find({ alertId: alert._id }).toArray();
  
  if (ops.length > 0) {
    operationsEncontradas.push({
      alertId: alert._id,
      operations: ops.map(op => ({
        _id: op._id,
        operationType: op.operationType,
        status: op.status,
        amount: op.amount
      }))
    });
    
    print(`\nAlerta ${alert._id}:`);
    print(`  Operations: ${ops.length}`);
    ops.forEach((op, idx) => {
      print(`    ${idx + 1}. Type: ${op.operationType} - Status: ${op.status} - Amount: $${Math.abs(op.amount || 0).toFixed(2)}`);
    });
  }
});

print(`\nTotal alertas con operations: ${operationsEncontradas.length}`);

/****************************************
 * 4) Eliminar alertas y liberar liquidez (si no es DRY_RUN)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 4) DRY RUN - No se eliminará nada ===");
  print("Para ejecutar la eliminación, cambiá DRY_RUN a false al inicio del script.");
  print("\nAlertas que se eliminarían:");
  alertas.forEach((alert, idx) => {
    print(`  ${idx + 1}. CSCO - ID: ${alert._id} - Status: ${alert.status}`);
  });
  
  if (operationsEncontradas.length > 0) {
    print("\n⚠️ ADVERTENCIA: Estas alertas tienen operations asociadas.");
    print("Las operations NO serán eliminadas automáticamente.");
  }
} else {
  print("\n=== 4) ELIMINANDO ALERTAS Y LIBERANDO LIQUIDEZ ===");
  print("⚠️ ADVERTENCIA: Se procederá a eliminar todas las alertas de CSCO.");
  
  let alertasEliminadas = 0;
  let distribucionesRemovidas = 0;
  let errores = 0;
  
  // Primero, remover distribuciones y recalcular liquidez
  if (liquidityDoc) {
    const distributions = liquidityDoc.distributions || [];
    const distribucionesARemover = [];
    
    alertas.forEach((alert) => {
      const alertIdStr = alert._id.toString();
      
      const distribution = distributions.find((d) => {
        const distAlertId = d.alertId ? (typeof d.alertId === 'string' ? d.alertId : d.alertId.toString()) : null;
        return distAlertId === alertIdStr;
      });
      
      if (distribution) {
        distribucionesARemover.push({
          alertIdStr: alertIdStr,
          symbol: alert.symbol,
          allocatedAmount: distribution.allocatedAmount || 0
        });
      }
    });
    
    if (distribucionesARemover.length > 0) {
      print("\n--- Removiendo distribuciones de liquidez ---");
      
      distribucionesARemover.forEach((dist) => {
        // Remover la distribución del array usando $pull
        let result = liquidityColl.updateOne(
          { _id: liquidityDoc._id },
          {
            $pull: {
              distributions: { alertId: dist.alertIdStr }
            }
          }
        );
        
        // Si no funcionó, intentar con ObjectId
        if (result.modifiedCount === 0) {
          try {
            result = liquidityColl.updateOne(
              { _id: liquidityDoc._id },
              {
                $pull: {
                  distributions: { alertId: ObjectId(dist.alertIdStr) }
                }
              }
            );
          } catch (e) {
            // Si falla, continuar
          }
        }
        
        if (result.modifiedCount > 0) {
          print(`  ✅ Distribución removida para ${dist.symbol} (Alert ID: ${dist.alertIdStr})`);
          distribucionesRemovidas++;
        } else {
          print(`  ⚠️ No se pudo remover distribución para ${dist.symbol}`);
        }
      });
      
      // Recalcular liquidez después de remover distribuciones
      const updatedLiquidity = liquidityColl.findOne({ _id: liquidityDoc._id });
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
      
      // Mostrar cambios
      const oldAvailable = updatedLiquidity.availableLiquidity || 0;
      const oldDistributed = updatedLiquidity.distributedLiquidity || 0;
      
      print(`\n  Estado ANTES de la limpieza:`);
      print(`     Available: $${oldAvailable.toFixed(2)}`);
      print(`     Distributed: $${oldDistributed.toFixed(2)}`);
      
      // Actualizar liquidez
      liquidityColl.updateOne(
        { _id: liquidityDoc._id },
        {
          $set: {
            totalLiquidity: newTotalLiquidity,
            availableLiquidity: newAvailableLiquidity,
            distributedLiquidity: montosDistribuidos,
            updatedAt: new Date()
          }
        }
      );
      
      print(`\n  Estado DESPUÉS de la limpieza:`);
      print(`     Total: $${newTotalLiquidity.toFixed(2)}`);
      print(`     Available: $${newAvailableLiquidity.toFixed(2)} (${newAvailableLiquidity > oldAvailable ? '+' : ''}${(newAvailableLiquidity - oldAvailable).toFixed(2)})`);
      print(`     Distributed: $${montosDistribuidos.toFixed(2)} (${montosDistribuidos < oldDistributed ? '-' : '+'}${(montosDistribuidos - oldDistributed).toFixed(2)})`);
      
      // Invalidar cache
      print("\n--- Invalidando cache ---");
      try {
        const cacheResult = apiCacheColl.deleteMany({
          "keyParts.path": { $regex: "^/api/liquidity/" },
          "keyParts.query.pool": POOL
        });
        print(`✅ Cache invalidado: ${cacheResult.deletedCount} entradas eliminadas para ${POOL}`);
      } catch (cacheError) {
        print(`⚠️ Error al invalidar cache: ${cacheError.message}`);
      }
    }
  }
  
  // Luego, eliminar las alertas
  print("\n--- Eliminando alertas ---");
  
  alertas.forEach((alert, idx) => {
    try {
      const result = alertsColl.deleteOne({ _id: alert._id });
      
      if (result.deletedCount === 1) {
        print(`✅ ${idx + 1}. Eliminada: CSCO - ID: ${alert._id}`);
        alertasEliminadas++;
      } else {
        print(`❌ ${idx + 1}. Error al eliminar: CSCO - ID: ${alert._id} (no se encontró)`);
        errores++;
      }
    } catch (error) {
      print(`❌ ${idx + 1}. Error al eliminar: CSCO - ID: ${alert._id}`);
      print(`   Error: ${error.message}`);
      errores++;
    }
  });
  
  // Advertencia sobre operations
  if (operationsEncontradas.length > 0) {
    print("\n⚠️ ADVERTENCIA: Estas alertas tenían operations asociadas:");
    operationsEncontradas.forEach((item) => {
      print(`  - Alert ID ${item.alertId}: ${item.operations.length} operation(s)`);
    });
    print("Las operations NO fueron eliminadas automáticamente.");
    print("Si necesitás eliminarlas también, hacelo manualmente o con otro script.");
  }
  
  print("\n=== 5) Resultado final ===");
  print(`Alertas eliminadas exitosamente: ${alertasEliminadas}`);
  print(`Distribuciones removidas: ${distribucionesRemovidas}`);
  print(`Errores: ${errores}`);
  print(`Total alertas procesadas: ${alertas.length}`);
  
  if (alertasEliminadas > 0) {
    print("\n✅ Las alertas de CSCO fueron eliminadas y la liquidez fue liberada.");
    print("El frontend debería mostrar los valores actualizados después de refrescar.");
  }
}

print("\n=== FIN DEL SCRIPT ===");
