"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { Order, DeliveryDriver } from "@/types/order";
import {
    TrendingUp, Package, Truck, Store, CheckCircle2, Clock,
    Printer, ChevronDown, ChevronRight, RefreshCw, User,
    Receipt, MapPin, AlertTriangle, Bike
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateFilter } from "@/components/ui/DateFilter";
import { ReassignDriverModal } from "@/components/orders/ReassignDriverModal";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverGroup {
    driver: DeliveryDriver | null; // null = unassigned
    orders: Order[];
    totalValue: number;
    deliveredCount: number;
}

interface KPI {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ElementType;
    color: string;
    bg: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    TOMADO: "Tomado",
    DESPACHO: "En Despacho",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
    PAGADO: "Pagado",
};

const STATUS_COLOR: Record<string, string> = {
    TOMADO: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    DESPACHO: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    ENTREGADO: "text-green-400 bg-green-400/10 border-green-400/20",
    CANCELADO: "text-red-400 bg-red-400/10 border-red-400/20",
    PAGADO: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

const fmt = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

// ─── Component ────────────────────────────────────────────────────────────────

export default function CuadreDiarioPage() {
    const today = React.useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }, []);

    const [selectedDate, setSelectedDate] = React.useState(today);
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [drivers, setDrivers] = React.useState<DeliveryDriver[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(["unassigned"]));

    // Reassign modal state
    const [reassignTarget, setReassignTarget] = React.useState<Order | null>(null);

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const start = new Date(`${selectedDate}T00:00:00`).toISOString();
        const end = new Date(`${selectedDate}T23:59:59.999`).toISOString();

        const [ordersRes, driversRes] = await Promise.all([
            supabase
                .from("orders")
                .select("*, delivery_drivers(id, full_name, vehicle_plate, phone, is_active)")
                .gte("created_at", start)
                .lte("created_at", end)
                .order("created_at", { ascending: false }),
            supabase.from("delivery_drivers").select("*").eq("is_active", true).order("full_name"),
        ]);

        if (!ordersRes.error) setOrders((ordersRes.data as Order[]) || []);
        if (!driversRes.error) setDrivers((driversRes.data as DeliveryDriver[]) || []);
        setLoading(false);
    }, [selectedDate]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    // ── Aggregations ─────────────────────────────────────────────────────────

    const groups = React.useMemo<DriverGroup[]>(() => {
        const map = new Map<string, DriverGroup>();

        // Seed one group per active driver
        drivers.forEach((d) =>
            map.set(d.id, { driver: d, orders: [], totalValue: 0, deliveredCount: 0 })
        );
        // Unassigned bucket
        map.set("unassigned", { driver: null, orders: [], totalValue: 0, deliveredCount: 0 });

        orders.forEach((o) => {
            const key = o.driver_id ?? "unassigned";
            if (!map.has(key)) {
                // Driver from past that's not active anymore — still show
                map.set(key, {
                    driver: o.delivery_drivers ?? null,
                    orders: [],
                    totalValue: 0,
                    deliveredCount: 0,
                });
            }
            const g = map.get(key)!;
            g.orders.push(o);
            g.totalValue += o.total_value ?? 0;
            if (o.status === "ENTREGADO" || o.status === "PAGADO") g.deliveredCount++;
        });

        // Sort: drivers with orders first, then unassigned, then empty drivers
        return Array.from(map.values()).sort((a, b) => {
            if (a.orders.length === 0 && b.orders.length > 0) return 1;
            if (b.orders.length === 0 && a.orders.length > 0) return -1;
            return (b.totalValue) - (a.totalValue);
        });
    }, [orders, drivers]);

    const kpis = React.useMemo<KPI[]>(() => {
        const total = orders.reduce((s, o) => s + (o.total_value ?? 0), 0);
        const delivered = orders.filter((o) => o.status === "ENTREGADO" || o.status === "PAGADO");
        const pending = orders.filter((o) => o.status !== "ENTREGADO" && o.status !== "PAGADO");
        const domicilios = orders.filter((o) => o.delivery_type === "DOMICILIO");
        const tienda = orders.filter((o) => o.delivery_type === "TIENDA");
        const pct = orders.length > 0 ? Math.round((delivered.length / orders.length) * 100) : 0;

        return [
            {
                label: "Total Facturado", value: fmt(total), sub: `${orders.length} pedidos`,
                icon: TrendingUp, color: "text-brand", bg: "bg-brand/10",
            },
            {
                label: "Entregados", value: `${delivered.length}`, sub: `${pct}% completado`,
                icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10",
            },
            {
                label: "Pendientes", value: `${pending.length}`, sub: "Sin entregar",
                icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10",
            },
            {
                label: "Domicilios", value: `${domicilios.length}`, sub: `${tienda.length} en tienda`,
                icon: Truck, color: "text-blue-400", bg: "bg-blue-400/10",
            },
        ];
    }, [orders]);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const toggleGroup = (key: string) =>
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    const handleReassignSuccess = () => {
        setReassignTarget(null);
        fetchData();
    };

    // ── JSX ──────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── PRINT STYLES ── */}
            <style>{`
                @media print {
                    @page { margin: 12mm; size: A4 portrait; }
                    body * { visibility: hidden !important; }
                    #cuadre-print, #cuadre-print * { visibility: visible !important; }
                    #cuadre-print { position: absolute; inset: 0; padding: 20px; font-family: monospace; color: black; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="max-w-6xl mx-auto space-y-6">
                {/* ── HEADER ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Bike className="h-6 w-6 text-brand" />
                            Cuadre Diario
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Liquidación y control de despachos por domiciliario
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <DateFilter date={selectedDate} onDateChange={setSelectedDate} />
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            title="Actualizar"
                            className="p-2 rounded-md border hover:bg-muted/50 transition-colors"
                        >
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-brand text-black font-bold px-4 py-2 rounded-full text-sm hover:bg-brand/90 transition-all active:scale-95 shadow-brand/20 shadow-sm"
                        >
                            <Printer className="h-4 w-4" />
                            Imprimir Cuadre
                        </button>
                    </div>
                </div>

                {/* ── KPI CARDS ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className="rounded-xl border bg-card p-4 flex items-start gap-3 shadow-sm">
                            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", kpi.bg)}>
                                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
                                <p className="text-xl font-black tabular-nums truncate">{kpi.value}</p>
                                {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── DRIVER GROUPS ── */}
                {loading ? (
                    <div className="rounded-xl border bg-card p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 animate-spin" />
                        <span className="text-sm">Cargando cuadre...</span>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="rounded-xl border bg-card p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <Package className="h-10 w-10 opacity-30" />
                        <p className="text-sm">No hay pedidos para esta fecha.</p>
                    </div>
                ) : (
                    <div className="space-y-3" id="cuadre-print">
                        {/* Print header */}
                        <div className="hidden print:block mb-6 text-center border-b pb-4">
                            <h1 className="text-xl font-bold">Cuadre Diario — Granero Los Paisas</h1>
                            <p className="text-sm">{selectedDate} · {orders.length} pedidos · Generado: {new Date().toLocaleTimeString()}</p>
                        </div>

                        {groups.filter(g => g.orders.length > 0).map((group) => {
                            const key = group.driver?.id ?? "unassigned";
                            const isExpanded = expandedGroups.has(key);
                            const pct = group.orders.length > 0
                                ? Math.round((group.deliveredCount / group.orders.length) * 100)
                                : 0;

                            return (
                                <div key={key} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                                    {/* Group header — summary row */}
                                    <button
                                        onClick={() => toggleGroup(key)}
                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors no-print"
                                    >
                                        {/* Avatar */}
                                        <div className={cn(
                                            "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                                            group.driver ? "bg-brand/20 text-brand" : "bg-slate-700 text-slate-400"
                                        )}>
                                            {group.driver ? group.driver.full_name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="font-bold truncate">
                                                {group.driver?.full_name ?? "Sin asignar"}
                                                {group.driver?.vehicle_plate && (
                                                    <span className="text-xs font-normal text-muted-foreground ml-2">
                                                        🏍️ {group.driver.vehicle_plate}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {group.orders.length} pedido(s) · {group.deliveredCount} entregado(s)
                                            </p>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="hidden sm:flex items-center gap-2 w-32">
                                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="h-full bg-brand rounded-full transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                                        </div>

                                        {/* Total */}
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-brand font-mono text-sm">{fmt(group.totalValue)}</p>
                                            {!group.driver && group.orders.length > 0 && (
                                                <p className="text-[10px] text-amber-400 flex items-center gap-0.5 justify-end">
                                                    <AlertTriangle className="h-3 w-3" /> Sin asignar
                                                </p>
                                            )}
                                        </div>

                                        {isExpanded
                                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                        }
                                    </button>

                                    {/* Print-only summary row */}
                                    <div className="hidden print:flex px-5 py-3 border-b items-center justify-between font-bold text-sm">
                                        <span>{group.driver?.full_name ?? "Sin asignar"}</span>
                                        <span>{group.orders.length} pedidos · {fmt(group.totalValue)}</span>
                                    </div>

                                    {/* Order rows — animated expand/collapse */}
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.div
                                                key="content"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                                style={{ overflow: "hidden" }}
                                            >
                                                <div className="divide-y divide-border/40 border-t border-border/40">
                                                    {group.orders.map((order) => (
                                                        <div
                                                            key={order.id}
                                                            className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                                                        >
                                                            {/* Order ID */}
                                                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">
                                                                {order.public_id}
                                                            </span>

                                                            {/* Client + address */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate">{order.client_name}</p>
                                                                {order.delivery_type === "DOMICILIO" && order.observations && (
                                                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                                        {order.observations}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Invoices count */}
                                                            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                                                <Receipt className="h-3.5 w-3.5" />
                                                                {order.invoices_data?.filter(i => i.code || i.value).length ?? 0} fact.
                                                            </div>

                                                            {/* Delivery type badge */}
                                                            <div className="hidden sm:block shrink-0">
                                                                {order.delivery_type === "DOMICILIO"
                                                                    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20 font-medium">🏍 Dom</span>
                                                                    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-400/10 text-slate-400 border border-slate-400/20 font-medium">🏪 Tienda</span>
                                                                }
                                                            </div>

                                                            {/* Status badge */}
                                                            <span className={cn(
                                                                "text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0",
                                                                STATUS_COLOR[order.status] ?? "text-slate-400 bg-slate-400/10 border-slate-400/20"
                                                            )}>
                                                                {STATUS_LABEL[order.status] ?? order.status}
                                                            </span>

                                                            {/* Value */}
                                                            <span className="font-bold font-mono text-sm text-right shrink-0 w-28">
                                                                {fmt(order.total_value)}
                                                            </span>

                                                            {/* Reassign button */}
                                                            <button
                                                                onClick={() => setReassignTarget(order)}
                                                                className="no-print text-xs px-2.5 py-1 rounded-md border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                            >
                                                                Reasignar
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {/* Subtotal row */}
                                                    <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20">
                                                        <span className="text-xs font-bold uppercase text-muted-foreground">
                                                            Subtotal {group.driver?.full_name ?? "Sin asignar"}
                                                        </span>
                                                        <span className="font-black font-mono text-brand">
                                                            {fmt(group.totalValue)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}

                        {/* Grand total */}
                        <div className="rounded-xl border-2 border-brand/30 bg-brand/5 px-5 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">Total General del Día</p>
                                <p className="text-sm text-muted-foreground">{orders.length} pedidos · {selectedDate}</p>
                            </div>
                            <p className="text-3xl font-black text-brand font-mono">
                                {fmt(orders.reduce((s, o) => s + (o.total_value ?? 0), 0))}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── REASSIGN MODAL ── */}
            {reassignTarget && (
                <ReassignDriverModal
                    order={reassignTarget}
                    drivers={drivers}
                    onSuccess={handleReassignSuccess}
                    onClose={() => setReassignTarget(null)}
                />
            )}
        </>
    );
}
