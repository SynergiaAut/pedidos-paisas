/**
 * FlexCrmClient — Cliente HTTP para la API Flex CRM / Millenium Enterprise
 * Base URL: https://me.services.ibla.co
 *
 * Auth: Header `token: <JWT>` obtenido desde POST /crm/empresa/login
 * El token se renueva automáticamente antes de expirar.
 */

const BASE_URL = process.env.FLEX_CRM_URL || 'https://me.services.ibla.co';
const CRM_EMAIL = process.env.FLEX_CRM_EMAIL || '';
const CRM_CLAVE = process.env.FLEX_CRM_CLAVE || '';

// ==========================================
// TIPOS
// ==========================================

export interface CrmCustomer {
    tercero: string;
    nombre: string;
    ciudad: string;
    telefono: string;
    email: string;
}

export interface CrmProduct {
    item: string;
    descripcion: string;
    precio: number;
    existencia: number;
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

// ==========================================
// SINGLETON CON TOKEN EN MEMORIA
// ==========================================

let cachedToken: string | null = null;
let tokenExpiry: number = 0; // timestamp ms

/**
 * Obtiene el token activo o realiza login si expiró.
 * El JWT dura ~15 días — renovamos cuando queden menos de 24h.
 */
async function getToken(): Promise<string> {
    const now = Date.now();
    const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 horas antes del vencimiento

    if (cachedToken && now < tokenExpiry - REFRESH_THRESHOLD_MS) {
        return cachedToken;
    }

    // Login o renovación
    console.log('[FlexCRM] Autenticando en Flex CRM API...');
    const res = await fetch(`${BASE_URL}/crm/empresa/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: CRM_EMAIL, clave: CRM_CLAVE }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`[FlexCRM] Login fallido: ${err}`);
    }

    const data = await res.json();
    if (!data.ok || !data.token) {
        throw new Error(`[FlexCRM] Login fallido: ${data.message}`);
    }

    // Decodificamos el payload del JWT para saber cuándo expira
    const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
    cachedToken = data.token;
    tokenExpiry = payload.exp * 1000; // exp viene en segundos

    console.log(`[FlexCRM] ✅ Token obtenido. Expira: ${new Date(tokenExpiry).toISOString()}`);
    return cachedToken as string;
}

/**
 * Función base para todas las llamadas autenticadas a la API
 */
async function crmPost<T>(path: string, body: object = {}): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'token': token,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
        throw new Error(`[FlexCRM] Error en ${path}: ${data.message || res.statusText}`);
    }

    return data;
}

// ==========================================
// MÓDULO: CLIENTES
// ==========================================

export async function getAllCustomers(): Promise<CrmCustomer[]> {
    console.log('[FlexCRM] → GET all customers');
    const data = await crmPost<{ customers: CrmCustomer[] }>('/crm/all/customer');
    return data.customers;
}

export async function getOneCustomer(tercero: string): Promise<CrmCustomer | null> {
    console.log(`[FlexCRM] → GET customer: ${tercero}`);
    const data = await crmPost<{ customers: CrmCustomer[] }>('/crm/one/customer', { tercero });
    return data.customers?.[0] ?? null;
}

// ==========================================
// MÓDULO: PRODUCTOS
// ==========================================

export async function getAllProducts(): Promise<CrmProduct[]> {
    console.log('[FlexCRM] → GET all products');
    const data = await crmPost<{ products: CrmProduct[] }>('/crm/all/product');
    return data.products;
}

export async function getOneProduct(item: string): Promise<CrmProduct | null> {
    console.log(`[FlexCRM] → GET product: ${item}`);
    const data = await crmPost<{ products: CrmProduct[] }>('/crm/one/product', { item });
    return data.products?.[0] ?? null;
}

// ==========================================
// MÓDULO: PEDIDOS
// ==========================================

export async function getOrdersByDateRange(fechainicial: string, fechafinal: string): Promise<CrmOrder[]> {
    console.log(`[FlexCRM] → GET orders: ${fechainicial} → ${fechafinal}`);
    const data = await crmPost<{ pedidos: CrmOrder[] }>('/crm/all/order', { fechainicial, fechafinal });
    return data.pedidos;
}

export async function getOneOrder(tipodoc: string, numero: string): Promise<CrmOrder | null> {
    console.log(`[FlexCRM] → GET order: ${tipodoc}/${numero}`);
    const data = await crmPost<{ pedidos: CrmOrder[] }>('/crm/one/order', { tipodoc, numero });
    return data.pedidos?.[0] ?? null;
}

// ==========================================
// MÓDULO: FACTURAS
// ==========================================

export async function getInvoicesByDateRange(fechainicial: string, fechafinal: string): Promise<CrmInvoice[]> {
    console.log(`[FlexCRM] → GET invoices: ${fechainicial} → ${fechafinal}`);
    const data = await crmPost<{ invoices: CrmInvoice[] }>('/crm/all/invoice', { fechainicial, fechafinal });
    return data.invoices;
}

// ==========================================
// MÓDULO: CARTERA
// ==========================================

export async function getDebitsByCustomer(cliente: string, fechafinal: string): Promise<CrmDebit[]> {
    console.log(`[FlexCRM] → GET debits for customer: ${cliente}`);
    const data = await crmPost<{ debits: CrmDebit[] }>('/crm/one/debit', { cliente, fechafinal });
    return data.debits;
}
