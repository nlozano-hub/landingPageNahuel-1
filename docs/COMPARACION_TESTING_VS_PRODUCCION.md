# Comparación Completa: Repositorio de Testing vs Producción

**Fecha:** 5 de Febrero, 2026  
**Repositorio Testing:** https://github.com/Cuutu/landingPageNahuel-testing  
**Repositorio Producción:** https://github.com/joaquinperez028/landingPageNahuel

---

## 🔴 CRÍTICO: Bug de ventas descartadas NO corregido en Testing

### 1. Archivo: `pages/api/cron/auto-convert-ranges.ts`

#### **PRODUCCIÓN (CORRECTO - Línea 529):**
```typescript
// ✅ CORREGIDO: Buscar venta pendiente que NO esté ejecutada NI descartada
const pendingSale = partialSales.find((sale: any) => !sale.executed && !sale.discarded);
```

#### **TESTING (INCORRECTO - SIN CORRECCIÓN):**
```typescript
// Buscar cualquier venta pendiente (no ejecutada)
const pendingSale = partialSales.find((sale: any) => !sale.executed);
```

**⚠️ IMPACTO CRÍTICO:**  
- El cron en testing puede ejecutar ventas descartadas anteriormente
- El bug documentado en `EXPLICACION_BUG_VENTA_OKLO_50_VS_100.md` sigue presente
- **ACCIÓN REQUERIDA:** Actualizar testing con la corrección de producción

#### **PRODUCCIÓN (CORRECTO - Línea 629):**
```typescript
if (!sale.executed && !sale.discarded) {
  return {
    ...sale,
    executed: false,
    discarded: true,
    discardedAt: new Date(),
    discardReason: motivo
  };
}
```

#### **TESTING:** 
✅ Verificado - Tiene la misma lógica correcta

---

### 2. Archivo: `pages/api/alerts/portfolio-evolution.ts`

#### **PRODUCCIÓN (CORRECTO - Líneas 509, 519):**
```typescript
// Función helper para verificar si una alerta tiene ventas parciales ejecutadas
const hasExecutedPartialSales = (alert: any): boolean => {
  if (alert.liquidityData?.partialSales && Array.isArray(alert.liquidityData.partialSales)) {
    return alert.liquidityData.partialSales.some((sale: any) => 
      sale.executed === true && !sale.discarded  // ✅ Verifica discarded
    );
  }
  return false;
};

// Función helper para calcular ganancia realizada de ventas parciales
const getRealizedProfitFromPartialSales = (alert: any): number => {
  if (alert.liquidityData?.partialSales && Array.isArray(alert.liquidityData.partialSales)) {
    const executedSales = alert.liquidityData.partialSales.filter((sale: any) => 
      sale.executed === true && !sale.discarded  // ✅ Verifica discarded
    );
    return executedSales.reduce((sum: number, sale: any) => {
      return sum + (sale.realizedProfit || 0);
    }, 0);
  }
  return 0;
};
```

#### **TESTING:**
✅ Verificado - Tiene la misma lógica correcta con `!sale.discarded`

---

### 3. Archivo: `pages/api/admin/partial-sale.ts`

#### **PRODUCCIÓN:**
- ✅ Marca ventas como `executed: false` cuando se programan con rango
- ✅ Marca ventas como `executed: true` cuando se ejecutan inmediatamente
- ✅ Maneja correctamente el campo `discarded` en el modelo

#### **TESTING:**
✅ Verificado - Tiene la misma lógica correcta

---

### 4. Archivo: `models/Alert.ts`

#### **PRODUCCIÓN:**
```typescript
partialSales: [{
  // ... otros campos
  executed: { type: Boolean, default: false },
  discarded: { type: Boolean, default: false },  // ✅ Campo presente
  discardedAt: { type: Date },
  discardReason: { type: String }
}]
```

#### **TESTING:**
✅ Verificado - Tiene el mismo esquema con campo `discarded`

---

### 5. Archivo: `pages/api/admin/recalculate-realized-profit.ts`

#### **PRODUCCIÓN (CORRECTO - Línea 74):**
```typescript
const executedSales = alert.liquidityData?.partialSales?.filter(
  (sale: any) => sale.executed === true && !sale.discarded
);
```

#### **TESTING:**
⚠️ **NO VERIFICADO** - Necesita revisión

---

### 6. Archivo: `pages/api/admin/portfolio-audit.ts`

#### **PRODUCCIÓN (CORRECTO - Línea 296):**
```typescript
const executedSales = alert.liquidityData.partialSales.filter(
  (sale: any) => sale.executed === true && !sale.discarded
);
```

#### **TESTING:**
⚠️ **NO VERIFICADO** - Necesita revisión

---

### 7. Archivo: `lib/portfolioCalculator.ts`

#### **PRODUCCIÓN (CORRECTO - Líneas 127-130):**
```typescript
const executedSales = alert.liquidityData.partialSales.filter(
  (sale: any) => {
    // Solo incluir ventas ejecutadas y no descartadas
    if (!sale.executed || sale.discarded) return false;
    // ...
  }
);
```

#### **TESTING:**
⚠️ **NO VERIFICADO** - Necesita revisión

---

## 📋 Diferencias en package.json

### Versiones de TypeScript y tipos

| Dependencia | Producción | Testing | Estado |
|------------|------------|---------|--------|
| `typescript` | `^5.2.0` | `5.9.3` | ⚠️ Testing tiene versión más nueva (no crítico) |
| `@types/node` | `^20.8.0` | `20.19.30` | ⚠️ Testing tiene versión más nueva (no crítico) |
| `@types/react` | `^18.2.0` | `18.3.27` | ⚠️ Testing tiene versión más nueva (no crítico) |

**Nota:** Las diferencias de versiones no son críticas. El problema principal es el bug en `auto-convert-ranges.ts`.

---

## ✅ Resumen de diferencias encontradas

### 🔴 CRÍTICO (Debe corregirse inmediatamente):

1. **`pages/api/cron/auto-convert-ranges.ts` (Línea 529)**
   - **Producción:** ✅ `!sale.executed && !sale.discarded`
   - **Testing:** ❌ Solo `!sale.executed`
   - **Impacto:** El cron puede ejecutar ventas descartadas

### ⚠️ PENDIENTE DE VERIFICACIÓN:

2. **`pages/api/admin/recalculate-realized-profit.ts`**
   - Necesita verificación si filtra `discarded`

3. **`pages/api/admin/portfolio-audit.ts`**
   - Necesita verificación si filtra `discarded`

4. **`lib/portfolioCalculator.ts`**
   - Necesita verificación si filtra `discarded`

### ✅ VERIFICADO (Sin diferencias):

- `pages/api/alerts/portfolio-evolution.ts` - ✅ Correcto en ambos
- `pages/api/admin/partial-sale.ts` - ✅ Correcto en ambos
- `models/Alert.ts` - ✅ Correcto en ambos

---

## ✅ Checklist de cambios pendientes en Testing

- [x] **CRÍTICO:** Corregir línea 529 en `auto-convert-ranges.ts` para incluir `!sale.discarded`
- [ ] Verificar `recalculate-realized-profit.ts` filtra `discarded`
- [ ] Verificar `portfolio-audit.ts` filtra `discarded`
- [ ] Verificar `portfolioCalculator.ts` filtra `discarded`
- [ ] Ejecutar pruebas en testing después de aplicar correcciones

---

## 📝 Notas adicionales

- El bug fue identificado y corregido en producción después del incidente de OKLO (02/02/2026)
- La corrección está documentada en `docs/EXPLICACION_BUG_VENTA_OKLO_50_VS_100.md`
- Es importante sincronizar esta corrección a testing para evitar regresiones
- Los archivos verificados muestran que la mayoría del código está sincronizado, excepto el bug crítico

---

---

## 📱 COMPARACIÓN: Funcionalidades de Telegram

### Archivo: `lib/telegramBot.ts`

#### **PRODUCCIÓN vs TESTING:**

✅ **SIN DIFERENCIAS** - Los archivos son idénticos en ambos repositorios:
- `formatAlertMessage()` - ✅ Idéntico
- `formatOperationNotes()` - ✅ Idéntico  
- `sendAlertToTelegram()` - ✅ Idéntico
- `sendReportToTelegram()` - ✅ Idéntico
- `sendMessageToChannel()` - ✅ Idéntico
- `testTelegramConnection()` - ✅ Idéntico

**Conclusión:** Las funcionalidades de Telegram están completamente sincronizadas entre testing y producción.

### Archivo: `pages/api/cron/auto-convert-ranges.ts` - Funciones de Telegram

#### **PRODUCCIÓN:**
- ✅ Función `enviarResumenTelegram()` implementada (línea ~2040)
- ✅ Usa `sendMessageToChannel()` con botones inline para "Ver Operaciones"
- ✅ Envía resúmenes consolidados de operaciones con formato Markdown
- ✅ Incluye botones inline con URL a la página de operaciones

#### **TESTING:**
✅ **VERIFICADO** - Tiene la función `enviarResumenTelegram()` implementada
- ✅ Usa `sendMessageToChannel()` con soporte para botones inline
- ✅ Formato idéntico al de producción
- **Nota:** El archivo completo de testing tiene la misma estructura de funciones de Telegram

### Archivo: `pages/api/cron/market-close.ts` - Uso de Telegram

#### **PRODUCCIÓN:**
- ✅ Usa `sendMessageToChannel()` para mensajes sin actividad
- ✅ Usa `sendAlertToTelegram()` para alertas de cierre

#### **TESTING:**
⚠️ **NO VERIFICADO** - Necesita revisión

---

## 🚀 Próximos pasos recomendados

1. **INMEDIATO:** Aplicar la corrección del bug en `auto-convert-ranges.ts` línea 529
2. **URGENTE:** Verificar los 3 archivos pendientes de revisión (recalculate-realized-profit, portfolio-audit, portfolioCalculator)
3. **TELEGRAM:** Verificar que `auto-convert-ranges.ts` y `market-close.ts` en testing tengan las mismas funciones de Telegram
4. **Testing:** Ejecutar pruebas específicas del flujo de ventas descartadas
5. **Documentación:** Actualizar cualquier documentación de testing si es necesario
