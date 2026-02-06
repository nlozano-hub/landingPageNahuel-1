# Explicación: por qué la venta de OKLO se ejecutó al 50% en lugar del 100%

## Qué pasó

1. **Venta parcial del 50% (09/01)**  
   Se programó una venta parcial del 50% de OKLO con un rango de precio. El precio no llegó a ese rango, así que el sistema **desestimó** esa venta (la marcó como descartada). La posición siguió al 100%.

2. **Venta total del 100% (02/02)**  
   Más adelante se programó una venta **total** (100%) con otro rango de precio. El precio sí entró en ese rango.

3. **Bug en el cron**  
   El cron que ejecuta las ventas automáticas (`auto-convert-ranges`) buscaba ventas pendientes solo con la condición “no ejecutada” (`executed: false`). **No tenía en cuenta si la venta estaba descartada** (`discarded: true`).

4. **Consecuencia**  
   Al ejecutarse, el cron encontró primero la venta vieja del 50% (que seguía con `executed: false` aunque estaba desestimada) y la ejecutó, en lugar de la nueva venta del 100%. Por eso se vendió 50% y los mails/Telegram mostraron “50%” en vez de “venta total”.

## Corrección aplicada

En el cron se cambió la búsqueda de ventas pendientes para **excluir también las ventas descartadas**:

- **Antes:** `partialSales.find(sale => !sale.executed)`  
- **Después:** `partialSales.find(sale => !sale.executed && !sale.discarded)`

Así, si hay ventas desestimadas anteriormente (porque el precio no entró en rango), el cron las ignora y solo ejecuta la venta pendiente que corresponde al rango actual. Quedó solucionado para futuros casos.
