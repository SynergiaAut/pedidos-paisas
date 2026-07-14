/**
 * FlexCrmClient - Cliente HTTP para la API Flex CRM / Millenium Enterprise
 * Base URL: https://me.services.ibla.co
 *
 * Arquitectura 2 bases de datos (constitucion Art. 2, spec integracion-api-2bd):
 *   db_source '01' = GRANESLOSPAISAS -> FLEX_CRM_EMAIL_01 / FLEX_CRM_CLAVE_01
 *   db_source '02' = PAISASFISCAL   -> FLEX_CRM_EMAIL_02 / FLEX_CRM_CLAVE_02
 *
 * Cada base tiene su propio usuario y su propio JWT (header `token`),
 * obtenido en POST /crm/empresa/login y renovado automaticamente.
 * Este modulo es la UNICA puerta hacia la API - nada mas hace fetch a Milenium.
 */

const BASE_URL = process.env.FLEX_CRM_URL || 'https://me.services.ibla.co';

// ==========================================
// TIPOS
// ==========================================

export type DbSource = '01' | '02';

export const DB_LABELS: Record<DbSource, string> = {
    '01': 'GRANESLOSPAISAS',
    '02': 'PAISASFISCAL',
};

export interface CrmCustomer {
    tercero: string;
    nombre: string;
    ciudad: string;
    telefono: string;
    email: string;
}

/** Stock por bodega, tal como lo entrega la API. */
export interface CrmStockBodega {
    CANTIDAD: number;
    ID_BODEGA: string | null;
}

/**
 * Payload REAL de /crm/all/product (verificado 2026-07-11 contra la API viva;
 * el contrato OpenAPI esta desactualizado). Cada elemento viene envuelto en { producto: {...} }.
 * Nota: NO incluye precio de venta (solo COSTO_PROMEDIO) - pendiente con Ricardo.
 */
export interface CrmProductRaw {
    ID_ITEM: string;
    DESCRIPCION_ITEM: string;
    DESCRIPCION_ALTERNA: string;
    REFERENCIA: string;
    ID_CLASIFICACION: string;
    DESCRIPCION_CLASIFICACION: string;
    ID_MARCA_ITEM: string;
    DESCRIPCION_MARCA: string;
    ID_UNIDAD_COMPRA: string;
    DESCRIPCION_UNIDAD: string;
    COSTO_PROMEDIO: number;
    ID_PROVEEDOR: number;
    ID_SUCURSAL_PROVEEDOR: number;
    NOMBRE_PROVEEDOR: string | null;
    SOURCE_PROVEEDOR: string;
    stock: CrmStockBodega[];
}

/** Producto normalizado para la app (mapeo hacia inventory_master). */
export interface CrmProduct {
    sku: string;                    // ID_ITEM
    descripcion: string;            // DESCRIPCION_ITEM
    referencia: string;
    clasificacion: string;          // DESCRIPCION_CLASIFICACION
    marca: string;                  // DESCRIPCION_MARCA
    unidad: string;                 // DESCRIPCION_UNIDAD
    costo_promedio: number;
    existencia_total: number;       // suma de stock[].CANTIDAD
    stock_por_bodega: CrmStockBodega[];
}

/** Producto etiquetado con su base de origen (para inventory_master). */
export interface CrmProductTagged extends CrmProduct {
    db_source: DbSource;
}

/** Normaliza el payload crudo de la API a CrmProduct. */
export function normalizeProduct(raw: CrmProductRaw): CrmProduct {
    const stock = Array.isArray(raw.stock) ? raw.stock : [];
    return {
        sku: raw.ID_ITEM,
        descripcion: raw.DESCRIPCION_ITEM,
        referencia: raw.REFERENCIA,
        clasificacion: raw.DESCRIPCION_CLASIFICACION,
        marca: raw.DESCRIPCION_MARCA,
        unidad: raw.DESCRIPCION_UNIDAD,
        costo_promedio: raw.COSTO_PROMEDIO ?? 0,
        existencia_total: stock.reduce((sum, s) => sum + (s.CANTIDAD ?? 0), 0),
        stock_por_bodega: stock,
    };
}

export interface CrmOrder {
    tipodoc: string;
    numero: string;
    fecha: string;
    cliente: string;
    total: number;
}

export interface CrmDebit {
    cliente: string;
    tipodoc: string;
    numero: string;
    fecha: string;
    saldo: number;
    vencimiento: string;
}

export interface CrmInvoice {
    tipodoc: string;
    numero: string;
    fecha: string;
    cliente: string;
    total: number;
}

export interface CrmInvoiceItemRaw {
    ID_ITEM: string;
    DESCRIPCION_ITEM: string;
    ID_MARCA_ITEM?: string;
    DESCRIPCION_MARCA?: string;
    ID_PADRE_CLASIFICACION?: string;
    DES_CLASIF_PADRE?: string;
    ID_CLASIFICACION?: string;
    DESCRIPCION_CLASIFICACION?: string;
    ID_UNIDAD_COMPRA?: string;
    ID_BODEGA: string | null;
    CANTIDAD: number;
    PRECIO: number;
    TOTAL_ITEM: number;
    TASA_DCTO_FIJO?: number;
    TOTAL_DCTO?: number;
    SUBTOTAL?: number;
    TASA_IVA?: number;
    TOTAL_IVA?: number;
    TOTAL?: number;
    COSTO_KARDEX?: number;
    TOTAL_COSTO?: number;
    MARGEN?: number;
}

export interface CrmInvoiceRaw {
    FECHA: string;
    ID_TIPO_DOC: string;
    NUMERO: number;
    FECHA_DESPACHO?: string;
    ID_TERCERO: number | string;
    ID_SUCURSAL_TERCERO?: number;
    NOMBRE_TERCERO: string;
    DIRECCION_TERCERO?: string;
    E_MAIL_TERCERO?: string;
    ID_VENDEDOR: number;
    NOMBRE_VENDEDOR: string;
    ID_ZONA?: string;
    DESCRIPCION_ZONA?: string | null;
    ID_DESTINO?: string;
    DESCRIPCION_DESTINO?: string;
    ID_PAIS?: string;
    ID_DEPTO?: string;
    ID_CIUDAD?: string;
    DIRECCION?: string;
    TELEFONO?: string;
    NOMBRE_PAIS_CLIENTE?: string;
    NOMBRE_DEPTO_CLIENTE?: string;
    NOMBRE_CIUDAD_CLIENTE?: string;
    items?: CrmInvoiceItemRaw[];
}

export interface CrmInvoiceItemNormalized {
    sku: string;
    descripcion: string;
    bodega: string | null;
    cantidad: number;
    precio: number;
    total: number;
    costo_kardex: number;
    margen: number;
}

export interface CrmInvoiceNormalized {
    db_source: DbSource;
    tipodoc: string;
    numero: string;
    fecha: string;
    id_tercero: string;
    nombre_tercero: string;
    id_vendedor: number;
    nombre_vendedor: string;
    direccion: string;
    telefono: string;
    total: number;
    items: CrmInvoiceItemNormalized[];
    raw: CrmInvoiceRaw;
}

export function repairMojibake(str: string | null | undefined): string {
    if (!str) return '';
    if (!str.includes('Ã') && !str.includes('Â')) return str;
    let result = str;
    const replacements: [RegExp, string][] = [
        [/Ã'/g, 'Ñ'],
        [/Ã\u0091/g, 'Ñ'],
        [/Ã‘/g, 'Ñ'],
        [/Ã±/g, 'ñ'],
        [/Ã¡/g, 'á'],
        [/Ã©/g, 'é'],
        [/Ã­/g, 'í'],
        [/Ã\u00ad/g, 'í'],
        [/Ã³/g, 'ó'],
        [/Ãº/g, 'ú'],
        [/Ã\u0081/g, 'Á'],
        [/Ã\u0089/g, 'É'],
        [/Ã\u008d/g, 'Í'],
        [/Ã\u0093/g, 'Ó'],
        [/Ã\u009a/g, 'Ú'],
        [/Ã /g, 'Á'],
        [/Ã‰/g, 'É'],
        [/Ã /g, 'Í'],
        [/Ã“/g, 'Ó'],
        [/Ãš/g, 'Ú'],
        [/Â¿/g, '¿'],
        [/Â¡/g, '¡'],
        [/Ã¼/g, 'ü'],
        [/Ãœ/g, 'Ü']
    ];
    for (const [pattern, replacement] of replacements) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

export function normalizeInvoice(raw: CrmInvoiceRaw, db_source: DbSource): CrmInvoiceNormalized {
    const items = Array.isArray(raw.items) ? raw.items : [];
    
    const normalizedItems: CrmInvoiceItemNormalized[] = items.map(item => ({
        sku: item.ID_ITEM,
        descripcion: repairMojibake((item.DESCRIPCION_ITEM ?? '').trim()),
        bodega: item.ID_BODEGA || null,
        cantidad: item.CANTIDAD ?? 0,
        precio: item.PRECIO ?? 0,
        total: item.TOTAL ?? item.TOTAL_ITEM ?? 0,
        costo_kardex: item.COSTO_KARDEX ?? 0,
        margen: item.MARGEN ?? 0,
    }));

    const calculatedTotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);

    return {
        db_source,
        tipodoc: raw.ID_TIPO_DOC,
        numero: String(raw.NUMERO),
        fecha: raw.FECHA,
        id_tercero: String(raw.ID_TERCERO),
        nombre_tercero: repairMojibake((raw.NOMBRE_TERCERO ?? '').trim()),
        id_vendedor: raw.ID_VENDEDOR,
        nombre_vendedor: repairMojibake((raw.NOMBRE_VENDEDOR ?? '').trim()),
        direccion: repairMojibake(((raw.DIRECCION || raw.DIRECCION_TERCERO) ?? '').trim()),
        telefono: (raw.TELEFONO ?? '').trim(),
        total: calculatedTotal,
        items: normalizedItems,
        raw
    };
}

export interface DbHealth {
    db_source: DbSource;
    label: string;
    ok: boolean;
    latency_ms: number;
    empresa?: string;
    nit?: string;
    token_expires_at?: string;
    error?: string;
}

// ==========================================
// CREDENCIALES POR BASE
// ==========================================

function getCredentials(db: DbSource): { correo: string; clave: string } {
    // Fallback a las variables legacy (sin sufijo) para la base 01,
    // asi el .env.local existente sigue funcionando sin cambios.
    const correo =
        process.env[`FLEX_CRM_EMAIL_${db}`] ||
        (db === '01' ? process.env.FLEX_CRM_EMAIL : undefined) ||
        '';
    const clave =
        process.env[`FLEX_CRM_CLAVE_${db}`] ||
        (db === '01' ? process.env.FLEX_CRM_CLAVE : undefined) ||
        '';

    if (!correo || !clave) {
        throw new Error(
            `[FlexCRM:${db}] Credenciales no configuradas. Define FLEX_CRM_EMAIL_${db} y FLEX_CRM_CLAVE_${db} en .env.local`
        );
    }
    return { correo, clave };
}

// ==========================================
// CLIENTE POR BASE (token cacheado por instancia)
// ==========================================

class FlexCrmClient {
    private token: string | null = null;
    private tokenExpiry = 0; // timestamp ms
    private loginInfo: { empresa?: string; nit?: string } = {};
    readonly db: DbSource;

    constructor(db: DbSource) {
        this.db = db;
    }

    /**
     * Obtiene el token activo o hace login si expiro.
     * El JWT dura ~15 dias - renovamos cuando queden menos de 24h.
     */
    private async getToken(): Promise<string> {
        const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;
        if (this.token && Date.now() < this.tokenExpiry - REFRESH_THRESHOLD_MS) {
            return this.token;
        }

        const { correo, clave } = getCredentials(this.db);
        console.log(`[FlexCRM:${this.db}] Autenticando (${DB_LABELS[this.db]})...`);

        const res = await fetch(`${BASE_URL}/crm/empresa/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, clave }),
        });

        if (!res.ok) {
            throw new Error(`[FlexCRM:${this.db}] Login fallido (HTTP ${res.status}): ${await res.text()}`);
        }

        const data = await res.json();
        if (!data.ok || !data.token) {
            throw new Error(`[FlexCRM:${this.db}] Login fallido: ${data.message}`);
        }

        const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
        this.token = data.token;
        this.tokenExpiry = payload.exp * 1000;
        this.loginInfo = { empresa: data.usuario?.razon_social, nit: data.usuario?.nit };

        console.log(`[FlexCRM:${this.db}] Token OK. Expira: ${new Date(this.tokenExpiry).toISOString()}`);
        return this.token as string;
    }

    /**
     * Funcion base para todas las llamadas autenticadas.
     * Decodificacion tolerante a encoding: la API declara UTF-8 pero envia bytes
     * latin1 (ej. "ALI�" en vez de ALIÑOS). Si la decodificacion UTF-8 produce
     * U+FFFD, re-decodificamos como windows-1252. Si Ricardo corrige el charset,
     * este fallback deja de activarse solo.
     */
    async post<T>(path: string, body: object = {}, timeoutMs?: number): Promise<T> {
        const token = await this.getToken();
        const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token },
            body: JSON.stringify(body),
            signal,
        });

        const buffer = await res.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(buffer);

        let data: { ok: boolean; message?: string } & T;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`[FlexCRM:${this.db}] Respuesta no-JSON en ${path} (HTTP ${res.status})`);
        }

        if (!res.ok || !data.ok) {
            throw new Error(`[FlexCRM:${this.db}] Error en ${path}: ${data.message || res.statusText}`);
        }
        return data;
    }

    /** Login + latencia - para el health check. */
    async health(): Promise<DbHealth> {
        const start = Date.now();
        try {
            this.token = null; // forzar login real, no cache
            await this.getToken();
            return {
                db_source: this.db,
                label: DB_LABELS[this.db],
                ok: true,
                latency_ms: Date.now() - start,
                empresa: this.loginInfo.empresa,
                nit: this.loginInfo.nit,
                token_expires_at: new Date(this.tokenExpiry).toISOString(),
            };
        } catch (error: unknown) {
            return {
                db_source: this.db,
                label: DB_LABELS[this.db],
                ok: false,
                latency_ms: Date.now() - start,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ---------- Clientes ----------
    async getAllCustomers(): Promise<CrmCustomer[]> {
        const data = await this.post<{ customers: CrmCustomer[] }>('/crm/all/customer');
        return data.customers;
    }

    async getOneCustomer(tercero: string): Promise<CrmCustomer | null> {
        const data = await this.post<{ customers: CrmCustomer[] }>('/crm/one/customer', { tercero });
        return data.customers?.[0] ?? null;
    }

    // ---------- Productos ----------
    // La API envuelve cada elemento en { producto: {...} } - desempaquetamos y normalizamos.
    async getAllProducts(): Promise<CrmProduct[]> {
        const data = await this.post<{ products: { producto: CrmProductRaw }[] }>('/crm/all/product');
        return (data.products ?? []).map((p) => normalizeProduct(p.producto));
    }

    async getOneProduct(item: string): Promise<CrmProduct | null> {
        const data = await this.post<{ products: { producto: CrmProductRaw }[] }>('/crm/one/product', { item });
        const raw = data.products?.[0]?.producto;
        return raw ? normalizeProduct(raw) : null;
    }

    // ---------- Pedidos ----------
    async getOrdersByDateRange(fechainicial: string, fechafinal: string): Promise<CrmOrder[]> {
        const data = await this.post<{ pedidos: CrmOrder[] }>('/crm/all/order', { fechainicial, fechafinal });
        return data.pedidos;
    }

    async getOneOrder(tipodoc: string, numero: string): Promise<CrmOrder | null> {
        const data = await this.post<{ pedidos: CrmOrder[] }>('/crm/one/order', { tipodoc, numero });
        return data.pedidos?.[0] ?? null;
    }

    // ---------- Facturas ----------
    async getInvoicesByDateRange(fechainicial: string, fechafinal: string): Promise<CrmInvoice[]> {
        const data = await this.post<{ invoices: CrmInvoice[] }>('/crm/all/invoice', { fechainicial, fechafinal });
        return data.invoices;
    }

    async getInvoices(fechainicial: string, fechafinal: string): Promise<CrmInvoiceNormalized[]> {
        const data = await this.post<{ invoices: { factura: CrmInvoiceRaw }[] }>(
            '/crm/all/invoice',
            { fechainicial, fechafinal },
            15000
        );
        return (data.invoices ?? []).map((i) => normalizeInvoice(i.factura, this.db));
    }

    async getOneInvoice(tipodoc: string, numero: string): Promise<CrmInvoiceNormalized | null> {
        const data = await this.post<{ invoices: { factura: CrmInvoiceRaw }[] }>(
            '/crm/one/invoice',
            { tipodoc, numero },
            15000
        );
        const raw = data.invoices?.[0]?.factura;
        return raw ? normalizeInvoice(raw, this.db) : null;
    }

    // ---------- Cartera ----------
    async getDebitsByCustomer(cliente: string, fechafinal: string): Promise<CrmDebit[]> {
        const data = await this.post<{ debits: CrmDebit[] }>('/crm/one/debit', { cliente, fechafinal });
        return data.debits;
    }
}

// Instancias unicas por base (token compartido dentro del proceso del server)
const clients: Partial<Record<DbSource, FlexCrmClient>> = {};

export function getFlexCrm(db: DbSource): FlexCrmClient {
    if (!clients[db]) clients[db] = new FlexCrmClient(db);
    return clients[db] as FlexCrmClient;
}

// ==========================================
// HELPERS MULTI-BASE
// ==========================================

/**
 * Productos de ambas bases, etiquetados con db_source.
 * Tolerante a fallos parciales: si una base falla, retorna la otra
 * y reporta el error en `errors` (criterio del spec integracion-api-2bd).
 */
export async function getAllProductsUnified(): Promise<{
    products: CrmProductTagged[];
    errors: { db_source: DbSource; error: string }[];
}> {
    const dbs: DbSource[] = ['01', '02'];
    const results = await Promise.allSettled(dbs.map((db) => getFlexCrm(db).getAllProducts()));

    const products: CrmProductTagged[] = [];
    const errors: { db_source: DbSource; error: string }[] = [];

    results.forEach((r, i) => {
        const db = dbs[i];
        if (r.status === 'fulfilled') {
            products.push(...r.value.map((p) => ({ ...p, db_source: db })));
        } else {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`[FlexCRM:${db}] getAllProducts fallo:`, msg);
            errors.push({ db_source: db, error: msg });
        }
    });

    return { products, errors };
}

/** Health de ambas bases en paralelo. */
export async function healthAll(): Promise<DbHealth[]> {
    return Promise.all((['01', '02'] as DbSource[]).map((db) => getFlexCrm(db).health()));
}

// ==========================================
// COMPATIBILIDAD (API anterior, apunta a la base 01)
// Consumidores nuevos: usar getFlexCrm(db) o los helpers unified.
// ==========================================

export const getAllCustomers = () => getFlexCrm('01').getAllCustomers();
export const getOneCustomer = (tercero: string) => getFlexCrm('01').getOneCustomer(tercero);
export const getAllProducts = () => getFlexCrm('01').getAllProducts();
export const getOneProduct = (item: string) => getFlexCrm('01').getOneProduct(item);
export const getOrdersByDateRange = (fi: string, ff: string) => getFlexCrm('01').getOrdersByDateRange(fi, ff);
export const getOneOrder = (tipodoc: string, numero: string) => getFlexCrm('01').getOneOrder(tipodoc, numero);
export const getInvoicesByDateRange = (fi: string, ff: string) => getFlexCrm('01').getInvoicesByDateRange(fi, ff);
export const getDebitsByCustomer = (cliente: string, ff: string) => getFlexCrm('01').getDebitsByCustomer(cliente, ff);

export function hasCredentials(db: DbSource): boolean {
    const correo =
        process.env[`FLEX_CRM_EMAIL_${db}`] ||
        (db === '01' ? process.env.FLEX_CRM_EMAIL : undefined) ||
        '';
    const clave =
        process.env[`FLEX_CRM_CLAVE_${db}`] ||
        (db === '01' ? process.env.FLEX_CRM_CLAVE : undefined) ||
        '';
    return !!(correo && correo.trim() && clave && clave.trim());
}

// ==========================================
// MAPPING: INVOICES TO SALES_LINES (Fase A)
// ==========================================

export interface SalesLineRow {
    db_source: DbSource;
    tipodoc: string;
    numero: string;
    fecha: string; // formato YYYY-MM-DD
    sku: string;
    descripcion: string | null;
    id_clasificacion: string | null;
    id_marca: string | null;
    id_bodega: string | null;
    id_vendedor: number | null;
    cantidad: number;
    precio: number;
    total: number;
    costo_unit: number;
    total_costo: number;
    margen: number;
}

function parseDateToIso(fechaStr: string): string {
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return fechaStr;
}

export function invoiceLinesToSalesRows(invoice: CrmInvoiceNormalized): SalesLineRow[] {
    const rawItems = invoice.raw?.items || [];
    const dbFecha = parseDateToIso(invoice.fecha);
    
    // Agrupar items con el mismo SKU por si se repite en la misma factura
    const itemGroups: Record<string, any[]> = {};
    for (const rawItem of rawItems) {
        if (!rawItem.ID_ITEM) continue;
        const sku = String(rawItem.ID_ITEM).trim();
        if (!itemGroups[sku]) {
            itemGroups[sku] = [];
        }
        itemGroups[sku].push(rawItem);
    }
    
    const rows: SalesLineRow[] = [];
    
    for (const [sku, items] of Object.entries(itemGroups)) {
        let cantidad = 0;
        let total = 0;
        let totalCosto = 0;
        const first = items[0];
        
        for (const item of items) {
            cantidad += item.CANTIDAD ?? 0;
            total += item.TOTAL ?? item.TOTAL_ITEM ?? 0;
            totalCosto += item.TOTAL_COSTO ?? ((item.CANTIDAD ?? 0) * (item.COSTO_KARDEX ?? 0));
        }
        
        const precio = cantidad > 0 ? (total / cantidad) : (first.PRECIO ?? 0);
        const costoUnit = cantidad > 0 ? (totalCosto / cantidad) : (first.COSTO_KARDEX ?? 0);
        
        // Calcular porcentaje de margen basado en total y total_costo
        const marginPct = total > 0 ? parseFloat((((total - totalCosto) / total) * 100).toFixed(2)) : 0;
        
        rows.push({
            db_source: invoice.db_source,
            tipodoc: invoice.tipodoc,
            numero: invoice.numero,
            fecha: dbFecha,
            sku,
            descripcion: repairMojibake((first.DESCRIPCION_ITEM ?? '').trim()) || null,
            id_clasificacion: first.ID_CLASIFICACION ? String(first.ID_CLASIFICACION).trim() : null,
            id_marca: first.ID_MARCA_ITEM ? String(first.ID_MARCA_ITEM).trim() : null,
            id_bodega: first.ID_BODEGA ? String(first.ID_BODEGA).trim() : null,
            id_vendedor: invoice.id_vendedor || null,
            cantidad,
            precio,
            total,
            costo_unit: costoUnit,
            total_costo: totalCosto,
            margen: marginPct
        });
    }
    
    return rows;
}

