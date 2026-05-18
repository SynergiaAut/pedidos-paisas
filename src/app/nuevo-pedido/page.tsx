"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { MapPin, Save, Printer, RefreshCw, Loader2, Truck, Store, User, Phone, Hash, ShoppingBag, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientSearch } from "@/components/ClientSearch";
import { Client } from "@/types/order";
import { toast } from "sonner";
import Link from "next/link";
import { ConsolidateOrderBanner } from "@/components/orders/ConsolidateOrderBanner";
import { consolidateOrder } from "@/app/actions/orders";

const generateOrderId = () => `PED-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}A`;


// Define Product Interface
interface ProductItem {
    name: string;
    qty: number;
    price: number;
    type: string;
}

export const dynamic = 'force-dynamic';

export default function PedidosPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <PedidosContent />
        </Suspense>
    );
}

function PedidosContent() {
    // 1. Hooks & Router State
    const router = useRouter();
    const searchParams = useSearchParams();
    const eventId = searchParams.get('event_id');
    const eventId2 = searchParams.get('event_id2'); // Second invoice event (optional)

    // 2. Core State
    const [orderId, setOrderId] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingEvent, setIsLoadingEvent] = useState(!!(eventId || eventId2));

    // 3. Form Configuration
    const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "TIENDA">("DOMICILIO");
    const [mounted, setMounted] = useState(false);

    // 4. Form Data
    const [inv1Code, setInv1Code] = useState("");
    const [inv1Value, setInv1Value] = useState("");
    const [inv2Code, setInv2Code] = useState("");
    const [inv2Value, setInv2Value] = useState("");

    const [products, setProducts] = useState<ProductItem[]>([]);

    // 5. Client & Context
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientName, setClientName] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [observations, setObservations] = useState("");

    // 6. Consolidation state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [existingOrder, setExistingOrder] = useState<any | null>(null);
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [consolidationDismissed, setConsolidationDismissed] = useState(false);

    // 6. Helpers
    const loadInvoiceEvent = async (id: string, id2?: string | null) => {
        setIsLoadingEvent(true);
        try {
            // Fetch both events concurrently
            const queries = [id, id2].filter(Boolean).map(eid =>
                supabase.from('invoice_events').select('*').eq('id', eid!).single()
            );
            const results = await Promise.all(queries);

            const event1 = results[0]?.data;
            const event2 = results[1]?.data ?? null;

            if (!event1) {
                toast.error("No se pudo cargar la información de la factura.");
                return;
            }

            // Populate Invoice 1 always from event1.invoice_number_1
            setInv1Code(event1.invoice_number_1 || "");
            setInv1Value(event1.invoice_value_1?.toString() || "");

            if (event2) {
                // Two separate events → inv2 comes from event2
                setInv2Code(event2.invoice_number_1 || "");
                setInv2Value(event2.invoice_value_1?.toString() || "");
            } else {
                // Single event with both invoices embedded
                setInv2Code(event1.invoice_number_2 || "");
                setInv2Value(event1.invoice_value_2?.toString() || "");
            }

            // Merge products from both events
            const products1 = Array.isArray(event1.products) ? event1.products : [];
            const products2 = event2 && Array.isArray(event2.products) ? event2.products : [];
            const merged = [...products1, ...products2];
            if (merged.length > 0) setProducts(merged);

            toast.success(event2 ? "2 facturas pre-cargadas correctamente." : "Datos pre-cargados correctamente.");
        } catch (err) {
            console.error("Error loading event:", err);
            toast.error("Error al cargar datos de la factura.");
        } finally {
            setIsLoadingEvent(false);
        }
    };

    // 7. Effects
    useEffect(() => {
        setMounted(true);
        setOrderId(generateOrderId());
    }, []);

    useEffect(() => {
        if (eventId) {
            loadInvoiceEvent(eventId, eventId2);
        }
    }, [eventId, eventId2]);

    const totalValue = React.useMemo(() => {
        // Prefer sum of products if available and matches invoices?
        // Or just trust the manual values? 
        // Let's stick to the manual invoice values as source of truth for the money connection
        const v1 = parseFloat(inv1Value.replace(/[^0-9.]/g, "") || "0");
        const v2 = parseFloat(inv2Value.replace(/[^0-9.]/g, "") || "0");
        return v1 + v2;
    }, [inv1Value, inv2Value]);

    const resetForm = () => {
        if (eventId) {
            router.push('/nuevo-pedido'); // clear params
        } else {
            setOrderId(generateOrderId());
            setInv1Code("");
            setInv1Value("");
            setInv2Code("");
            setInv2Value("");
            setProducts([]);
            setSelectedClient(null);
            setClientName("");
            setDeliveryAddress("");
            setObservations("");
            setDeliveryType("DOMICILIO");
        }
    };

    /**
     * When a client is selected from the CRM, check for any active (non-delivered)
     * orders for that client. If found, surface the consolidation banner.
     */
    const handleClientSelect = async (client: Client) => {
        setSelectedClient(client);
        setClientName(client.full_name);
        if (client.address) setDeliveryAddress(client.address);

        // Reset consolidation state
        setExistingOrder(null);
        setConsolidationDismissed(false);

        if (!client.id) return; // Anonymous client, skip check

        const { data } = await supabase
            .from('orders')
            .select('id, public_id, status, invoices_data, client_name')
            .eq('client_id', client.id)
            .not('status', 'in', '("ENTREGADO","CANCELADO")')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data) {
            setExistingOrder(data);
        }
    };

    /**
     * User chose to merge the current invoices into the existing order.
     */
    const handleConsolidate = async () => {
        if (!existingOrder) return;
        setIsConsolidating(true);

        const newInvoices = [
            { code: inv1Code, value: inv1Value },
            { code: inv2Code, value: inv2Value },
        ].filter(inv => inv.code || inv.value);

        let finalObs = observations;
        if (deliveryType === 'DOMICILIO' && deliveryAddress) {
            finalObs = `[ENTREGA EN: ${deliveryAddress}] ${finalObs}`.trim();
        }

        const result = await consolidateOrder({
            existingOrderId: existingOrder.id,
            newInvoices,
            newProducts: products,
            newObservations: finalObs || undefined,
        });

        if (!result.success) {
            toast.error(`Error al consolidar: ${result.error}`);
            setIsConsolidating(false);
            return;
        }

        // Mark invoice events as PROCESSED
        if (eventId || eventId2) {
            const ids = [eventId, eventId2].filter(Boolean) as string[];
            await supabase.from('invoice_events').update({ status: 'PROCESSED' }).in('id', ids);
        }

        setIsConsolidating(false);
        if (result.capped) {
            toast.warning(`Pedido actualizado. Solo se agregaron ${result.addedCount} facturas (límite de 4 alcanzado).`);
        } else {
            toast.success(`✅ Facturas agregadas al pedido ${existingOrder.public_id}. Total: ${result.totalInvoices} factura(s).`);
        }

        setTimeout(() => router.push('/pedidos'), 1200);
    };

    /** User chose to create a separate new order — dismiss banner and continue normally. */
    const handleConsolidationDismiss = () => {
        setExistingOrder(null);
        setConsolidationDismissed(true);
    };

    const handleSaveOrder = async () => {
        if (!clientName || totalValue <= 0) {
            toast.warning("Por favor completa el nombre del cliente y verifica los valores.");
            return;
        }

        setIsSaving(true);

        // Helper to format final observations
        let finalObs = observations;
        if (deliveryType === 'DOMICILIO' && deliveryAddress) {
            finalObs = `[ENTREGA EN: ${deliveryAddress}] ${finalObs}`.trim();
        }

        // 1. Create Order
        const { data: orderData, error: orderError } = await supabase.from('orders').insert({
            public_id: orderId,
            client_name: clientName,
            client_id: selectedClient?.id, // Link to client if selected
            total_value: totalValue,
            observations: finalObs,
            status: 'TOMADO',
            delivery_type: deliveryType,
            driver_id: null,
            invoices_data: [
                { code: inv1Code, value: inv1Value },
                { code: inv2Code, value: inv2Value }
            ],
            products: products // Now saving products!
        }).select().single();

        if (orderError) {
            console.error(orderError);
            toast.error(`Error al guardar: ${orderError.message}`);
            setIsSaving(false);
            return;
        }

        // 2. Mark invoice events as PROCESSED (both if two were captured)
        if (orderData) {
            const eventIds = [eventId, eventId2].filter(Boolean) as string[];
            if (eventIds.length > 0) {
                const { error: evtError } = await supabase
                    .from('invoice_events')
                    .update({ status: 'PROCESSED' })
                    .in('id', eventIds);
                if (evtError) {
                    console.warn('Could not mark invoice events as processed:', evtError.message);
                }
            }
        }

        setIsSaving(false);
        toast.success("Pedido creado exitosamente");

        // Auto-print receipt
        setTimeout(() => {
            window.print();
        }, 100);

        // Redirect after print dialog has time to open
        setTimeout(() => {
            router.push("/pedidos");
        }, 1500);
    };

    if (isLoadingEvent) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Cargando datos de factura...</span>
            </div>
        );
    }

    return (
        <div data-form className="grid gap-8 lg:grid-cols-12 max-w-6xl mx-auto py-6 px-4 md:px-0">
            {/* Header */}
            <div className="lg:col-span-12 flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/pedidos" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Nuevo Pedido</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="font-mono bg-brand/10 text-brand-DEFAULT border-brand/20 border px-2 py-0.5 rounded font-bold">{orderId}</span>
                            {eventId && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Printer className="w-3 h-3" /> Auto-Captura
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-brand flex items-center gap-1 transition-colors">
                    <RefreshCw className="h-3 w-3" /> Reiniciar
                </button>
            </div>

            <div className="lg:col-span-7 space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">

                {/* Invoice Inputs */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Invoice 1 */}
                    <div className={cn("space-y-4 rounded-lg border p-4 transition-all bg-card")}>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Factura 1</h3>
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Código</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring uppercase placeholder:normal-case font-mono"
                                value={inv1Code}
                                onChange={(e) => setInv1Code(e.target.value.toUpperCase())}
                                placeholder="Ej: FE-1234"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Valor</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">$</span>
                                <input
                                    type="text"
                                    className="flex h-12 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-right font-mono font-bold text-green-600"
                                    value={inv1Value}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        setInv1Value(raw);
                                    }}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                    </div>


                    {/* Invoice 2 */}
                    <div className={cn("space-y-4 rounded-lg border p-4 transition-all bg-card")}>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Factura 2 (Interna)</h3>
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Código</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring uppercase placeholder:normal-case font-mono"
                                value={inv2Code}
                                onChange={(e) => setInv2Code(e.target.value.toUpperCase())}
                                placeholder="Ej: INT-999"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Valor</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">$</span>
                                <input
                                    type="text"
                                    className="flex h-12 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-right font-mono font-bold text-green-600"
                                    value={inv2Value}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        setInv2Value(raw);
                                    }}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Products List */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4" /> Productos ({products.length})
                        </h3>
                        {/* Future: Add product manually button */}
                    </div>

                    {products.length > 0 ? (
                        <div className="rounded-md border bg-muted/20 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Cant</th>
                                        <th className="px-3 py-2 text-left">Producto</th>
                                        <th className="px-3 py-2 text-right">Precio Un.</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {products.map((p, i) => (
                                        <tr key={i} className="hover:bg-muted/30">
                                            <td className="px-3 py-2 font-mono">{p.qty}</td>
                                            <td className="px-3 py-2 font-medium">
                                                {p.name}
                                                {p.type !== 'DIAN' && <span className="text-[10px] text-muted-foreground ml-1 p-0.5 border rounded uppercase">{p.type}</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">${p.price.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono font-medium">${(p.qty * p.price).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/5">
                            No hay productos detallados.
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Controls */}
            <div className="lg:col-span-5 space-y-6">
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm sticky top-24">
                    <div className="flex flex-col space-y-1.5 p-6 border-b bg-muted/20">
                        <h3 className="text-lg font-semibold leading-none tracking-tight">Resumen y Cliente</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Delivery Type Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-muted/20 p-1 rounded-lg">
                            <button
                                onClick={() => setDeliveryType("DOMICILIO")}
                                className={cn("flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs font-semibold transition-all", deliveryType === 'DOMICILIO' ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/50")}
                            >
                                <Truck className="h-4 w-4" />
                                Domicilio
                            </button>
                            <button
                                onClick={() => setDeliveryType("TIENDA")}
                                className={cn("flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs font-semibold transition-all", deliveryType === 'TIENDA' ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/50")}
                            >
                                <Store className="h-4 w-4" />
                                Recoge en Tienda
                            </button>
                        </div>

                        {/* Client Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Cliente</label>
                            {selectedClient ? (
                                <div className="rounded-md border p-3 bg-blue-50/50 dark:bg-blue-950/20 relative group border-blue-100 dark:border-blue-900">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <div className="font-bold text-sm text-blue-900 dark:text-blue-100">{selectedClient.full_name}</div>
                                            <div className="flex flex-col gap-0.5 mt-1 text-xs text-blue-700 dark:text-blue-300">
                                                {selectedClient.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedClient.phone}</div>}
                                                {selectedClient.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedClient.address}</div>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedClient(null);
                                                setClientName("");
                                                if (deliveryAddress === selectedClient.address) setDeliveryAddress("");
                                            }}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium bg-white dark:bg-black px-2 py-1 rounded border shadow-sm"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <ClientSearch
                                    onSelect={handleClientSelect}
                                    className="[&_input]:tabindex-1"
                                />
                            )}
                        </div>

                        {/* Consolidation Banner — shown when active order exists for this client */}
                        {existingOrder && !consolidationDismissed && (
                            <ConsolidateOrderBanner
                                existingOrder={existingOrder}
                                newInvoices={[
                                    { code: inv1Code, value: inv1Value },
                                    { code: inv2Code, value: inv2Value },
                                ].filter(inv => inv.code || inv.value)}
                                onConsolidate={handleConsolidate}
                                onCreateNew={handleConsolidationDismiss}
                                isLoading={isConsolidating}
                            />
                        )}

                        {/* Address Input (Contextual) */}
                        {deliveryType === 'DOMICILIO' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> Dirección de Entrega
                                </label>
                                <input
                                    tabIndex={2}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand uppercase placeholder:normal-case font-medium"
                                    value={deliveryAddress}
                                    onChange={(e) => setDeliveryAddress(e.target.value.toUpperCase())}
                                    placeholder="DIRECCIÓN COMPLETA..."
                                />
                            </div>
                        )}

                        {/* Observations */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Observaciones</label>
                            <textarea
                                tabIndex={3}
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand uppercase placeholder:normal-case resize-none"
                                value={observations}
                                onChange={(e) => setObservations(e.target.value.toUpperCase())}
                                placeholder="Escribe aquí observaciones adicionales..."
                            />
                        </div>

                        {/* Total & Action */}
                        <div className="pt-4 border-t flex items-center justify-between">
                            <span className="font-bold text-lg">Total a Pagar</span>
                            <span className="text-2xl font-bold text-brand font-mono">
                                ${totalValue.toLocaleString()}
                            </span>
                        </div>

                        <button
                            tabIndex={4}
                            onClick={handleSaveOrder}
                            disabled={isSaving}
                            className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand text-black hover:bg-brand/90 hover:scale-105 active:scale-95 h-12 px-8 shadow-lg shadow-brand/20"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Crear Pedido e Imprimir
                        </button>
                    </div>
                </div>
            </div>

            {/* PRINT RECEIPT (Hidden on Screen) */}
            <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-4 text-black font-mono">
                <div className="max-w-[80mm] mx-auto border-2 border-black p-4">
                    <div className="text-center mb-4">
                        <h1 className="text-xl font-bold uppercase">Pedidos Paisas</h1>
                        <p className="text-sm">Ticket de Venta</p>
                        <p className="text-xs mt-1">{mounted ? new Date().toLocaleString() : ''}</p>
                    </div>

                    <div className="border-b-2 border-dashed border-black my-2"></div>

                    <div className="space-y-1 mb-4 text-sm">
                        <p><strong>Pedido:</strong> {orderId}</p>
                        <p><strong>Cliente:</strong> {clientName}</p>
                        {deliveryType === 'DOMICILIO' && <p><strong>Dir:</strong> {deliveryAddress}</p>}
                        <p><strong>Tel:</strong> {selectedClient?.phone || 'N/A'}</p>
                    </div>

                    <div className="border-b-2 border-dashed border-black my-2"></div>

                    <div className="space-y-2 text-sm">
                        {products.map((p, i) => (
                            <div key={i} className="flex justify-between">
                                <span>{p.qty} x {p.name}</span>
                                <span>${(p.price * p.qty).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    <div className="border-b-2 border-dashed border-black my-2"></div>

                    <div className="flex justify-between font-bold text-lg mt-2">
                        <span>TOTAL</span>
                        <span>${totalValue.toLocaleString()}</span>
                    </div>

                    {observations && (
                        <div className="mt-4 text-xs italic">
                            NB: {observations}
                        </div>
                    )}

                    <div className="text-center mt-6 text-xs">
                        <p>¡Gracias por su compra!</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body * { visibility: hidden; }
                    .print\\:block, .print\\:block * { visibility: visible; }
                    .print\\:block { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
                }
            `}</style>
        </div >
    );
}
