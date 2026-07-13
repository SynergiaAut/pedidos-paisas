# Módulo: Inventario (fase activa)

**Problema:** Camilo necesita cuadrar inventario unificado de las 2 bases de Milenium (GRANES + FISCAL) sin entrar al ERP. Es la necesidad más urgente del cliente.

## Estado (2026-07-11)

✅ **Operando con BD1**: sync desde API Flex CRM poblando `inventory_master` (2.145 ítems, 451 marcados `is_service`), botón "Sincronizar" en la UI (server action), stats reales, tabla con costo/clasificación/marca, selector de filas (100 default), RLS cerrado. Falta: credenciales BD2 (Ricardo) — al agregarlas al `.env.local`, el mismo botón trae ambas bases.

## Concepto clave: `is_service`

El catálogo del ERP incluye ítems no-físicos (DOMICILIO, fletes, clasificación FLETE o sin bodega asignada). Se marcan `is_service = true` y se **excluyen por defecto** de la tabla y de los conteos: no son inventariables y generarían descuadres falsos. Toggle "Servicios" en la UI para verlos.

## Conteo móvil por link (TASK-011, implementado 2026-07-12)

El sistema soporta conteos físicos en paralelo desde celulares en bodega. Al iniciar un "Conteo móvil", el administrador comparte un link temporal `/conteo/[token]`. Los bodegueros acceden sin autenticación (seguridad RLS cerrada y delegada a funciones RPC `security definer`), ingresan su nombre (guardado en `localStorage`) y capturan cantidades físicas. 
- **Enlace de Bodega:** La URL base se resuelve mediante `APP_BASE_URL` en el servidor, garantizando direcciones de red estables (ej. `http://fastorder.local:3000` o la IP de LAN) en lugar de `localhost:3000`.
- **Soporte de Mediciones:** Las tarjetas móviles muestran la unidad de medida (`unit`, ej. LB, UND, CAJA) al bodeguero para evitar errores de conteo de stock físico.
- **Flujo de Realtime:** La tabla `inventory_counts` está integrada en la publicación `supabase_realtime` para transmitir cada inserción en tiempo real al panel del administrador.

## Pestaña de Análisis y Consolidados (Dashboard)

El módulo de inventario incorpora una pestaña de **Análisis y Consolidados** para la monitorización histórica del inventario físico:
- **Cobertura de Catálogo:** Muestra la métrica e historial de cobertura física (`physical_stock is not null` sobre productos inventariables).
- **Tendencia de Descuadres:** Gráfico de evolución en tiempo real (`recharts` `LineChart`) que reporta la cantidad de descuadres por sesión y el valor total estimado del descuadre en pesos Colombianos (COP).
- **Historial de Sesiones:** Tabla unificada con los datos acumulados de cada sesión de conteo cerrada (modo, fecha, ítems contados, discrepancias detectadas, valor del descuadre).
- **Fugas Recurrentes (Ranking de Productos):** Reporte de aquellos productos que registran diferencias físicas en 2 o más sesiones distintas, ordenados por recurrencia y magnitud económica (COP) para investigación de hurtos o fallas de embalaje.

## Reglas de Datos

- `inventory_master`: catálogo y stock réplica de Milenium. Campos usados por la UI: `sku`, `barcode`, `description`, `db_source`, stock, precio, `physical_stock`, `last_counted_at`.
- `inventory_counts`, `inventory_sessions`: capa de transacciones e historial de conteos físicos.
- **Actualización de Stock Físico:** Cada conteo válido (escritorio o móvil) actualiza de forma síncrona los campos `physical_stock` y `last_counted_at` en `inventory_master`. El stock del catálogo unificado se ordena priorizando los productos recientemente contados (`last_counted_at desc nullsLast`), marcando un badge relativo ("Contado hace X").
- **Stock Teórico:** `system_stock` (el stock teórico que reporta Milenium) **nunca** es modificado por conteos locales; Milenium sigue siendo la fuente de verdad y los ajustes físicos se aplican manualmente en el ERP.

## Componentes

- `src/app/inventario/page.tsx` — dashboard de gestión con stats rápidos, catálogo y navegación a la pestaña de analítica.
- `src/components/inventory/UnifiedStockTable.tsx` — tabla unificada con ordenamiento prioritario de ítems contados y badges de tiempo relativo de auditoría.
- `src/components/inventory/InventoryAnalysisTab.tsx` — panel de analíticas, tendencia lineal de discrepancias (recharts), historial acumulado y ranking de pérdidas repetidas.
- `src/components/inventory/CyclicCountWizard.tsx` — asistente de conteo cíclico (con guardado síncrono vía Server Action `saveDesktopInventoryCount` y ordenamiento de ítems contados al principio de la grilla en curso).
- `src/app/conteo/[token]/page.tsx` — interfaz pública mobile-first para la captura del stock físico por parte de los bodegueros.

