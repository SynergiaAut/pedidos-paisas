# Diccionario de Tablas - Base de Datos Milenium (Granero Los Paisas)

La base de datos analizada arrojó un total de más de 400 tablas. Para facilitar nuestra integración y análisis, he categorizado todas las tablas disponibles en grupos lógicos funcionales del ERP.

---

## 1. Inventario, Catálogo y Productos (⚡ CORE PARA EL BOT)
Tablas que controlan artículos, grupos de ítems, listas de empacado y saldos físicos de mercancía:
- `INVENTARIO`, `INVENTARIO_DET`, `INVENTARIO_ALQUILER`
- `ITEM`, `ITEM_ADJUNTO`, `ITEM_CARACTERISTICA`, `ITEM_DCTO`
- `PRECIO_ITEM`, `PRECIO_ITEM_COMPRA`, `PRECIO_ITEM_DET`
- `GRUPO_ITEM`, `KIT`, `KIT_DET`
- `KARDEX`, `HISTORIA_KARDEX`
- `BODEGA`

## 2. Clientes y Relacionamiento (⚡ CORE PARA EL BOT)
Tablas esenciales para identificar a un usuario cuando nos escriba por WhatsApp:
- `TERCERO`, `TERCERO_CLIENTE`, `TERCERO_CONTACTO`
- `TERCERO_CONTACTO_TELEFONO`, `TERCERO_DIRECCION`, `TERCERO_DIRECCION_TELEFONO`
- `CLIENTE_SECTOR`, `MEDIO_CONTACTO`

**Esquema Verificado TERCERO:**
- `ID_TERCERO` (DOUBLE PRECISION, PK) - NIT/CC
- `ID_SUCURSAL_TERCERO` (SMALLINT, PK, Default 1)
- `ID_TIPO_IDENTIFICACION` (VARCHAR(6)) - Ej: 'CC'
- `NOMBRE` y `NOMBRE_COMERCIAL` (VARCHAR(255))
- `TELEFONO_CELULAR` (VARCHAR(40))
- `CLIENTE` (CHAR(2), Default 'NO', debe insertarse como 'SI')
- Required FK Empties: `ID_DEPTO`, `ID_CIUDAD`, `ID_TIPO_EMPRESA`

## 3. Emisión de Pedidos y Ventas (⚡ CORE PARA EL BOT)
Donde viajan las órdenes comerciales capturadas:
- `PEDIDO`, `PEDIDO_DET`, `PEDIDO_CARGO`
- `FACTURA`, `FACTURA_DET`, `FACTURA_PAGO`
- `COTIZACION`, `COTIZACION_DET`
- `REMISION`, `REMISION_DET`

**Esquema Verificado PEDIDO:**
- `ID_EMPRESA` (VARCHAR(2), PK) - Principalmente '01'
- `ID_SUCURSAL` (VARCHAR(2), PK) - Principalmente '01'
- `ID_TIPO_DOC` (VARCHAR(3), PK) - Literalmente 'PED'
- `NUMERO` (INTEGER, PK) - Consecutivo recuperado con `MAX(NUMERO)+1`
- `ID_TERCERO` (DOUBLE PRECISION) - FK_TERCERO
- `ID_SUCURSAL_TERCERO` (SMALLINT, Default 1)
- `TOTAL`, `TOTAL_ITEM` (DOUBLE) - Valores monetarios
- `ESTADO` (VARCHAR(15), Default 'PENDIENTE')
- `USUARIO` (VARCHAR(30)) - 'SISTEMA_WEB'

## 4. Tesorería, Facturación y Caja
Flujo de caja, pagos y puntos de recaudo:
- `CAJA`, `FORMA_PAGO`, `FORMA_PAGODET`
- `CUENTAS_CAJA_BANCO`, `CUENTA_CORRIENTE`
- `CIERRE_CAJA`, `FLUJO_CAJA`
- `BANCO`, `CB_CONCILIACION_BANCARIA`

## 5. Proveedores y Compras
Todo lo relacionado al pago y surtido con el granero:
- `TERCERO_PROVEEDOR`
- `CARTERA_PROVEEDORES`
- `FACTURA_COMPRA`, `FACTURA_COMPRA_DET`
- `ORDEN_COMPRA`
- `REQUISICION_COMPRA`

## 6. Recursos Humanos (Nómina NRH)
Milenium utiliza un robusto prefijo `NRH_` para todo el control de empleados:
- `NRH_EMPLEADO`, `NRH_CONTRATO_EMPLEADO`
- `NRH_LIQUIDACION`, `NRH_NOMINA_ELECTRONICA_DET`
- `NRH_PROGRAMACION_TURNO`, `NRH_NOVEDAD`

## 7. Contabilidad e Impuestos
Toda la lógica de asientos y tributos que el bot no necesita tocar:
- `ASIENTO`, `ASIENTO_DET`
- `CUENTA`, `CLASE_CUENTA`
- `IMPUESTO`, `TIPO_IMPUESTO`, `AGRUPACION_TRIBUTARIA`
- `ESTADO_FINANCIERO`

## 8. Logística y Envíos
Útil para estatus de domicilios:
- `MODO_ENVIO`, `TRANSPORTADOR`, `VEHICULO`
- `ORDEN_DESPACHO`

## 9. Sistema, Seguridad y Auditoría (LOGS)
Tablas internas de Milenium para control del sistema:
- `USUARIO`
- `MODULO`, `OPCION`, `PERMISOS`
- `LOG`, `LOG_OPERACION`, `LOG_SESION`
- `EMPRESA`, `SUCURSAL`, `PUNTO`
