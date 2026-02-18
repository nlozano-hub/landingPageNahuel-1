/*******************************
 * VERIFICAR CÁLCULO DE LIQUIDEZ
 * 
 * Verifica cómo se está calculando la liquidez disponible
 * y compara con los valores esperados
 *******************************/

const liquidityColl = db.liquidity;
const alertsColl = db.getCollection("alerts");

print("=== VERIFICACIÓN DE CÁLCULO DE LIQUIDEZ ===\n");

/****************************************
 * 1) Obtener documento de liquidez
 ****************************************/
const liquidityDoc = liquidityColl.findOne({ pool: "TraderCall" });

if (!liquidityDoc) {
  print("❌ No se encontró documento de liquidez para TraderCall");
  quit();
}

print("=== 1) Estado actual del documento ===");
print(`Liquidity ID: ${liquidityDoc._id}`);
print(`Initial Liquidity: $${(liquidityDoc.initialLiquidity || 0).toFixed(2)}`);
print(`Total Liquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
print(`Available Liquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
print(`Distributed Liquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);
print(`Total distribuciones: ${(liquidityDoc.distributions || []).length}\n`);

/****************************************
 * 2) Recalcular según la fórmula correcta
 ****************************************/
print("=== 2) Recalculando según fórmula correcta ===");

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

print("Valores ACTUALES en BD:");
print(`  Total Liquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
print(`  Available Liquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
print(`  Distributed Liquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}\n`);

const diferenciaAvailable = newAvailableLiquidity - (liquidityDoc.availableLiquidity || 0);
const diferenciaDistributed = newDistributedLiquidity - (liquidityDoc.distributedLiquidity || 0);
const diferenciaTotal = newTotalLiquidity - (liquidityDoc.totalLiquidity || 0);

print("DIFERENCIAS:");
print(`  Available: ${diferenciaAvailable >= 0 ? '+' : ''}${diferenciaAvailable.toFixed(2)}`);
print(`  Distributed: ${diferenciaDistributed >= 0 ? '+' : ''}${diferenciaDistributed.toFixed(2)}`);
print(`  Total: ${diferenciaTotal >= 0 ? '+' : ''}${diferenciaTotal.toFixed(2)}\n`);

/****************************************
 * 3) Analizar distribuciones en detalle
 ****************************************/
print("=== 3) Análisis detallado de distribuciones ===");

let distribucionesActivas = 0;
let distribucionesInactivas = 0;
let distribucionesConSharesCero = 0;
let totalAllocatedActivas = 0;
let totalAllocatedInactivas = 0;

distributions.forEach((d, idx) => {
  const shares = d.shares || 0;
  const allocatedAmount = d.allocatedAmount || 0;
  const isActive = d.isActive !== false;
  const alertId = d.alertId ? (typeof d.alertId === 'string' ? d.alertId : d.alertId.toString()) : null;
  
  // Verificar si la alerta existe
  let alertExists = false;
  if (alertId) {
    try {
      const alert = alertsColl.findOne({ _id: ObjectId(alertId) });
      alertExists = !!alert;
    } catch (e) {
      try {
        const alert = alertsColl.findOne({ _id: alertId });
        alertExists = !!alert;
      } catch (e2) {
        // No existe
      }
    }
  }
  
  if (isActive && shares > 0) {
    distribucionesActivas++;
    totalAllocatedActivas += allocatedAmount;
  } else if (!isActive) {
    distribucionesInactivas++;
    totalAllocatedInactivas += allocatedAmount;
  } else if (shares === 0) {
    distribucionesConSharesCero++;
  }
  
  if (idx < 5 || !alertExists || (!isActive && allocatedAmount > 0)) {
    print(`\nDistribución ${idx + 1}:`);
    print(`  Symbol: ${d.symbol || "N/A"}`);
    print(`  Alert ID: ${alertId || "N/A"}`);
    print(`  Alert existe: ${alertExists ? "✅" : "❌"}`);
    print(`  Is Active: ${isActive}`);
    print(`  Shares: ${shares.toFixed(6)}`);
    print(`  Allocated Amount: $${allocatedAmount.toFixed(2)}`);
    print(`  Profit/Loss: $${(d.profitLoss || 0).toFixed(2)}`);
    print(`  Realized P/L: $${(d.realizedProfitLoss || 0).toFixed(2)}`);
  }
});

print(`\nResumen de distribuciones:`);
print(`  Activas (isActive=true, shares>0): ${distribucionesActivas} - Total allocated: $${totalAllocatedActivas.toFixed(2)}`);
print(`  Inactivas (isActive=false): ${distribucionesInactivas} - Total allocated: $${totalAllocatedInactivas.toFixed(2)}`);
print(`  Con shares=0: ${distribucionesConSharesCero}`);

/****************************************
 * 4) Verificar si hay distribuciones huérfanas
 ****************************************/
print("\n=== 4) Verificando distribuciones huérfanas ===");

const distribucionesHuerfanas = [];

distributions.forEach((d) => {
  const alertId = d.alertId ? (typeof d.alertId === 'string' ? d.alertId : d.alertId.toString()) : null;
  
  if (alertId) {
    let alertExists = false;
    try {
      const alert = alertsColl.findOne({ _id: ObjectId(alertId) });
      alertExists = !!alert;
    } catch (e) {
      try {
        const alert = alertsColl.findOne({ _id: alertId });
        alertExists = !!alert;
      } catch (e2) {
        // No existe
      }
    }
    
    if (!alertExists && (d.shares || 0) > 0) {
      distribucionesHuerfanas.push({
        symbol: d.symbol,
        alertId: alertId,
        allocatedAmount: d.allocatedAmount || 0,
        shares: d.shares || 0
      });
    }
  }
});

if (distribucionesHuerfanas.length > 0) {
  print(`⚠️ Encontradas ${distribucionesHuerfanas.length} distribuciones huérfanas (sin alerta):`);
  distribucionesHuerfanas.forEach((dist, idx) => {
    print(`  ${idx + 1}. ${dist.symbol} - Alert ID: ${dist.alertId} - Amount: $${dist.allocatedAmount.toFixed(2)} - Shares: ${dist.shares.toFixed(6)}`);
  });
} else {
  print("✅ No se encontraron distribuciones huérfanas");
}

/****************************************
 * 5) Recomendaciones
 ****************************************/
print("\n=== 5) RECOMENDACIONES ===");

if (Math.abs(diferenciaAvailable) > 0.01) {
  print(`⚠️ La liquidez disponible está desactualizada.`);
  print(`   Diferencia: $${Math.abs(diferenciaAvailable).toFixed(2)}`);
  print(`   Se recomienda ejecutar el recálculo.`);
}

if (distribucionesHuerfanas.length > 0) {
  print(`⚠️ Hay ${distribucionesHuerfanas.length} distribución(es) huérfana(s) que deberían removerse.`);
}

print("\n=== FIN DE VERIFICACIÓN ===");
