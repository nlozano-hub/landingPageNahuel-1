/*******************************
 * INVALIDAR CACHE DE LIQUIDEZ
 * 
 * Elimina las entradas de cache relacionadas con liquidez
 * para forzar que el frontend recargue los valores actualizados
 *******************************/

const POOL = "TraderCall"; // Cambiar a "SmartMoney" si es necesario

const apiCacheColl = db.apicaches;

print("=== INVALIDACIÓN DE CACHE DE LIQUIDEZ ===\n");
print(`Pool: ${POOL}\n`);

try {
  // Buscar y eliminar todas las entradas de cache relacionadas con liquidez de este pool
  // Las keys tienen keyParts.path que contiene '/api/liquidity/' y query.pool === pool
  const cacheResult = apiCacheColl.deleteMany({
    "keyParts.path": { $regex: "^/api/liquidity/" },
    "keyParts.query.pool": POOL
  });
  
  print(`✅ Cache invalidado exitosamente:`);
  print(`   Entradas eliminadas: ${cacheResult.deletedCount}`);
  print(`   Pool: ${POOL}`);
  print("\nEl frontend debería mostrar los valores actualizados en la próxima solicitud.");
  print("Si no se actualiza inmediatamente, refrescá la página o esperá unos segundos.");
  
} catch (error) {
  print(`❌ Error al invalidar cache: ${error.message}`);
}

print("\n=== FIN DE INVALIDACIÓN ===");
