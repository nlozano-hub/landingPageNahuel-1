/*******************************
 * VERIFICAR LIBERACIÓN DE LIQUIDEZ TRX E INTC
 * 
 * Verifica si las alertas de TRX e INTC liberaron
 * toda su liquidez correctamente
 *******************************/

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;
const opsColl = db.getCollection("operations");

const SYMBOLS = ["TRX", "INTC"];

print("=== VERIFICACIÓN DE LIBERACIÓN DE LIQUIDEZ ===\n");
print(`Símbolos a verificar: ${SYMBOLS.join(", ")}\n`);

/****************************************
 * 1) Buscar alertas de TRX e INTC
 ****************************************/
print("=== 1) Buscando alertas ===");

const alertasEncontradas = [];

SYMBOLS.forEach((symbol) => {
  const alertas = alertsColl.find({ symbol: symbol }).toArray();
  
  print(`\n${symbol}:`);
  print(`  Total alertas encontradas: ${alertas.length}`);
  
  alertas.forEach((alert, idx) => {
    const alertInfo = {
      _id: alert._id,
      symbol: alert.symbol,
      status: alert.status,
      entryPrice: alert.entryPrice,
      currentPrice: alert.currentPrice,
      exitPrice: alert.exitPrice,
      exitDate: alert.exitDate,
      exitReason: alert.exitReason,
      liquidityPercentage: alert.liquidityPercentage || 0,
      participationPercentage: alert.participationPercentage || 0,
      liquidityData: alert.liquidityData || {}
    };
    
    alertasEncontradas.push(alertInfo);
    
    print(`\n  Alerta ${idx + 1}:`);
    print(`    ID: ${alert._id}`);
    print(`    Status: ${alert.status}`);
    print(`    Entry Price: $${(alert.entryPrice || 0).toFixed(2)}`);
    print(`    Current Price: $${(alert.currentPrice || 0).toFixed(2)}`);
    print(`    Exit Price: ${alert.exitPrice ? `$${alert.exitPrice.toFixed(2)}` : "N/A"}`);
    print(`    Exit Date: ${alert.exitDate || "N/A"}`);
    print(`    Exit Reason: ${alert.exitReason || "N/A"}`);
    print(`    Liquidity %: ${alert.liquidityPercentage || 0}%`);
    print(`    Participation %: ${alert.participationPercentage || 0}%`);
    
    if (alert.liquidityData) {
      print(`    LiquidityData:`);
      print(`      Shares: ${(alert.liquidityData.shares || 0).toFixed(6)}`);
      print(`      Allocated Amount: $${(alert.liquidityData.allocatedAmount || 0).toFixed(2)}`);
      print(`      Original Shares: ${(alert.liquidityData.originalShares || 0).toFixed(6)}`);
      print(`      Original Allocated: $${(alert.liquidityData.originalAllocatedAmount || 0).toFixed(2)}`);
      
      if (alert.liquidityData.partialSales && alert.liquidityData.partialSales.length > 0) {
        print(`      Partial Sales: ${alert.liquidityData.partialSales.length}`);
        alert.liquidityData.partialSales.forEach((sale, saleIdx) => {
          print(`        Venta ${saleIdx + 1}: ${sale.executed ? "✅ Ejecutada" : "⏳ Pendiente"} - ${sale.percentage || 0}% - Shares: ${(sale.sharesToSell || 0).toFixed(6)}`);
        });
      }
    }
  });
});

if (alertasEncontradas.length === 0) {
  print("\n⚠️ No se encontraron alertas para estos símbolos.");
  quit();
}

/****************************************
 * 2) Buscar distribuciones de liquidez
 ****************************************/
print("\n=== 2) Buscando distribuciones de liquidez ===");

const liquidityDoc = liquidityColl.findOne({ pool: "TraderCall" });

if (!liquidityDoc) {
  print("❌ No se encontró documento de liquidez para TraderCall");
  quit();
}

const distributions = liquidityDoc.distributions || [];
const distribucionesEncontradas = [];

alertasEncontradas.forEach((alert) => {
  const alertIdStr = alert._id.toString();
  
  const distribution = distributions.find((d) => {
    const distAlertId = d.alertId ? (typeof d.alertId === 'string' ? d.alertId : d.alertId.toString()) : null;
    return distAlertId === alertIdStr;
  });
  
  if (distribution) {
    distribucionesEncontradas.push({
      alert: alert,
      distribution: {
        symbol: distribution.symbol,
        allocatedAmount: distribution.allocatedAmount || 0,
        shares: distribution.shares || 0,
        entryPrice: distribution.entryPrice || 0,
        currentPrice: distribution.currentPrice || 0,
        profitLoss: distribution.profitLoss || 0,
        realizedProfitLoss: distribution.realizedProfitLoss || 0,
        soldShares: distribution.soldShares || 0,
        isActive: distribution.isActive !== false
      }
    });
    
    print(`\n${alert.symbol} (Alert ID: ${alertIdStr}):`);
    print(`  Distribución encontrada:`);
    print(`    Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
    print(`    Shares: ${(distribution.shares || 0).toFixed(6)}`);
    print(`    Sold Shares: ${(distribution.soldShares || 0).toFixed(6)}`);
    print(`    Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}`);
    print(`    Current Price: $${(distribution.currentPrice || 0).toFixed(2)}`);
    print(`    Profit/Loss: $${(distribution.profitLoss || 0).toFixed(2)}`);
    print(`    Realized P/L: $${(distribution.realizedProfitLoss || 0).toFixed(2)}`);
    print(`    Is Active: ${distribution.isActive !== false}`);
    
    // Verificar si está completamente vendida
    const totalShares = (distribution.shares || 0) + (distribution.soldShares || 0);
    const sharesRestantes = distribution.shares || 0;
    const porcentajeVendido = totalShares > 0 ? ((distribution.soldShares || 0) / totalShares) * 100 : 0;
    
    print(`\n  Análisis:`);
    print(`    Total shares (shares + soldShares): ${totalShares.toFixed(6)}`);
    print(`    Shares restantes: ${sharesRestantes.toFixed(6)}`);
    print(`    Porcentaje vendido: ${porcentajeVendido.toFixed(2)}%`);
    
    if (sharesRestantes <= 0.000001) {
      print(`    ✅ COMPLETAMENTE VENDIDA - Shares restantes: 0`);
    } else if (porcentajeVendido >= 99.9) {
      print(`    ⚠️ Casi completamente vendida (${porcentajeVendido.toFixed(2)}%)`);
    } else {
      print(`    ⚠️ AÚN TIENE POSICIÓN - Shares restantes: ${sharesRestantes.toFixed(6)}`);
    }
    
    // Verificar si debería estar inactiva
    if (sharesRestantes <= 0.000001 && distribution.isActive !== false) {
      print(`    ⚠️ PROBLEMA: Está completamente vendida pero isActive = true`);
      print(`       Debería estar inactiva (isActive = false)`);
    }
    
    // Verificar si la liquidez debería haberse liberado
    if (sharesRestantes <= 0.000001) {
      const liquidezQueDeberiaLiberarse = distribution.allocatedAmount || 0;
      print(`    💰 Liquidez que debería haberse liberado: $${liquidezQueDeberiaLiberarse.toFixed(2)}`);
    }
  } else {
    print(`\n${alert.symbol} (Alert ID: ${alertIdStr}):`);
    print(`  ❌ NO tiene distribución en Liquidity`);
  }
});

/****************************************
 * 3) Verificar operations relacionadas
 ****************************************/
print("\n=== 3) Verificando operations relacionadas ===");

alertasEncontradas.forEach((alert) => {
  const ops = opsColl.find({ alertId: alert._id }).toArray();
  
  if (ops.length > 0) {
    print(`\n${alert.symbol} (Alert ID: ${alert._id}):`);
    print(`  Operations encontradas: ${ops.length}`);
    
    let totalCompras = 0;
    let totalVentas = 0;
    
    ops.forEach((op, idx) => {
      const amount = Math.abs(op.amount || 0);
      print(`    ${idx + 1}. Type: ${op.operationType} - Status: ${op.status} - Amount: $${amount.toFixed(2)}`);
      
      if (op.operationType === "COMPRA") {
        totalCompras += amount;
      } else if (op.operationType === "VENTA") {
        totalVentas += amount;
      }
    });
    
    print(`  Resumen:`);
    print(`    Total compras: $${totalCompras.toFixed(2)}`);
    print(`    Total ventas: $${totalVentas.toFixed(2)}`);
    print(`    Diferencia: $${(totalCompras - totalVentas).toFixed(2)}`);
  }
});

/****************************************
 * 4) Resumen y conclusiones
 ****************************************/
print("\n=== 4) RESUMEN ===");

let totalLiquidezQueDeberiaLiberarse = 0;
let distribucionesCompletamenteVendidas = 0;
let distribucionesConProblemas = [];

distribucionesEncontradas.forEach((item) => {
  const dist = item.distribution;
  const sharesRestantes = dist.shares || 0;
  
  if (sharesRestantes <= 0.000001) {
    distribucionesCompletamenteVendidas++;
    totalLiquidezQueDeberiaLiberarse += dist.allocatedAmount || 0;
    
    // Verificar problemas
    if (dist.isActive !== false) {
      distribucionesConProblemas.push({
        symbol: item.alert.symbol,
        alertId: item.alert._id,
        problema: "Completamente vendida pero isActive = true",
        allocatedAmount: dist.allocatedAmount
      });
    }
  }
});

print(`\nDistribuciones completamente vendidas: ${distribucionesCompletamenteVendidas}`);
print(`Total liquidez que debería haberse liberado: $${totalLiquidezQueDeberiaLiberarse.toFixed(2)}`);

if (distribucionesConProblemas.length > 0) {
  print(`\n⚠️ PROBLEMAS ENCONTRADOS:`);
  distribucionesConProblemas.forEach((problema, idx) => {
    print(`  ${idx + 1}. ${problema.symbol} (${problema.alertId}):`);
    print(`     Problema: ${problema.problema}`);
    print(`     Allocated Amount: $${problema.allocatedAmount.toFixed(2)}`);
  });
  print(`\nEstas distribuciones deberían tener isActive = false`);
} else {
  print(`\n✅ No se encontraron problemas obvios`);
}

// Verificar estado actual de liquidez
print(`\n=== 5) Estado actual de liquidez ===`);
print(`Initial Liquidity: $${(liquidityDoc.initialLiquidity || 0).toFixed(2)}`);
print(`Total Liquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
print(`Available Liquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
print(`Distributed Liquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);

// Recalcular para verificar
let montosDistribuidos = 0;
let gananciasRealizadas = 0;

distributions.forEach((d) => {
  if (d.isActive !== false && (d.shares || 0) > 0) {
    montosDistribuidos += d.allocatedAmount || 0;
  }
  gananciasRealizadas += d.realizedProfitLoss || 0;
});

const initialLiquidity = liquidityDoc.initialLiquidity || 0;
const availableCalculado = initialLiquidity - montosDistribuidos + gananciasRealizadas;

print(`\nValores calculados:`);
print(`  Distributed (activas con shares > 0): $${montosDistribuidos.toFixed(2)}`);
print(`  Available calculado: $${availableCalculado.toFixed(2)}`);
print(`  Available en BD: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);

const diferencia = availableCalculado - (liquidityDoc.availableLiquidity || 0);
if (Math.abs(diferencia) > 0.01) {
  print(`  ⚠️ Diferencia: $${diferencia.toFixed(2)}`);
  print(`  La liquidez disponible puede estar desactualizada.`);
}

print("\n=== FIN DE VERIFICACIÓN ===");
