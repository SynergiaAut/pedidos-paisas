'use server';

import { createClient } from '@/utils/supabase/server';
import { getFlexCrm, hasCredentials } from '@/lib/flex-crm';
import { repairMojibake } from '@/lib/flex-crm';

const VENDEDOR_ID = Number(process.env.PEDIDOS_ID_VENDEDOR || '1112223087');

// Obtener fecha YYYY-MM-DD en UTC-5 (Colombia)
function getColombiaDateString(d: Date = new Date()): string {
    const colombiaOffset = -5 * 60; // en minutos
    const localTime = d.getTime();
    const localOffset = d.getTimezoneOffset(); // en minutos
    const utcTime = localTime + (localOffset * 60 * 1000);
    const colombiaTime = new Date(utcTime + (colombiaOffset * 60 * 1000));
    
    const year = colombiaTime.getFullYear();
    const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(colombiaTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const generateOrderId = () => `PED-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}A`;

type PedidoChannel = 'WHATSAPP' | 'MOSTRADOR' | 'TELEFONO' | 'OTRO';

async function getCurrentWatermark() {
    const fechaHoy = getColombiaDateString();
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const fechaDesde = getColombiaDateString(d);

    let watermark01 = 0;
    let watermark02 = 0;

    try {
        const crm01 = getFlexCrm('01');
        const invoices01 = await crm01.getInvoices(fechaDesde, fechaHoy);
        const vInvoices01 = invoices01.filter(i => i.id_vendedor === VENDEDOR_ID);
        if (vInvoices01.length > 0) {
            watermark01 = Math.max(...vInvoices01.map(i => Number(i.numero)));
        }
    } catch (e) {
        console.error('[getCurrentWatermark] Error obteniendo watermark BD1:', e);
    }

    if (hasCredentials('02')) {
        try {
            const crm02 = getFlexCrm('02');
            const invoices02 = await crm02.getInvoices(fechaDesde, fechaHoy);
            const vInvoices02 = invoices02.filter(i => i.id_vendedor === VENDEDOR_ID);
            if (vInvoices02.length > 0) {
                watermark02 = Math.max(...vInvoices02.map(i => Number(i.numero)));
            }
        } catch (e) {
            console.warn('[getCurrentWatermark] Advertencia obteniendo watermark BD2:', e instanceof Error ? e.message : e);
        }
    } else {
        console.log('[getCurrentWatermark] BD2 (PAISASFISCAL) omitida por falta de credenciales.');
    }

    return { "01": watermark01, "02": watermark02 };
}

export async function listOpenPedidoSessions() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('pedido_sessions')
        .select('*')
        .eq('status', 'ABIERTA')
        .order('last_active_at', { ascending: false });

    if (error) {
        return { success: false, error: error.message, sessions: [] };
    }

    return { success: true, sessions: data || [] };
}

export async function touchPedidoSession(sessionId: string) {
    const supabase = await createClient();
    await supabase
        .from('pedido_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('status', 'ABIERTA');
}

export async function openPedidoSession(options?: {
    forceNew?: boolean;
    draftLabel?: string;
    sourceChannel?: PedidoChannel;
    customerHint?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const forceNew = options?.forceNew === true;

    // Compatibilidad: si no se fuerza nueva, retomar el borrador abierto más reciente.
    const { data: existingSession } = !forceNew ? await supabase
        .from('pedido_sessions')
        .select('*')
        .eq('status', 'ABIERTA')
        .order('last_active_at', { ascending: false })
        .limit(1)
        .maybeSingle() : { data: null };

    if (existingSession && !forceNew) {
        return { success: true, session: existingSession };
    }

    const watermark = await getCurrentWatermark();

    const { data: session, error } = await supabase
        .from('pedido_sessions')
        .insert({
            id_vendedor: VENDEDOR_ID,
            watermark,
            opened_by: user?.id || null,
            status: 'ABIERTA',
            draft_label: options?.draftLabel?.trim() || null,
            source_channel: options?.sourceChannel || 'WHATSAPP',
            customer_hint: options?.customerHint?.trim() || null,
            last_active_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[openPedidoSession] Error creando sesión:', error);
        return { success: false, error: error.message };
    }

    return { success: true, session };
}

export async function pollPedidoInvoices(sessionId: string) {
    try {
        const supabase = await createClient();

        // 1. Obtener la sesión activa
        const { data: session, error: sessionError } = await supabase
            .from('pedido_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session || session.status !== 'ABIERTA') {
            return { success: false, error: 'Sesión no válida o cerrada', errors: [] };
        }

        await touchPedidoSession(sessionId);

        const watermark = session.watermark || {};
        const wm01 = Number(watermark["01"] || 0);
        const wm02 = Number(watermark["02"] || 0);

        const fechaHoy = getColombiaDateString();
        const detected: import('@/lib/flex-crm').CrmInvoiceNormalized[] = [];
        const errors: string[] = [];

        // Polling BD1
        try {
            const crm01 = getFlexCrm('01');
            const invoices01 = await crm01.getInvoices(fechaHoy, fechaHoy);
            const filtered01 = invoices01.filter(
                (i) => i.id_vendedor === VENDEDOR_ID && Number(i.numero) > wm01
            );
            detected.push(...filtered01);
        } catch (e: unknown) {
            const msg = `Error BD1: ${e instanceof Error ? e.message : String(e)}`;
            console.error('[pollPedidoInvoices]', msg);
            errors.push(msg);
        }

        // Polling BD2 (Solo si tiene credenciales configuradas)
        if (hasCredentials('02')) {
            try {
                const crm02 = getFlexCrm('02');
                const invoices02 = await crm02.getInvoices(fechaHoy, fechaHoy);
                const filtered02 = invoices02.filter(
                    (i) => i.id_vendedor === VENDEDOR_ID && Number(i.numero) > wm02
                );
                detected.push(...filtered02);
            } catch (e: unknown) {
                const msg = `Error BD2: ${e instanceof Error ? e.message : String(e)}`;
                console.warn('[pollPedidoInvoices] Advertencia BD2 (puede estar inactiva):', msg);
                errors.push(msg);
            }
        } else {
            errors.push('Información: BD2 (PAISASFISCAL) omitida por falta de credenciales.');
        }

        if (detected.length === 0) {
            return { success: true, count: 0, errors };
        }

        // 2. Realizar upsert en la tabla staging pedido_invoices
        const invoicesToInsert = detected.map(inv => ({
            session_id: sessionId,
            db_source: inv.db_source,
            tipodoc: inv.tipodoc,
            numero: inv.numero,
            fecha: inv.fecha,
            id_vendedor: inv.id_vendedor,
            nombre_tercero: inv.nombre_tercero,
            total: inv.total,
            raw: inv.raw,
            status: 'DETECTADA'
        }));

        const { error: upsertError } = await supabase
            .from('pedido_invoices')
            .upsert(invoicesToInsert, {
                onConflict: 'db_source,tipodoc,numero',
                ignoreDuplicates: true // Preserva cambios en el status
            });

        if (upsertError) {
            console.error('[pollPedidoInvoices] Error en upsert de facturas:', upsertError);
            return { success: false, error: upsertError.message, errors };
        }

        return { success: true, count: detected.length, errors };
    } catch (error: unknown) {
        console.error('[pollPedidoInvoices] Error catastrófico en poller:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            errors: [error instanceof Error ? error.message : String(error)]
        };
    }
}

export async function confirmInvoice(invoiceId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('pedido_invoices')
        .update({ status: 'CONFIRMADA' })
        .eq('id', invoiceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function discardInvoice(invoiceId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('pedido_invoices')
        .update({ status: 'IGNORADA' })
        .eq('id', invoiceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function removeInvoice(invoiceId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('pedido_invoices')
        .update({ status: 'DETECTADA' })
        .eq('id', invoiceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function pullLatestInvoices(sessionId: string) {
    const supabase = await createClient();
    const fechaHoy = getColombiaDateString();
    const detected: import('@/lib/flex-crm').CrmInvoiceNormalized[] = [];
    const errors: string[] = [];

    // BD1
    try {
        const crm01 = getFlexCrm('01');
        const invoices01 = await crm01.getInvoices(fechaHoy, fechaHoy);
        const filtered01 = invoices01.filter(i => i.id_vendedor === VENDEDOR_ID);
        detected.push(...filtered01);
    } catch (e: unknown) {
        errors.push(`Error BD1: ${e instanceof Error ? e.message : String(e)}`);
    }

    // BD2 (Solo si tiene credenciales configuradas)
    if (hasCredentials('02')) {
        try {
            const crm02 = getFlexCrm('02');
            const invoices02 = await crm02.getInvoices(fechaHoy, fechaHoy);
            const filtered02 = invoices02.filter(i => i.id_vendedor === VENDEDOR_ID);
            detected.push(...filtered02);
        } catch (e: unknown) {
            errors.push(`Error BD2: ${e instanceof Error ? e.message : String(e)}`);
        }
    } else {
        errors.push('Información: BD2 (PAISASFISCAL) omitida por falta de credenciales.');
    }

    if (detected.length === 0) {
        return { success: true, count: 0, errors };
    }

    const invoicesToInsert = detected.map(inv => ({
        session_id: sessionId,
        db_source: inv.db_source,
        tipodoc: inv.tipodoc,
        numero: inv.numero,
        fecha: inv.fecha,
        id_vendedor: inv.id_vendedor,
        nombre_tercero: inv.nombre_tercero,
        total: inv.total,
        raw: inv.raw,
        status: 'DETECTADA'
    }));

    const { error: upsertError } = await supabase
        .from('pedido_invoices')
        .upsert(invoicesToInsert, {
            onConflict: 'db_source,tipodoc,numero',
            ignoreDuplicates: true
        });

    if (upsertError) {
        return { success: false, error: upsertError.message, errors };
    }

    return { success: true, count: detected.length, errors };
}

export async function closePedido(
    sessionId: string,
    clientData: {
        id?: string;
        name: string;
        phone?: string;
        address?: string;
        deliveryType: 'DOMICILIO' | 'TIENDA';
        observations?: string;
    }
) {
    const supabase = await createClient();

    // 1. Obtener la sesión activa
    const { data: session, error: sessionError } = await supabase
        .from('pedido_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session || session.status !== 'ABIERTA') {
        return { success: false, error: 'Sesión no válida o ya cerrada.' };
    }

    // 2. Obtener las facturas CONFIRMADAS de esta sesión
    const { data: confirmedInvoices, error: fetchError } = await supabase
        .from('pedido_invoices')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'CONFIRMADA');

    if (fetchError) {
        return { success: false, error: fetchError.message };
    }

    if (!confirmedInvoices || confirmedInvoices.length === 0) {
        return { success: false, error: 'Debe confirmar al menos una factura para cerrar el pedido.' };
    }

    // 3. Consolidar productos e invoices_data
    const products: { name: string; qty: number; price: number; total: number; type: string }[] = [];
    const invoicesData: { code: string; value: string }[] = [];
    let totalValue = 0;

    for (const inv of confirmedInvoices) {
        const db = inv.db_source;
        const totalFactura = Number(inv.total);
        totalValue += totalFactura;

        invoicesData.push({
            code: `${db === '01' ? 'BD1' : 'BD2'} - ${inv.tipodoc}-${inv.numero}`,
            value: String(totalFactura)
        });

        // Los items están en inv.raw.items
        const rawInvoice = inv.raw as unknown as import('@/lib/flex-crm').CrmInvoiceRaw;
        const items = rawInvoice?.items || [];
        for (const item of items) {
            products.push({
                name: repairMojibake(item.DESCRIPCION_ITEM || ''),
                qty: Number(item.CANTIDAD || 0),
                price: Number(item.PRECIO || 0),
                total: Number(item.TOTAL ?? item.TOTAL_ITEM ?? 0),
                type: db === '01' ? 'BD1' : 'BD2'
            });
        }
    }

    // Formatear observaciones finales
    let finalObs = clientData.observations || '';
    if (clientData.deliveryType === 'DOMICILIO' && clientData.address) {
        finalObs = `[ENTREGA EN: ${clientData.address}] ${finalObs}`.trim();
    }

    // 4. Crear el registro en public.orders
    const orderId = generateOrderId();
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            public_id: orderId,
            client_name: clientData.name,
            client_id: clientData.id || null,
            total_value: totalValue,
            observations: finalObs,
            status: 'TOMADO',
            delivery_type: clientData.deliveryType,
            driver_id: null,
            invoices_data: invoicesData,
            products: products
        })
        .select()
        .single();

    if (orderError) {
        console.error('[closePedido] Error insertando orden:', orderError);
        return { success: false, error: orderError.message };
    }

    // 5. Actualizar la sesión
    const { error: sessionUpdateError } = await supabase
        .from('pedido_sessions')
        .update({
            status: 'CERRADA',
            order_id: order.id
        })
        .eq('id', sessionId);

    if (sessionUpdateError) {
        console.error('[closePedido] Error cerrando sesión:', sessionUpdateError);
        // Retornamos éxito parcial porque la orden fue creada
        return { success: true, orderId: order.id, warning: 'No se pudo cerrar la sesión de captura.' };
    }

    return { success: true, orderId: order.id };
}

export async function simulateInvoiceDetection(sessionId: string) {
    const supabase = await createClient();

    // 1. Obtener la sesión activa
    const { data: session } = await supabase
        .from('pedido_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (!session || session.status !== 'ABIERTA') {
        return { success: false, error: 'Sesión no válida o cerrada' };
    }

    const numSimulado = Math.floor(Math.random() * 1000000);

    const rawSimulado = {
        FECHA: getColombiaDateString(),
        ID_TIPO_DOC: "POS",
        NUMERO: numSimulado,
        ID_TERCERO: 1,
        NOMBRE_TERCERO: "SIMULACION TERCE®O",
        ID_VENDEDOR: VENDEDOR_ID,
        NOMBRE_VENDEDOR: "VENDEDOR SIMULADO",
        items: [
            {
                ID_ITEM: "2202012",
                DESCRIPCION_ITEM: "GATORADE  X 12 UND (SIMULADO)",
                CANTIDAD: 2,
                PRECIO: 31000,
                TOTAL_ITEM: 62000,
                TOTAL: 62000,
                ID_BODEGA: "01"
            },
            {
                ID_ITEM: "302040",
                DESCRIPCION_ITEM: "GRANEL Q IDACAT GATO X LB (SIMULADO)",
                CANTIDAD: 1,
                PRECIO: 4000,
                TOTAL_ITEM: 4000,
                TOTAL: 4000,
                ID_BODEGA: "01"
            }
        ]
    };

    const invoiceSimulado = {
        session_id: sessionId,
        db_source: '01',
        tipodoc: 'POS',
        numero: String(numSimulado),
        fecha: rawSimulado.FECHA,
        id_vendedor: VENDEDOR_ID,
        nombre_tercero: rawSimulado.NOMBRE_TERCERO,
        total: 66000,
        raw: rawSimulado,
        status: 'DETECTADA'
    };

    const { data, error } = await supabase
        .from('pedido_invoices')
        .insert(invoiceSimulado)
        .select()
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, invoice: data };
}
