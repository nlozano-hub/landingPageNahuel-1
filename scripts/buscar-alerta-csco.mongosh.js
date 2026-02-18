/*******************************
 * BUSCAR ALERTA CSCO
 * 
 * Busca alertas de CSCO en la base de datos
 *******************************/

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;
const opsColl = db.getCollection("operations");

const SYMBOL = "CSCO";

print("=== BÚSQUEDA DE ALERTA CSCO ===\n");

/****************************************
 * 1) Buscar alertas de CSCO
 ****************************************/
print("=== 1) Buscando alertas de CSCO ===");

const alertas = alertsColl.find({ symbol: SYMBOL }).toArray();

print(`Total alertas encontradas: ${alertas.length}\n`);

if (alertas.length === 0) {
  print("❌ No se encontraron alertas de CSCO en la base de datos.");
  quit();
}

alertas.forEach((alert, idx) => {
  print(`\n--- Alerta ${idx + 1} ---`);
  print(`ID: ${alert._id}`);
  print(`Symbol: ${alert.symbol}`);
  print(`Status: ${alert.status}`);
  print(`Action: ${alert.action || "N/A"}`);
  print(`Entry Price: ${alert.entryPrice ? `$${alert.entryPrice.toFixed(2)}` : "N/A"}`);
  if (alert.entryPriceRange) {
    print(`Entry Price Range: $${alert.entryPriceRange.min.toFixed(2)} - $${alert.entryPriceRange.max.toFixed(2)}`);
  }
  print(`Current Price: $${(alert.currentPrice || 0).toFixed(2)}`);
  print(`Stop Loss: $${(alert.stopLoss || 0).toFixed(2)}`);
  print(`Take Profit: $${(alert.takeProfit || 0).toFixed(2)}`);
  print(`Profit: ${(alert.profit || 0).toFixed(2)}%`);
  print(`Tipo: ${alert.tipo || "N/A"}`);
  print(`Created At: ${alert.createdAt || "N/A"}`);
  print(`Updated At: ${alert.updatedAt || "N/A"}`);
  
  if (alert.exitPrice) {
    print(`Exit Price: $${alert.exitPrice.toFixed(2)}`);
  }
  if (alert.exitDate) {
    print(`Exit Date: ${alert.exitDate}`);
  }
  if (alert.exitReason) {
    print(`Exit Reason: ${alert.exitReason}`);
  }
  
  if (alert.liquidityPercentage) {
    print(`Liquidity Percentage: ${alert.liquidityPercentage}%`);
  }
  if (alert.participationPercentage) {
    print(`Participation Percentage: ${alert.participationPercentage}%`);
  }
  
  if (alert.liquidityData) {
    print(`\nLiquidityData:`);
    print(`  Shares: ${(alert.liquidityData.shares || 0).toFixed(6)}`);
    print(`  Allocated Amount: $${(alert.liquidityData.allocatedAmount || 0).toFixed(2)}`);
    print(`  Original Shares: ${(alert.liquidityData.originalShares || 0).toFixed(6)}`);
    print(`  Original Allocated: $${(alert.liquidityData.originalAllocatedAmount || 0).toFixed(2)}`);
    
    if (alert.liquidityData.partialSales && alert.liquidityData.partialSales.length > 0) {
      print(`  Partial Sales: ${alert.liquidityData.partialSales.length}`);
      alert.liquidityData.partialSales.forEach((sale, saleIdx) => {
        print(`    Venta ${saleIdx + 1}: ${sale.executed ? "✅ Ejecutada" : "⏳ Pendiente"} - ${sale.percentage || 0}%`);
      });
    }
  }
});

/****************************************
 * 2) Buscar distribuciones de liquidez
 ****************************************/
print("\n=== 2) Buscando distribuciones de liquidez ===");

const liquidityDoc = liquidityColl.findOne({ pool: "TraderCall" });

if (liquidityDoc) {
  const distributions = liquidityDoc.distributions || [];
  
  alertas.forEach((alert) => {
    const alertIdStr = alert._id.toString();
    
    const distribution = distributions.find((d) => {
      const distAlertId = d.alertId ? (typeof d.alertId === 'string' ? d.alertId : d.alertId.toString()) : null;
      return distAlertId === alertIdStr;
    });
    
    if (distribution) {
      print(`\nAlerta ${alert._id}:`);
      print(`  ✅ Tiene distribución en Liquidity:`);
      print(`     Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
      print(`     Shares: ${(distribution.shares || 0).toFixed(6)}`);
      print(`     Sold Shares: ${(distribution.soldShares || 0).toFixed(6)}`);
      print(`     Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}`);
      print(`     Current Price: $${(distribution.currentPrice || 0).toFixed(2)}`);
      print(`     Profit/Loss: $${(distribution.profitLoss || 0).toFixed(2)}`);
      print(`     Realized P/L: $${(distribution.realizedProfitLoss || 0).toFixed(2)}`);
      print(`     Is Active: ${distribution.isActive !== false}`);
    } else {
      print(`\nAlerta ${alert._id}:`);
      print(`  ❌ NO tiene distribución en Liquidity`);
    }
  });
} else {
  print("⚠️ No se encontró documento de liquidez para TraderCall");
}

/****************************************
 * 3) Buscar operations relacionadas
 ****************************************/
print("\n=== 3) Buscando operations relacionadas ===");

alertas.forEach((alert) => {
  const ops = opsColl.find({ alertId: alert._id }).toArray();
  
  if (ops.length > 0) {
    print(`\nAlerta ${alert._id}:`);
    print(`  Operations encontradas: ${ops.length}`);
    
    ops.forEach((op, idx) => {
      print(`    ${idx + 1}. Type: ${op.operationType} - Status: ${op.status} - Amount: $${Math.abs(op.amount || 0).toFixed(2)}`);
    });
  } else {
    print(`\nAlerta ${alert._id}:`);
    print(`  No tiene operations relacionadas`);
  }
});

print("\n=== FIN DE BÚSQUEDA ===");
