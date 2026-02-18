/*******************************
 * CORREGIR CÁLCULO DE LIQUIDEZ
 * 
 * Recalcula y actualiza la liquidez disponible
 * según la fórmula correcta
 *******************************/

const DRY_RUN = false; // Cambiar a false para ejecutar la corrección

const liquidityColl = db.liquidity;
const alertsColl = db.getCollection("alerts");
const apiCacheColl = db.apicaches;

print("=== CORRECCIÓN DE CÁLCULO DE LIQUIDEZ ===\n");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura, no actualizará nada)" : "OFF (ACTUALIZARÁ la liquidez)"
});

/****************************************
 * 1) Obtener documento de liquidez
 ****************************************/
const liquidityDoc = liquidityColl.findOne({ pool: "TraderCall" });

if (!liquidityDoc) {
  print("❌ No se encontró documento de liquidez para TraderCall");
  quit();
}

print("\n=== 1) Estado actual ===");
print(`Liquidity ID: ${liquidityDoc._id}`);
print(`Initial Liquidity: $${(liquidityDoc.initialLiquidity || 0).toFixed(2)}`);
print(`Total Liquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
print(`Available Liquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
print(`Distributed Liquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);

/****************************************
 * 2) Recalcular según fórmula correcta
 ****************************************/
print("\n=== 2) Recalculando ===");

const distributions = liquidityDoc.distributions || [];
const initialLiquidity = liquidityDoc.initialLiquidity || 0;

// Calcular montos distribuidos (solo distribuciones activas con shares > 0)
let montosDistribuidos = 0;
let gananciasRealizadas = 0;
let gananciasNoRealizadas = 0;

distributions.forEach((d) => {
  const shares = d.shares || 0;
  const allocatedAmount = d.allocatedAmount || 0;
  const profitLoss = d.profitLoss || 0;
  const realizedProfitLoss = d.realizedProfitLoss || 0;
  const isActive = d.isActive !== false;
  
  // Montos distribuidos: solo distribuciones activas con shares > 0
  if (isActive && shares > 0) {
    montosDistribuidos += allocatedAmount;
    gananciasNoRealizadas += profitLoss;
  }
  
  // Ganancias realizadas: todas las distribuciones (incluye vendidas)
  gananciasRealizadas += realizedProfitLoss || 0;
});

// Calcular según fórmula: Disponible = Inicial - Distribuida + Ganancias Realizadas
const newTotalLiquidity = initialLiquidity + gananciasRealizadas + gananciasNoRealizadas;
const newAvailableLiquidity = initialLiquidity - montosDistribuidos + gananciasRealizadas;
const newDistributedLiquidity = montosDistribuidos;

print(`Montos distribuidos (activas con shares > 0): $${montosDistribuidos.toFixed(2)}`);
print(`Ganancias realizadas: $${gananciasRealizadas.toFixed(2)}`);
print(`Ganancias no realizadas: $${gananciasNoRealizadas.toFixed(2)}\n`);

print("Valores RECALCULADOS:");
print(`  Total Liquidity: $${newTotalLiquidity.toFixed(2)}`);
print(`  Available Liquidity: $${newAvailableLiquidity.toFixed(2)}`);
print(`  Distributed Liquidity: $${newDistributedLiquidity.toFixed(2)}\n`);

const diferenciaAvailable = newAvailableLiquidity - (liquidityDoc.availableLiquidity || 0);
const diferenciaDistributed = newDistributedLiquidity - (liquidityDoc.distributedLiquidity || 0);
const diferenciaTotal = newTotalLiquidity - (liquidityDoc.totalLiquidity || 0);

print("DIFERENCIAS:");
print(`  Available: ${diferenciaAvailable >= 0 ? '+' : ''}${diferenciaAvailable.toFixed(2)}`);
print(`  Distributed: ${diferenciaDistributed >= 0 ? '+' : ''}${diferenciaDistributed.toFixed(2)}`);
print(`  Total: ${diferenciaTotal >= 0 ? '+' : ''}${diferenciaTotal.toFixed(2)}\n`);

/****************************************
 * 3) Verificar si hay problemas
 ****************************************/
if (newAvailableLiquidity < 0) {
  print("⚠️ ADVERTENCIA: La liquidez disponible sería NEGATIVA.");
  print(`   Esto indica que se está distribuyendo más de lo disponible.`);
  print(`   Initial: $${initialLiquidity.toFixed(2)}`);
  print(`   Distributed: $${montosDistribuidos.toFixed(2)}`);
  print(`   Realized Gains: $${gananciasRealizadas.toFixed(2)}`);
  print(`   Available calculado: $${newAvailableLiquidity.toFixed(2)}\n`);
}

/****************************************
 * 4) Actualizar (si no es DRY_RUN)
 ****************************************/
if (DRY_RUN) {
  print("=== 3) DRY RUN - No se actualizará nada ===");
  print("Para ejecutar la corrección, cambiá DRY_RUN a false al inicio del script.");
} else {
  print("=== 3) ACTUALIZANDO LIQUIDEZ ===");
  print("⚠️ ADVERTENCIA: Se procederá a actualizar los valores de liquidez.");
  
  try {
    const result = liquidityColl.updateOne(
      { _id: liquidityDoc._id },
      {
        $set: {
          totalLiquidity: newTotalLiquidity,
          availableLiquidity: newAvailableLiquidity,
          distributedLiquidity: newDistributedLiquidity,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      print("✅ Liquidez actualizada exitosamente.");
      print("\nValores ACTUALIZADOS:");
      print(`  Total Liquidity: $${newTotalLiquidity.toFixed(2)}`);
      print(`  Available Liquidity: $${newAvailableLiquidity.toFixed(2)}`);
      print(`  Distributed Liquidity: $${newDistributedLiquidity.toFixed(2)}`);
      
      // Invalidar cache de liquidez para TraderCall
      print("\n=== 4) Invalidando cache ===");
      try {
        const pool = liquidityDoc.pool || "TraderCall";
        
        // Buscar y eliminar todas las entradas de cache relacionadas con liquidez de este pool
        // Las keys tienen keyParts.path que contiene '/api/liquidity/' y query.pool === pool
        const cacheResult = apiCacheColl.deleteMany({
          "keyParts.path": { $regex: "^/api/liquidity/" },
          "keyParts.query.pool": pool
        });
        
        print(`✅ Cache invalidado: ${cacheResult.deletedCount} entradas eliminadas para pool ${pool}`);
        print("El frontend debería mostrar los valores actualizados en la próxima solicitud.");
      } catch (cacheError) {
        print(`⚠️ Error al invalidar cache: ${cacheError.message}`);
        print("Podés invalidar el cache manualmente o esperar 60 segundos para que expire.");
      }
      
      if (newAvailableLiquidity < 0) {
        print("\n⚠️ IMPORTANTE: La liquidez disponible es NEGATIVA.");
        print("Esto puede indicar que:");
        print("  1. Hay distribuciones que no deberían estar activas");
        print("  2. Las ganancias realizadas no se están contabilizando correctamente");
        print("  3. Se necesita revisar las distribuciones individuales");
      }
    } else {
      print("⚠️ No se pudo actualizar (puede que los valores ya estén actualizados)");
    }
  } catch (error) {
    print(`❌ Error al actualizar: ${error.message}`);
  }
}

print("\n=== FIN DE CORRECCIÓN ===");
