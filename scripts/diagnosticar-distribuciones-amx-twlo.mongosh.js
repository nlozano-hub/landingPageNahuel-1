/*******************************
 * DIAGNÓSTICO DE DISTRIBUCIONES AMX Y TWLO
 * 
 * Busca distribuciones relacionadas con AMX y TWLO
 * para entender por qué no se encontraron distribuciones huérfanas
 *******************************/

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;

// Símbolos y precios de las alertas eliminadas
const ALERTAS_ELIMINADAS = [
  { symbol: "AMX", entryPrice: 20.70, alertId: "6970fe0a0d749f19c8a0e68c" },
  { symbol: "AMX", entryPrice: 21.02, alertId: "6977912caafb59b75147f39b" },
  { symbol: "TWLO", entryPrice: 129.53, alertId: "69738f55dd1f7ec60f6b6662" }
];

print("=== DIAGNÓSTICO DE DISTRIBUCIONES ===");
print("Buscando distribuciones relacionadas con AMX y TWLO\n");

/****************************************
 * 1) Buscar todas las distribuciones de AMX y TWLO
 ****************************************/
print("=== 1) Buscando distribuciones por símbolo ===");

const liquidityDocs = liquidityColl.find({}).toArray();
print(`Documentos de liquidez encontrados: ${liquidityDocs.length}\n`);

const distribucionesEncontradas = [];

liquidityDocs.forEach((liquidityDoc) => {
  const distributions = liquidityDoc.distributions || [];
  
  distributions.forEach((dist, distIndex) => {
    const symbol = (dist.symbol || "").toUpperCase();
    
    // Buscar distribuciones de AMX o TWLO
    if (symbol === "AMX" || symbol === "TWLO") {
      let distAlertId = null;
      if (dist.alertId) {
        distAlertId = typeof dist.alertId === 'string' ? dist.alertId : dist.alertId.toString();
      }
      
      // Verificar si la alerta existe
      let alertExists = false;
      let alertInfo = null;
      
      if (distAlertId) {
        try {
          const alert = alertsColl.findOne({ _id: ObjectId(distAlertId) });
          if (alert) {
            alertExists = true;
            alertInfo = {
              symbol: alert.symbol,
              entryPrice: alert.entryPrice,
              status: alert.status
            };
          }
        } catch (e) {
          try {
            const alert = alertsColl.findOne({ _id: distAlertId });
            if (alert) {
              alertExists = true;
              alertInfo = {
                symbol: alert.symbol,
                entryPrice: alert.entryPrice,
                status: alert.status
            };
            }
          } catch (e2) {
            // No existe
          }
        }
      }
      
      distribucionesEncontradas.push({
        liquidityId: liquidityDoc._id,
        pool: liquidityDoc.pool,
        symbol: symbol,
        alertId: distAlertId,
        alertExists: alertExists,
        alertInfo: alertInfo,
        entryPrice: dist.entryPrice || 0,
        allocatedAmount: dist.allocatedAmount || 0,
        shares: dist.shares || 0,
        isActive: dist.isActive !== false
      });
      
      print(`\nDistribución encontrada:`);
      print(`  Liquidity ID: ${liquidityDoc._id}`);
      print(`  Pool: ${liquidityDoc.pool}`);
      print(`  Symbol: ${symbol}`);
      print(`  Alert ID: ${distAlertId || "N/A"}`);
      print(`  Alert existe: ${alertExists ? "✅ SÍ" : "❌ NO"}`);
      if (alertInfo) {
        print(`  Alert info: ${alertInfo.symbol} - Entry: ${alertInfo.entryPrice} - Status: ${alertInfo.status}`);
      }
      print(`  Entry Price (dist): $${(dist.entryPrice || 0).toFixed(2)}`);
      print(`  Allocated Amount: $${(dist.allocatedAmount || 0).toFixed(2)}`);
      print(`  Shares: ${(dist.shares || 0).toFixed(6)}`);
      print(`  Is Active: ${dist.isActive !== false}`);
    }
  });
});

print(`\nTotal distribuciones de AMX/TWLO encontradas: ${distribucionesEncontradas.length}`);

/****************************************
 * 2) Buscar alertas activas de AMX y TWLO
 ****************************************/
print("\n=== 2) Buscando alertas activas de AMX y TWLO ===");

const alertasAMX = alertsColl.find({ symbol: "AMX" }).toArray();
const alertasTWLO = alertsColl.find({ symbol: "TWLO" }).toArray();

print(`Alertas AMX encontradas: ${alertasAMX.length}`);
alertasAMX.forEach((alert, idx) => {
  print(`  ${idx + 1}. ID: ${alert._id} - Entry: ${alert.entryPrice || "N/A"} - Status: ${alert.status}`);
});

print(`\nAlertas TWLO encontradas: ${alertasTWLO.length}`);
alertasTWLO.forEach((alert, idx) => {
  print(`  ${idx + 1}. ID: ${alert._id} - Entry: ${alert.entryPrice || "N/A"} - Status: ${alert.status}`);
});

/****************************************
 * 3) Verificar si hay distribuciones que coincidan con los precios eliminados
 ****************************************/
print("\n=== 3) Verificando coincidencias con precios eliminados ===");

ALERTAS_ELIMINADAS.forEach((alertaEliminada) => {
  print(`\nBuscando distribuciones para ${alertaEliminada.symbol} con entryPrice ${alertaEliminada.entryPrice}:`);
  
  const distribucionesCoincidentes = distribucionesEncontradas.filter((dist) => {
    return dist.symbol === alertaEliminada.symbol && 
           Math.abs((dist.entryPrice || 0) - alertaEliminada.entryPrice) < 0.01;
  });
  
  if (distribucionesCoincidentes.length > 0) {
    print(`  ✅ Encontradas ${distribucionesCoincidentes.length} distribución(es) coincidente(s):`);
    distribucionesCoincidentes.forEach((dist, idx) => {
      print(`     ${idx + 1}. Alert ID: ${dist.alertId || "N/A"} - Amount: $${dist.allocatedAmount.toFixed(2)}`);
      print(`        Alert existe: ${dist.alertExists ? "SÍ" : "NO"}`);
    });
  } else {
    print(`  ❌ No se encontraron distribuciones con ese precio`);
  }
});

/****************************************
 * 4) Verificar estado de liquidez actual
 ****************************************/
print("\n=== 4) Estado actual de liquidez ===");

liquidityDocs.forEach((liquidityDoc) => {
  print(`\nPool: ${liquidityDoc.pool}`);
  print(`  Liquidity ID: ${liquidityDoc._id}`);
  print(`  Initial Liquidity: $${(liquidityDoc.initialLiquidity || 0).toFixed(2)}`);
  print(`  Total Liquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
  print(`  Available Liquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
  print(`  Distributed Liquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);
  print(`  Total distribuciones: ${(liquidityDoc.distributions || []).length}`);
  
  // Contar distribuciones activas
  const activas = (liquidityDoc.distributions || []).filter(
    d => d.isActive !== false && (d.shares || 0) > 0
  ).length;
  print(`  Distribuciones activas (con shares > 0): ${activas}`);
});

/****************************************
 * 5) Resumen y conclusiones
 ****************************************/
print("\n=== 5) RESUMEN ===");

const distribucionesHuerfanas = distribucionesEncontradas.filter(d => !d.alertExists);
const distribucionesValidas = distribucionesEncontradas.filter(d => d.alertExists);

print(`Total distribuciones de AMX/TWLO: ${distribucionesEncontradas.length}`);
print(`  - Con alerta existente: ${distribucionesValidas.length}`);
print(`  - Sin alerta (huérfanas): ${distribucionesHuerfanas.length}`);

if (distribucionesHuerfanas.length > 0) {
  print("\n⚠️ DISTRIBUCIONES HUÉRFANAS ENCONTRADAS:");
  distribucionesHuerfanas.forEach((dist, idx) => {
    print(`  ${idx + 1}. ${dist.symbol} - Alert ID: ${dist.alertId || "N/A"} - Amount: $${dist.allocatedAmount.toFixed(2)}`);
  });
  print("\nEstas distribuciones deberían ser removidas para liberar liquidez.");
} else {
  print("\n✅ No se encontraron distribuciones huérfanas.");
  print("Esto significa que:");
  print("  1. Las alertas nunca tuvieron distribuciones creadas, O");
  print("  2. Las distribuciones fueron removidas previamente, O");
  print("  3. Las distribuciones tienen alertIds diferentes a los esperados");
}

print("\n=== FIN DEL DIAGNÓSTICO ===");
