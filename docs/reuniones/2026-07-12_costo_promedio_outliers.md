# Auditoría Sistemática y Pendiente de Discusión con Ricardo
**Fecha:** 2026-07-12 (Auditoría completa)
**Tema:** Inconsistencias críticas y outliers en el costo promedio (`cost_avg`) importado desde el ERP Milenium (BD1)

---

## 🚨 Resultados de la Auditoría Sistemática
Se ejecutó una auditoría exhaustiva sobre todo el universo de productos físicos (`is_service = false`) en `inventory_master` buscando artículos fuera de límites lógicos (valores superiores a $5,000,000 COP o menores a $0 COP).

La consulta SQL utilizada fue:
```sql
select sku, description, cost_avg 
from public.inventory_master 
where is_service = false 
  and (cost_avg > 5000000 or cost_avg < 0) 
order by abs(cost_avg) desc;
```

### Lista Completa de Outliers Detectados:
Solo tres artículos en todo el catálogo de bodega de la base de datos de origen (BD1) presentan esta condición de error extremo:

| SKU | Descripción | Costo Promedio en ERP (`cost_avg`) | Tipo de Inconsistencia |
| :--- | :--- | :--- | :--- |
| **`2202007`** | LATON SIXPACK CERVEZA CLUB COLOMBIA | **`$50.172.233.299.062,07 COP`** | Outlier de escala extremadamente alto (~$50 billones). |
| **`701042`** | 1/2 MARLBORO ICE FUSION X 10 UND | **`-$24.685.197.144,63 COP`** | Outlier de escala negativo (~-$24.6 mil millones). |
| **`606042`** | APERITIVO GUARAQUEÑO CANECA | **`-$952.329,10 COP`** | Costo negativo en el ERP. |

### Análisis de Estabilidad del Sync
- Se corroboró que tras ejecutar múltiples ciclos de sincronización de inventario sucesivos, los valores de `cost_avg` de estos productos permanecieron **totalmente estáticos y consistentes**.
- Esto confirma que no existe un comportamiento errático o cálculo aleatorio por parte del conector de integración de Next.js, sino que **los datos están grabados incorrectamente en el ERP de origen**.

---

## 🛠️ Acción de Mitigación Implementada (Frontend/Backend)
- Se estableció el filtro definitivo en la Server Action analítica para ignorar del total de valorización del catálogo y auditados cualquier producto con `cost_avg` que no se encuentre en el rango cerrado de `[0, 5000000] COP`.
- Se desplegó un banner de alerta con los artículos omitidos y sus costos en la pestaña de Análisis del Dashboard de bodega.

---

## 📋 Tareas Pendientes para Ricardo
*   [ ] **Corrección Directa de Fichas en el ERP:**
    *   SKU `2202007`: Reajustar costo promedio a valor comercial real (~$22,000 COP).
    *   SKU `701042`: Corregir el signo negativo y ajustar a costo unitario de compra real.
    *   SKU `606042`: Corregir el signo negativo e ingresar costo real de adquisición.
*   [ ] **Investigación de Causa Raíz en Milenium:** Verificar si la base de datos del ERP tiene disparadores o procedimientos de recálculo que puedan introducir valores en negativo o con problemas de escala decimal en transacciones de compra inusuales.
