"use client";

import React, { Suspense, useCallback, useEffect, useState, useMemo } from 'react';
import { 
    MapPin, Save, RefreshCw, Loader2, Truck, 
    Store, User, Phone, Hash, ShoppingBag, ArrowLeft,
    CheckCircle, AlertCircle, Trash2, Eye, ShieldAlert, Plus, MessageCircle, MonitorUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ClientSearch } from "@/components/ClientSearch";
import { CreateClientModal } from "@/components/CreateClientModal";
import { Client } from "@/types/order";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Server Actions
import { 
    openPedidoSession, 
    listOpenPedidoSessions,
    pollPedidoInvoices, 
    confirmInvoice, 
    discardInvoice, 
    removeInvoice, 
    pullLatestInvoices,
    closePedido,
    simulateInvoiceDetection
} from "@/app/actions/pedidos-capture";

export const dynamic = 'force-dynamic';

interface PedidoSession {
    id: string;
    id_vendedor: number;
    watermark: Record<string, number>;
    opened_by: string | null;
    opened_at: string;
    status: 'ABIERTA' | 'CERRADA' | 'CANCELADA';
    order_id: string | null;
    draft_label?: string | null;
    source_channel?: 'WHATSAPP' | 'MOSTRADOR' | 'TELEFONO' | 'OTRO';
    customer_hint?: string | null;
    last_active_at?: string;
}

interface PedidoInvoice {
    id: string;
    session_id: string;
    db_source: '01' | '02';
    tipodoc: string;
    numero: string;
    fecha: string;
    id_vendedor: number;
    nombre_tercero: string;
    total: number;
    raw: import('@/lib/flex-crm').CrmInvoiceRaw;
    detected_at: string;
    status: 'DETECTADA' | 'CONFIRMADA' | 'IGNORADA';
}

export default function NuevoApiPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <NuevoApiContent />
        </Suspense>
    );
}

function NuevoApiContent() {
    const router = useRouter();

    // 1. Session State
    const [session, setSession] = useState<PedidoSession | null>(null);
    const [sessions, setSessions] = useState<PedidoSession[]>([]);
    const [invoices, setInvoices] = useState<PedidoInvoice[]>([]);
    const [loadingSession, setLoadingSession] = useState(true);
    const [pollingActive, setPollingActive] = useState(false);
    const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
    const [manualSyncing, setManualSyncing] = useState(false);
    const [pollerError, setPollerError] = useState<string | null>(null);

    // 2. Client & Delivery State
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientName, setClientName] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [observations, setObservations] = useState("");
    const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "TIENDA">("DOMICILIO");
    const [isSaving, setIsSaving] = useState(false);

    // 3. Modals State
    const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"items" | "invoices">("items");
    const [creatingDraft, setCreatingDraft] = useState(false);
    const [newDraftLabel, setNewDraftLabel] = useState("");
    const [newDraftChannel, setNewDraftChannel] = useState<'WHATSAPP' | 'MOSTRADOR' | 'TELEFONO' | 'OTRO'>('WHATSAPP');

    // 4. Initial Load: Open/Resume Session
    const loadSessions = useCallback(async () => {
        const res = await listOpenPedidoSessions();
        if (res.success) {
            setSessions((res.sessions || []) as unknown as PedidoSession[]);
        }
    }, []);

    const initSession = useCallback(async () => {
        setLoadingSession(true);
        try {
            const res = await openPedidoSession();
            if (res.success && res.session) {
                setSession(res.session as unknown as PedidoSession);
                await loadSessions();
                toast.success("Estación de Pedidos activa y marca de agua cargada.");
            } else {
                toast.error("Error al iniciar sesión de captura: " + res.error);
            }
        } catch (err: unknown) {
            console.error("Error initSession:", err);
            toast.error("Error de conexión al iniciar sesión.");
        } finally {
            setLoadingSession(false);
        }
    }, [loadSessions]);

    useEffect(() => {
        initSession();
    }, [initSession]);

    const resetDraftForm = () => {
        setSelectedClient(null);
        setClientName("");
        setDeliveryAddress("");
        setObservations("");
        setDeliveryType("DOMICILIO");
        setActiveTab("items");
        setInvoices([]);
    };

    const handleSwitchSession = async (nextSession: PedidoSession) => {
        if (session?.id === nextSession.id) return;
        setSession(nextSession);
        resetDraftForm();
        toast.info(`Borrador activo: ${nextSession.draft_label || nextSession.customer_hint || 'Sin nombre'}`);
    };

    const handleCreateDraft = async () => {
        setCreatingDraft(true);
        try {
            const res = await openPedidoSession({
                forceNew: true,
                draftLabel: newDraftLabel,
                sourceChannel: newDraftChannel,
                customerHint: newDraftLabel
            });
            if (res.success && res.session) {
                const created = res.session as unknown as PedidoSession;
                setSession(created);
                resetDraftForm();
                setNewDraftLabel("");
                await loadSessions();
                toast.success("Nuevo borrador abierto para Milena.");
            } else {
                toast.error("No se pudo abrir el borrador: " + res.error);
            }
        } catch (err) {
            toast.error("Error al abrir borrador: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setCreatingDraft(false);
        }
    };

    // 5. Fetch Session Invoices from local DB
    const fetchSessionInvoices = async () => {
        if (!session?.id) return;
        const { data, error } = await supabase
            .from('pedido_invoices')
            .select('*')
            .eq('session_id', session.id)
            .order('detected_at', { ascending: false });
        if (error) {
            console.error("Error fetching invoices:", error);
        } else {
            setInvoices((data || []) as unknown as PedidoInvoice[]);
        }
    };

    useEffect(() => {
        if (session?.id) {
            fetchSessionInvoices();
            loadSessions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // 6. Supabase Realtime Subscription to local invoices
    useEffect(() => {
        if (!session?.id) return;

        const channel = supabase
            .channel(`session-invoices-${session.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pedido_invoices',
                    filter: `session_id=eq.${session.id}`,
                },
                () => {
                    fetchSessionInvoices();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // 7. Poller execution
    const runPoller = async () => {
        if (!session?.id || pollingActive) return;
        setPollingActive(true);
        try {
            const res = await pollPedidoInvoices(session.id);
            setLastPollTime(new Date());
            if (res.success) {
                setPollerError(null);
            } else {
                setPollerError(res.error || "Sin conexión con el ERP, reintentando...");
            }
        } catch (err) {
            console.warn("Error running poller caught:", err);
            setPollerError("Sin conexión con el ERP, reintentando...");
        } finally {
            setPollingActive(false);
        }
    };

    // Polling effect: every 9 seconds
    useEffect(() => {
        if (!session?.id) return;

        // Run immediately
        runPoller();

        const interval = setInterval(() => {
            runPoller();
        }, 9000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // Polling ligero de respaldo a la DB local para mitigar cortes de WebSocket de Supabase
    useEffect(() => {
        if (!session?.id) return;

        const interval = setInterval(() => {
            fetchSessionInvoices();
        }, 15000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // Manual Refresh
    const handleManualSync = async () => {
        if (!session?.id || manualSyncing) return;
        setManualSyncing(true);
        toast.info("Consultando últimas facturas en Millenium...");
        try {
            const res = await pollPedidoInvoices(session.id);
            setLastPollTime(new Date());
            await fetchSessionInvoices();
            if (res.success) {
                if (res.count && res.count > 0) {
                    toast.success(`Detección completada: ${res.count} facturas encontradas.`);
                } else {
                    toast.info("No se detectaron nuevas facturas.");
                }
            } else {
                toast.error("Error consultando API: " + res.error);
            }
        } catch (err: unknown) {
            toast.error("Error de red: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setManualSyncing(false);
        }
    };

    // Pull retroactively
    const handlePullLatest = async () => {
        if (!session?.id || manualSyncing) return;
        setManualSyncing(true);
        toast.info("Recuperando facturas de hoy...");
        try {
            const res = await pullLatestInvoices(session.id);
            await fetchSessionInvoices();
            if (res.success) {
                toast.success("Facturas de hoy recuperadas. Verifica la cola.");
            } else {
                toast.error("Error al recuperar: " + res.error);
            }
        } catch (err: unknown) {
            toast.error("Error: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setManualSyncing(false);
        }
    };

    // Invoice Status Mutation Actions
    const handleConfirm = async (id: string, numero: string) => {
        const res = await confirmInvoice(id);
        if (res.success) {
            toast.success(`Factura ${numero} agregada al pedido.`);
            fetchSessionInvoices();
        } else {
            toast.error("Error al confirmar: " + res.error);
        }
    };

    const handleDiscard = async (id: string, numero: string) => {
        const res = await discardInvoice(id);
        if (res.success) {
            toast.info(`Factura ${numero} ignorada.`);
            fetchSessionInvoices();
        } else {
            toast.error("Error al ignorar: " + res.error);
        }
    };

    const handleRemove = async (id: string, numero: string) => {
        const res = await removeInvoice(id);
        if (res.success) {
            toast.info(`Factura ${numero} removida del borrador.`);
            fetchSessionInvoices();
        } else {
            toast.error("Error al remover: " + res.error);
        }
    };

    // 8. Computed properties
    const confirmedInvoices = useMemo(() => {
        return invoices.filter(i => i.status === 'CONFIRMADA');
    }, [invoices]);

    const detectedInvoices = useMemo(() => {
        return invoices.filter(i => i.status === 'DETECTADA');
    }, [invoices]);

    // Consolidate Items from Confirmed Invoices
    const consolidatedProducts = useMemo(() => {
        const list: { sku: string; name: string; qty: number; price: number; total: number; type: string }[] = [];
        confirmedInvoices.forEach(inv => {
            const db = inv.db_source;
            const items = inv.raw?.items || [];
            items.forEach((item: import('@/lib/flex-crm').CrmInvoiceItemRaw) => {
                const existing = list.find(p => p.sku === item.ID_ITEM && p.type === (db === '01' ? 'BD1' : 'BD2'));
                if (existing) {
                    existing.qty += Number(item.CANTIDAD || 0);
                    existing.total += Number(item.TOTAL || item.TOTAL_ITEM || 0);
                } else {
                    list.push({
                        sku: item.ID_ITEM,
                        name: item.DESCRIPCION_ITEM || '',
                        qty: Number(item.CANTIDAD || 0),
                        price: Number(item.PRECIO || 0),
                        total: Number(item.TOTAL || item.TOTAL_ITEM || 0),
                        type: db === '01' ? 'BD1' : 'BD2'
                    });
                }
            });
        });
        return list;
    }, [confirmedInvoices]);

    const totalValue = useMemo(() => {
        return confirmedInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    }, [confirmedInvoices]);

    // Pending invoice to show in popup (queuing one by one)
    const pendingInvoice = detectedInvoices[0] || null;

    const channelLabel = (channel?: string | null) => {
        if (channel === 'MOSTRADOR') return 'Mostrador';
        if (channel === 'TELEFONO') return 'Telefono';
        if (channel === 'OTRO') return 'Otro';
        return 'WhatsApp';
    };

    const sessionTitle = (draft: PedidoSession) => {
        return draft.draft_label || draft.customer_hint || `Pedido ${draft.id.slice(0, 4).toUpperCase()}`;
    };

    // 9. Client Selection Handler
    const handleClientSelect = (client: Client) => {
        setSelectedClient(client);
        setClientName(client.full_name);
        if (client.address) {
            setDeliveryAddress(client.address);
        }
    };

    const handleSimulate = async () => {
        if (!session?.id) return;
        toast.info("Generando factura simulada...");
        try {
            const res = await simulateInvoiceDetection(session.id);
            if (res.success) {
                toast.success("Factura simulada insertada exitosamente.");
                fetchSessionInvoices();
            } else {
                toast.error("Error al simular: " + res.error);
            }
        } catch (err) {
            console.error("Error handleSimulate:", err);
            toast.error("Error al simular factura.");
        }
    };

    // 10. Close Pedido (Submit to public.orders)
    const handleSaveOrder = async () => {
        if (!session?.id) return;
        if (confirmedInvoices.length === 0) {
            toast.warning("Confirma al menos una factura detectada antes de guardar.");
            return;
        }
        if (!clientName.trim()) {
            toast.warning("Por favor asocia o escribe el nombre del cliente.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await closePedido(session.id, {
                id: selectedClient?.id,
                name: clientName,
                phone: selectedClient?.phone || undefined,
                address: deliveryType === 'DOMICILIO' ? deliveryAddress : undefined,
                deliveryType: deliveryType,
                observations: observations
            });

            if (res.success && res.orderId) {
                toast.success("Pedido consolidado con éxito.");
                
                // Auto-imprimir ticket redirigiendo a la pantalla de impresión
                setTimeout(() => {
                    router.push(`/pedidos/imprimir/${res.orderId}`);
                }, 1000);
            } else {
                toast.error("Error al finalizar pedido: " + res.error);
            }
        } catch (err: unknown) {
            console.error("Error saving order:", err);
            toast.error("Error de red al guardar.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingSession) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-brand" />
                <span className="text-sm font-semibold tracking-wide text-muted-foreground">Iniciando estación de Pedidos...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-12">
            <div className="max-w-7xl mx-auto py-6 px-4 md:px-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/pedidos" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">Captura por Detección de Facturas</h1>
                                <span className="bg-brand/20 text-brand-DEFAULT border border-brand/30 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> API Activa
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Estación vinculada al Vendedor ID: <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{session?.id_vendedor}</span>
                            </p>
                        </div>
                    </div>

                    {/* Sync Controls */}
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                            <p className="text-[10px] text-muted-foreground">Último sondeo: {lastPollTime ? lastPollTime.toLocaleTimeString() : 'Iniciando...'}</p>
                            {pollingActive && <p className="text-[10px] text-green-500 flex items-center gap-1 justify-end"><Loader2 className="h-2.5 w-2.5 animate-spin" /> buscando...</p>}
                        </div>
                        <button 
                            onClick={handleSimulate} 
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5 animate-pulse" />
                            Simular Factura
                        </button>
                        <button 
                            onClick={handleManualSync} 
                            disabled={manualSyncing} 
                            className="bg-muted hover:bg-muted/80 text-muted-foreground border px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", manualSyncing && "animate-spin")} />
                            Sondear API
                        </button>
                        <button 
                            onClick={handlePullLatest} 
                            disabled={manualSyncing} 
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-200 dark:border-blue-900 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            Recuperar Hoy
                        </button>
                    </div>
                </div>

                {/* Connection Error Alert */}
                {pollerError && (
                    <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in fade-in duration-300">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-medium">Aviso: {pollerError}</span>
                    </div>
                )}

                {/* Multi-pedido workspace */}
                <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                    <div className="bg-card border rounded-xl p-4 space-y-4 h-fit">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold flex items-center gap-2">
                                    <MonitorUp className="w-4 h-4 text-brand-DEFAULT" />
                                    Mesa de Milena
                                </h2>
                                <p className="text-[11px] text-muted-foreground mt-1">Pedidos abiertos en paralelo</p>
                            </div>
                            <span className="text-[10px] font-bold bg-muted px-2 py-1 rounded-full">{sessions.length}</span>
                        </div>

                        <div className="space-y-2">
                            <input
                                value={newDraftLabel}
                                onChange={(e) => setNewDraftLabel(e.target.value.toUpperCase())}
                                placeholder="Cliente o referencia..."
                                className="h-9 w-full rounded-md border bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand uppercase"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newDraftChannel}
                                    onChange={(e) => setNewDraftChannel(e.target.value as typeof newDraftChannel)}
                                    className="h-9 rounded-md border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                                >
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="MOSTRADOR">Mostrador</option>
                                    <option value="TELEFONO">Telefono</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                                <button
                                    onClick={handleCreateDraft}
                                    disabled={creatingDraft}
                                    className="h-9 rounded-md bg-brand text-black text-xs font-bold hover:bg-brand/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {creatingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                    Abrir
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                            {sessions.map((draft) => {
                                const isActive = draft.id === session?.id;
                                return (
                                    <button
                                        key={draft.id}
                                        onClick={() => handleSwitchSession(draft)}
                                        className={cn(
                                            "w-full text-left rounded-lg border p-3 transition-all",
                                            isActive
                                                ? "border-brand bg-brand/10 shadow-sm"
                                                : "border-border bg-background hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate">{sessionTitle(draft)}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                    <MessageCircle className="w-3 h-3" />
                                                    {channelLabel(draft.source_channel)}
                                                </p>
                                            </div>
                                            {isActive && <span className="text-[9px] font-bold text-brand-DEFAULT">ACTIVO</span>}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                                            WM BD1:{Number(draft.watermark?.['01'] || 0)} BD2:{Number(draft.watermark?.['02'] || 0)}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                {/* Main Content Layout */}
                <div className="grid gap-6 lg:grid-cols-12 min-w-0">
                    
                    {/* Left Column: Consolidated Order Staging */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Tabs Selector */}
                        <div className="flex border-b border-muted">
                            <button
                                onClick={() => setActiveTab("items")}
                                className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === 'items' ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                            >
                                Productos Consolidados ({consolidatedProducts.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("invoices")}
                                className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === 'invoices' ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                            >
                                Facturas Confirmadas ({confirmedInvoices.length})
                            </button>
                        </div>

                        {/* Tab Content 1: Products */}
                        {activeTab === 'items' && (
                            <div className="bg-card border rounded-xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-bold flex items-center gap-2">
                                        <ShoppingBag className="w-4 h-4 text-muted-foreground" /> Detalle del Pedido
                                    </h2>
                                    {confirmedInvoices.length > 0 && (
                                        <span className="text-xs text-muted-foreground font-mono">
                                            Origen: {Array.from(new Set(confirmedInvoices.map(i => i.db_source))).map(db => db === '01' ? 'BD1' : 'BD2').join(' + ')}
                                        </span>
                                    )}
                                </div>

                                {consolidatedProducts.length > 0 ? (
                                    <div className="rounded-lg border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Cant</th>
                                                    <th className="px-4 py-3 text-left">Código (SKU)</th>
                                                    <th className="px-4 py-3 text-left">Descripción</th>
                                                    <th className="px-4 py-3 text-right">Precio</th>
                                                    <th className="px-4 py-3 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {consolidatedProducts.map((p, idx) => (
                                                    <tr key={`${p.sku}-${p.type}-${idx}`} className="hover:bg-muted/10 transition-colors">
                                                        <td className="px-4 py-3 font-mono font-bold text-brand-DEFAULT">{p.qty}</td>
                                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                                                        <td className="px-4 py-3 font-medium">
                                                            <div className="flex items-center gap-2">
                                                                {p.name}
                                                                <span className={cn("text-[9px] font-bold px-1 py-0.2 border rounded uppercase", p.type === 'BD1' ? "border-amber-300 text-amber-600 bg-amber-50" : "border-emerald-300 text-emerald-600 bg-emerald-50")}>
                                                                    {p.type}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">${p.price.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold">${p.total.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 text-muted-foreground text-sm border-2 border-dashed rounded-xl bg-muted/5 flex flex-col items-center justify-center gap-2">
                                        <ShoppingBag className="w-8 h-8 opacity-20" />
                                        <span>No hay facturas confirmadas aún en este pedido.</span>
                                        <p className="text-xs max-w-xs opacity-80 mt-1">Factura en Millenium para que el sistema detecte y te muestre las facturas aquí.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab Content 2: Confirmed Invoices */}
                        {activeTab === 'invoices' && (
                            <div className="space-y-4">
                                {confirmedInvoices.length > 0 ? (
                                    confirmedInvoices.map((inv) => (
                                        <div key={inv.id} className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in duration-300">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded font-mono border", inv.db_source === '01' ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200")}>
                                                        {inv.db_source === '01' ? 'BD1' : 'BD2'}
                                                    </span>
                                                    <span className="font-bold font-mono text-sm">{inv.tipodoc}-{inv.numero}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex gap-4">
                                                    <span>Tercero: <strong className="text-foreground">{inv.nombre_tercero}</strong></span>
                                                    <span>Items: <strong>{inv.raw?.items?.length || 0}</strong></span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono font-bold text-green-600">${Number(inv.total).toLocaleString()}</span>
                                                <button 
                                                    onClick={() => handleRemove(inv.id, inv.numero)} 
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors"
                                                    title="Quitar factura del pedido"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5 flex flex-col items-center justify-center gap-2">
                                        <AlertCircle className="w-8 h-8 opacity-20" />
                                        <span>No has confirmado ninguna factura para este pedido.</span>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Right Column: Customer & Delivery Info */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        <div className="rounded-xl border bg-card text-card-foreground shadow-sm sticky top-6 overflow-hidden">
                            <div className="p-5 border-b bg-muted/10">
                                <h3 className="font-bold text-base leading-none tracking-tight">Despacho y Cliente</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                
                                {/* Delivery Type Toggle */}
                                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-1 rounded-lg">
                                    <button
                                        onClick={() => setDeliveryType("DOMICILIO")}
                                        className={cn(
                                            "flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold transition-all", 
                                            deliveryType === 'DOMICILIO' 
                                                ? "bg-background text-foreground shadow-sm border border-border" 
                                                : "text-muted-foreground hover:bg-background/40"
                                        )}
                                    >
                                        <Truck className="h-4 w-4" />
                                        Domicilio
                                    </button>
                                    <button
                                        onClick={() => setDeliveryType("TIENDA")}
                                        className={cn(
                                            "flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold transition-all", 
                                            deliveryType === 'TIENDA' 
                                                ? "bg-background text-foreground shadow-sm border border-border" 
                                                : "text-muted-foreground hover:bg-background/40"
                                        )}
                                    >
                                        <Store className="h-4 w-4" />
                                        Recoge en Tienda
                                    </button>
                                </div>

                                {/* Client Selector / Profile */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" /> Cliente *
                                        </label>
                                        {!selectedClient && (
                                            <button 
                                                onClick={() => setIsCreateClientOpen(true)}
                                                className="text-xs text-brand hover:text-brand-DEFAULT flex items-center gap-0.5 font-bold transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
                                            </button>
                                        )}
                                    </div>
                                    {selectedClient ? (
                                        <div className="rounded-xl border p-4 bg-brand/5 dark:bg-brand/2 sticky border-brand/20 relative group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-sm text-foreground">{selectedClient.full_name}</div>
                                                    <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground">
                                                        {selectedClient.document_id && <div className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> C.C: {selectedClient.document_id}</div>}
                                                        {selectedClient.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {selectedClient.phone}</div>}
                                                        {selectedClient.address && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {selectedClient.address}</div>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedClient(null);
                                                        setClientName("");
                                                        if (deliveryAddress === selectedClient.address) setDeliveryAddress("");
                                                    }}
                                                    className="text-xs text-muted-foreground hover:text-red-500 font-semibold bg-background hover:bg-red-50 px-2 py-1 rounded border shadow-sm transition-all"
                                                >
                                                    Cambiar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <ClientSearch
                                            onSelect={handleClientSelect}
                                            className="w-full"
                                        />
                                    )}
                                </div>

                                {/* Custom delivery address input */}
                                {deliveryType === 'DOMICILIO' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" /> Dirección de Entrega
                                        </label>
                                        <input
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand uppercase placeholder:normal-case font-medium"
                                            value={deliveryAddress}
                                            onChange={(e) => setDeliveryAddress(e.target.value.toUpperCase())}
                                            placeholder="DIRECCIÓN DE ENTREGA COMPLETA..."
                                        />
                                    </div>
                                )}

                                {/* Observations */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Observaciones del Pedido</label>
                                    <textarea
                                        className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand uppercase placeholder:normal-case resize-none"
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value.toUpperCase())}
                                        placeholder="Ingresar indicaciones de envío, bodega, fletes..."
                                    />
                                </div>

                                {/* Totals & Save */}
                                <div className="pt-4 border-t space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-muted-foreground uppercase">Total Consolidado</span>
                                        <span className="text-2xl font-bold text-green-600 font-mono">
                                            ${totalValue.toLocaleString()}
                                        </span>
                                    </div>

                                    <button
                                        onClick={handleSaveOrder}
                                        disabled={isSaving || confirmedInvoices.length === 0}
                                        className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-lg text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 bg-brand text-black hover:bg-brand/90 hover:scale-[1.02] active:scale-[0.98] h-12 px-8 shadow-lg shadow-brand/15"
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                        Finalizar Pedido
                                    </button>
                                </div>

                            </div>
                        </div>

                    </div>

                </div>

                </div>

            </div>

            {/* Realtime Detection Modal Popup */}
            <AnimatePresence>
                {pendingInvoice && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[200]"
                        />

                        {/* Modal container */}
                        <div className="fixed inset-0 flex items-center justify-center z-[201] p-4">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                                className="bg-card border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden"
                            >
                                <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5 text-brand-DEFAULT animate-bounce" />
                                        <div>
                                            <h2 className="text-md font-bold tracking-tight">Factura Detectada en Cola</h2>
                                            <p className="text-[10px] text-muted-foreground font-mono">ID: {pendingInvoice.id.slice(0, 8)}</p>
                                        </div>
                                    </div>
                                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded border font-mono", pendingInvoice.db_source === '01' ? "bg-amber-100 border-amber-200 text-amber-800" : "bg-emerald-100 border-emerald-200 text-emerald-800")}>
                                        {pendingInvoice.db_source === '01' ? 'BD1 (GraneLosPaisas)' : 'BD2 (PaisasFiscal)'}
                                    </span>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div className="bg-muted/35 rounded-xl p-4 space-y-2 border">
                                        <div className="flex justify-between items-center text-sm font-semibold">
                                            <span>Documento:</span>
                                            <span className="font-mono text-brand-DEFAULT">{pendingInvoice.tipodoc}-{pendingInvoice.numero}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>Fecha:</span>
                                            <span>{pendingInvoice.fecha}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>Cliente Millenium:</span>
                                            <span className="font-medium text-foreground">{pendingInvoice.nombre_tercero}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>Líneas de Compra:</span>
                                            <span>{pendingInvoice.raw?.items?.length || 0} ítems</span>
                                        </div>
                                    </div>

                                    {/* Items Preview inside Modal */}
                                    <div className="max-h-40 overflow-y-auto rounded-lg border text-xs divide-y">
                                        <div className="grid grid-cols-12 bg-muted/20 font-bold p-2 text-muted-foreground border-b uppercase">
                                            <div className="col-span-2">Cant</div>
                                            <div className="col-span-7">Producto</div>
                                            <div className="col-span-3 text-right">Subtotal</div>
                                        </div>
                                                                      {(pendingInvoice.raw?.items || []).map((it: import('@/lib/flex-crm').CrmInvoiceItemRaw, idx: number) => (
                                            <div key={idx} className="grid grid-cols-12 p-2 hover:bg-muted/10">
                                                <div className="col-span-2 font-mono font-bold">{it.CANTIDAD}</div>
                                                <div className="col-span-7 font-medium truncate">{it.DESCRIPCION_ITEM}</div>
                                                <div className="col-span-3 text-right font-mono">${Number(it.TOTAL || it.TOTAL_ITEM || 0).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-sm font-bold text-muted-foreground uppercase">Valor Factura:</span>
                                        <span className="text-xl font-mono font-bold text-green-600">${Number(pendingInvoice.total).toLocaleString()}</span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button
                                            onClick={() => handleDiscard(pendingInvoice.id, pendingInvoice.numero)}
                                            className="w-full inline-flex items-center justify-center rounded-lg text-sm font-bold border border-input hover:bg-red-50 hover:text-red-600 transition-colors h-11"
                                        >
                                            Ignorar Factura
                                        </button>
                                        <button
                                            onClick={() => handleConfirm(pendingInvoice.id, pendingInvoice.numero)}
                                            className="w-full inline-flex items-center justify-center rounded-lg text-sm font-bold bg-brand text-black hover:bg-brand/90 transition-all shadow-md h-11"
                                        >
                                            <CheckCircle className="mr-1.5 w-4 h-4" />
                                            Confirmar e Integrar
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Client Creation Modal */}
            <CreateClientModal
                isOpen={isCreateClientOpen}
                onClose={() => setIsCreateClientOpen(false)}
                onSuccess={handleClientSelect}
                initialName={clientName}
            />

        </div>
    );
}
