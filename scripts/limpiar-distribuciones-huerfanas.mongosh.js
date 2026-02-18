/*******************************
 * LIMPIAR DISTRIBUCIONES HUÉRFANAS
 * 
 * Busca distribuciones de liquidez que apuntan a alertas eliminadas
 * y las remueve, recalculando la liquidez disponible.
 * 
 * Específicamente busca las alertas eliminadas:
 * - AMX 20.70 (ID: 6970fe0a0d749f19c8a0e68c)
 * - AMX 21.02 (ID: 6977912caafb59b75147f39b)
 * - TWLO 129.53 (ID: 69738f55dd1f7ec60f6b6662)
 *******************************/

const DRY_RUN = false; // Cambiar a false para ejecutar la limpieza

// IDs de las alertas eliminadas
const ALERT_IDS_ELIMINADAS = [
  "6970fe0a0d749f19c8a0e68c", // AMX 20.70
  "6977912caafb59b75147f39b", // AMX 21.02
  "69738f55dd1f7ec60f6b6662"  // TWLO 129.53
];

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura, no eliminará nada)" : "OFF (LIMPIARÁ distribuciones huérfanas)",
  alertIdsEliminadas: ALERT_IDS_ELIMINADAS
});

/****************************************
 * 1) Verificar que las alertas no existen
 ****************************************/
print("\n=== 1) Verificando que las alertas fueron eliminadas ===");

const alertasExistentes = [];

ALERT_IDS_ELIMINADAS.forEach((alertId) => {
  let alert = null;
  try {
    alert = alertsColl.findOne({ _id: ObjectId(alertId) });
  } catch (e) {
    // Intentar como string también
    alert = alertsColl.findOne({ _id: alertId });
  }
  
  if (alert) {
    alertasExistentes.push({
      _id: alertId,
      symbol: alert.symbol,
      status: alert.status
    });
    print(`⚠️ Alerta ${alertId} todavía existe: ${alert.symbol} - Status: ${alert.status}`);
  } else {
    print(`✅ Alerta ${alertId} no existe (fue eliminada)`);
  }
});

if (alertasExistentes.length > 0) {
  print(`\n⚠️ ADVERTENCIA: ${alertasExistentes.length} alerta(s) todavía existen.`);
  print("Este script está diseñado para limpiar distribuciones de alertas eliminadas.");
  quit();
}

/****************************************
 * 2) Buscar distribuciones huérfanas
 ****************************************/
print("\n=== 2) Buscando distribuciones huérfanas ===");

const distribucionesHuerfanas = [];

// Buscar en todos los documentos de liquidez
const liquidityDocs = liquidityColl.find({}).toArray();

print(`Documentos de liquidez encontrados: ${liquidityDocs.length}`);

liquidityDocs.forEach((liquidityDoc) => {
  const distributions = liquidityDoc.distributions || [];
  
  distributions.forEach((dist, distIndex) => {
    // Manejar alertId como string u ObjectId
    let distAlertId = null;
    if (dist.alertId) {
      distAlertId = typeof dist.alertId === 'string' ? dist.alertId : dist.alertId.toString();
    }
    
    // Verificar si esta distribución apunta a una alerta eliminada
    if (distAlertId && ALERT_IDS_ELIMINADAS.includes(distAlertId)) {
      // Verificar que la alerta realmente no existe
      let alertExists = null;
      try {
        alertExists = alertsColl.findOne({ _id: ObjectId(distAlertId) });
      } catch (e) {
        alertExists = alertsColl.findOne({ _id: distAlertId });
      }
      
      if (!alertExists) {
        distribucionesHuerfanas.push({
          liquidityId: liquidityDoc._id,
          pool: liquidityDoc.pool,
          alertId: distAlertId,
          symbol: dist.symbol || "N/A",
          distributionIndex: distIndex,
          allocatedAmount: dist.allocatedAmount || 0,
          shares: dist.shares || 0,
          entryPrice: dist.entryPrice || 0,
          currentPrice: dist.currentPrice || 0,
          profitLoss: dist.profitLoss || 0,
          realizedProfitLoss: dist.realizedProfitLoss || 0,
          isActive: dist.isActive !== false
        });
        
        print(`\n  Distribución huérfana encontrada:`);
        print(`     Liquidity ID: ${liquidityDoc._id}`);
        print(`     Pool: ${liquidityDoc.pool}`);
        print(`     Alert ID: ${distAlertId}`);
        print(`     Symbol: ${dist.symbol || "N/A"}`);
        print(`     Allocated Amount: $${(dist.allocatedAmount || 0).toFixed(2)}`);
        print(`     Shares: ${(dist.shares || 0).toFixed(6)}`);
        print(`     Entry Price: $${(dist.entryPrice || 0).toFixed(2)}`);
        print(`     Current Price: $${(dist.currentPrice || 0).toFixed(2)}`);
        print(`     Profit/Loss: $${(dist.profitLoss || 0).toFixed(2)}`);
        print(`     Realized P/L: $${(dist.realizedProfitLoss || 0).toFixed(2)}`);
        print(`     Is Active: ${dist.isActive !== false}`);
      }
    }
  });
});

print(`\nTotal distribuciones huérfanas encontradas: ${distribucionesHuerfanas.length}`);

if (distribucionesHuerfanas.length === 0) {
  print("✅ No se encontraron distribuciones huérfanas.");
  print("Las distribuciones pueden haber sido removidas previamente o nunca existieron.");
  quit();
}

/****************************************
 * 3) Mostrar resumen y estado actual de liquidez
 ****************************************/
print("\n=== 3) Estado actual de liquidez ===");

const liquidityPorPool = {};

distribucionesHuerfanas.forEach((dist) => {
  const pool = dist.pool;
  if (!liquidityPorPool[pool]) {
    liquidityPorPool[pool] = {
      liquidityId: dist.liquidityId,
      distribuciones: []
    };
  }
  liquidityPorPool[pool].distribuciones.push(dist);
});

Object.keys(liquidityPorPool).forEach((pool) => {
  const grupo = liquidityPorPool[pool];
  const liquidityDoc = liquidityColl.findOne({ _id: grupo.liquidityId });
  
  if (liquidityDoc) {
    print(`\nPool: ${pool}`);
    print(`  Liquidity ID: ${grupo.liquidityId}`);
    print(`  Initial Liquidity: $${(liquidityDoc.initialLiquidity || 0).toFixed(2)}`);
    print(`  Total Liquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
    print(`  Available Liquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
    print(`  Distributed Liquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);
    print(`  Distribuciones huérfanas en este pool: ${grupo.distribuciones.length}`);
    
    const totalAllocatedHuerfanas = grupo.distribuciones.reduce(
      (sum, d) => sum + (d.allocatedAmount || 0),
      0
    );
    print(`  Total allocated en distribuciones huérfanas: $${totalAllocatedHuerfanas.toFixed(2)}`);
  }
});

/****************************************
 * 4) Limpiar distribuciones huérfanas (si no es DRY_RUN)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 4) DRY RUN - No se eliminará nada ===");
  print("Para ejecutar la limpieza, cambiá DRY_RUN a false al inicio del script.");
  print("\nDistribuciones que se removerían:");
  distribucionesHuerfanas.forEach((dist, idx) => {
    print(`  ${idx + 1}. ${dist.symbol} - Pool: ${dist.pool} - Amount: $${dist.allocatedAmount.toFixed(2)}`);
  });
} else {
  print("\n=== 4) LIMPIANDO DISTRIBUCIONES HUÉRFANAS ===");
  print("⚠️ ADVERTENCIA: Se procederá a remover las distribuciones huérfanas.");
  
  let distribucionesRemovidas = 0;
  let errores = 0;
  
  // Agrupar por liquidityId para procesar cada documento una vez
  const distribucionesPorLiquidity = {};
  
  distribucionesHuerfanas.forEach((dist) => {
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
      
      // Remover cada distribución huérfana
      grupo.distributions.forEach((dist) => {
        const alertIdStr = dist.alertId;
        
        // Remover la distribución del array usando $pull
        // Intentar con string primero, luego con ObjectId si es necesario
        let result = liquidityColl.updateOne(
          { _id: grupo.liquidityId },
          {
            $pull: {
              distributions: { alertId: alertIdStr }
            }
          }
        );
        
        // Si no funcionó, intentar con ObjectId
        if (result.modifiedCount === 0) {
          try {
            result = liquidityColl.updateOne(
              { _id: grupo.liquidityId },
              {
                $pull: {
                  distributions: { alertId: ObjectId(alertIdStr) }
                }
              }
            );
          } catch (e) {
            // Si falla, continuar
          }
        }
        
        if (result.modifiedCount > 0) {
          print(`  ✅ Distribución removida para ${dist.symbol} (Alert ID: ${alertIdStr})`);
          distribucionesRemovidas++;
        } else {
          print(`  ⚠️ No se pudo remover distribución para ${dist.symbol} (puede que ya no exista)`);
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
      
      // Mostrar cambios
      const oldAvailable = updatedLiquidity.availableLiquidity || 0;
      const oldDistributed = updatedLiquidity.distributedLiquidity || 0;
      
      print(`\n  Estado ANTES de la limpieza:`);
      print(`     Available: $${oldAvailable.toFixed(2)}`);
      print(`     Distributed: $${oldDistributed.toFixed(2)}`);
      
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
      
      print(`\n  Estado DESPUÉS de la limpieza:`);
      print(`     Total: $${newTotalLiquidity.toFixed(2)}`);
      print(`     Available: $${newAvailableLiquidity.toFixed(2)} (${newAvailableLiquidity > oldAvailable ? '+' : ''}${(newAvailableLiquidity - oldAvailable).toFixed(2)})`);
      print(`     Distributed: $${montosDistribuidos.toFixed(2)} (${montosDistribuidos < oldDistributed ? '-' : '+'}${(montosDistribuidos - oldDistributed).toFixed(2)})`);
      
    } catch (error) {
      print(`  ❌ Error procesando liquidez ${grupo.liquidityId}: ${error.message}`);
      errores++;
    }
  });
  
  print("\n=== 5) Resultado final ===");
  print(`Distribuciones removidas exitosamente: ${distribucionesRemovidas}`);
  print(`Errores: ${errores}`);
  print(`Total distribuciones procesadas: ${distribucionesHuerfanas.length}`);
  
  if (distribucionesRemovidas > 0) {
    print("\n✅ La liquidez disponible debería haberse actualizado correctamente.");
    print("Verificá los valores en el dashboard de admin para confirmar.");
  }
}

print("\n=== FIN DEL SCRIPT ===");
