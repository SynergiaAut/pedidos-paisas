"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { Order, DeliveryDriver } from "@/types/order";
import {
    TrendingUp, Package, Truck, Store, CheckCircle2, Clock,
    Printer, ChevronDown, ChevronRight, RefreshCw, User,
    Receipt, MapPin, AlertTriangle, Bike, Wallet, Save, Lock, Banknote, CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateFilter } from "@/components/ui/DateFilter";
import { ReassignDriverModal } from "@/components/orders/ReassignDriverModal";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverGroup {
    driver: DeliveryDriver | null; // null = unassigned
    orders: Order[];
    totalValue: number;
    deliveredCount: number;
}

interface SalesLineForSeller {
    db_source: "01" | "02";
    tipodoc: string;
    numero: string;
    id_vendedor: number | null;
    total: number;
}

interface SellerGroup {
    id: string;
    name: string;
    lines: SalesLineForSeller[];
    totalValue: number;
    invoiceCount: number;
    bd1Value: number;
    bd2Value: number;
}

interface KPI {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ElementType;
    color: string;
    bg: string;
}

interface DailyCashClosure {
    id: string;
    business_date: string;
    expected_total: number;
    counted_cash: number;
    counted_transfer: number;
    counted_card: number;
    expenses: number;
    difference: number;
    notes: string | null;
    status: "BORRADOR" | "CERRADO";
    closed_at: string | null;
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

const moneyValue = (value: string) => Number(value.replace(/[^\d.-]/g, "")) || 0;
const sellerName = (id: string) => {
    if (id === "1112223087") return "SALAZAR MOLINA ANA MILENA";
    if (id === "1114835229") return "ARANGO QUENGUAN DIANA JISSEL";
    if (id === "27109311") return "PIANDA ROSERO DAIRA YANETH";
    return `Vendedor ${id}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CuadreDiarioPage() {
    const today = React.useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }, []);

    const [selectedDate, setSelectedDate] = React.useState(today);
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [drivers, setDrivers] = React.useState<DeliveryDriver[]>([]);
    const [salesLines, setSalesLines] = React.useState<SalesLineForSeller[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(["unassigned"]));
    const [activeTab, setActiveTab] = React.useState<"drivers" | "sellers">("drivers");
    const [closure, setClosure] = React.useState<DailyCashClosure | null>(null);
    const [savingClosure, setSavingClosure] = React.useState(false);
    const [countedCash, setCountedCash] = React.useState("");
    const [countedTransfer, setCountedTransfer] = React.useState("");
    const [countedCard, setCountedCard] = React.useState("");
    const [expenses, setExpenses] = React.useState("");
    const [closureNotes, setClosureNotes] = React.useState("");

    // Reassign modal state
    const [reassignTarget, setReassignTarget] = React.useState<Order | null>(null);

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const start = new Date(`${selectedDate}T00:00:00`).toISOString();
        const end = new Date(`${selectedDate}T23:59:59.999`).toISOString();

        const [ordersRes, driversRes, closureRes, salesRes] = await Promise.all([
            supabase
                .from("orders")
                .select("*, delivery_drivers(id, full_name, vehicle_plate, phone, is_active)")
                .gte("created_at", start)
                .lte("created_at", end)
                .order("created_at", { ascending: false }),
            supabase.from("delivery_drivers").select("*").eq("is_active", true).order("full_name"),
            supabase
                .from("daily_cash_closures")
                .select("*")
                .eq("business_date", selectedDate)
                .maybeSingle(),
            supabase
                .from("sales_lines")
                .select("db_source, tipodoc, numero, id_vendedor, total")
                .eq("fecha", selectedDate),
        ]);

        if (!ordersRes.error) setOrders((ordersRes.data as Order[]) || []);
        if (!driversRes.error) setDrivers((driversRes.data as DeliveryDriver[]) || []);
        setSalesLines(!salesRes.error ? ((salesRes.data as SalesLineForSeller[]) || []) : []);
        if (!closureRes.error && closureRes.data) {
            const savedClosure = closureRes.data as DailyCashClosure;
            setClosure(savedClosure);
            setCountedCash(String(savedClosure.counted_cash || ""));
            setCountedTransfer(String(savedClosure.counted_transfer || ""));
            setCountedCard(String(savedClosure.counted_card || ""));
            setExpenses(String(savedClosure.expenses || ""));
            setClosureNotes(savedClosure.notes || "");
        } else {
            setClosure(null);
            setCountedCash("");
            setCountedTransfer("");
            setCountedCard("");
            setExpenses("");
            setClosureNotes("");
        }
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

    const sellerGroups = React.useMemo<SellerGroup[]>(() => {
        const map = new Map<string, SellerGroup>();

        salesLines.forEach((line) => {
            const id = String(line.id_vendedor || "SIN_ID");
            if (!map.has(id)) {
                map.set(id, {
                    id,
                    name: sellerName(id),
                    lines: [],
                    totalValue: 0,
                    invoiceCount: 0,
                    bd1Value: 0,
                    bd2Value: 0,
                });
            }

            const group = map.get(id)!;
            const value = Number(line.total || 0);
            group.lines.push(line);
            group.totalValue += value;
            if (line.db_source === "02") group.bd2Value += value;
            else group.bd1Value += value;
        });

        return Array.from(map.values())
            .map((group) => {
                const invoices = new Set(group.lines.map((line) => `${line.db_source}-${line.tipodoc}-${line.numero}`));
                return { ...group, invoiceCount: invoices.size };
            })
            .sort((a, b) => b.totalValue - a.totalValue);
    }, [salesLines]);

    const kpis = React.useMemo<KPI[]>(() => {
        const active = orders.filter((o) => o.status !== "CANCELADO");
        const total = active.reduce((s, o) => s + (o.total_value ?? 0), 0);
        const delivered = orders.filter((o) => o.status === "ENTREGADO" || o.status === "PAGADO");
        const pending = active.filter((o) => o.status !== "ENTREGADO" && o.status !== "PAGADO");
        const domicilios = orders.filter((o) => o.delivery_type === "DOMICILIO");
        const tienda = orders.filter((o) => o.delivery_type === "TIENDA");
        const pct = active.length > 0 ? Math.round((delivered.length / active.length) * 100) : 0;

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

    const cashSummary = React.useMemo(() => {
        const active = orders.filter((o) => o.status !== "CANCELADO");
        const completed = active.filter((o) => o.status === "ENTREGADO" || o.status === "PAGADO");
        const pending = active.filter((o) => o.status !== "ENTREGADO" && o.status !== "PAGADO");
        const expected = completed.reduce((s, o) => s + (o.total_value ?? 0), 0);
        const pendingValue = pending.reduce((s, o) => s + (o.total_value ?? 0), 0);
        const reported = moneyValue(countedCash) + moneyValue(countedTransfer) + moneyValue(countedCard) + moneyValue(expenses);
        const difference = reported - expected;

        return {
            expected,
            pendingValue,
            reported,
            difference,
            completedCount: completed.length,
            pendingCount: pending.length,
        };
    }, [orders, countedCash, countedTransfer, countedCard, expenses]);

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

    const saveClosure = async (status: "BORRADOR" | "CERRADO") => {
        setSavingClosure(true);
        const payload = {
            business_date: selectedDate,
            expected_total: cashSummary.expected,
            counted_cash: moneyValue(countedCash),
            counted_transfer: moneyValue(countedTransfer),
            counted_card: moneyValue(countedCard),
            expenses: moneyValue(expenses),
            difference: cashSummary.difference,
            notes: closureNotes.trim() || null,
            status,
            updated_at: new Date().toISOString(),
            closed_at: status === "CERRADO" ? new Date().toISOString() : closure?.closed_at ?? null,
        };

        const { data, error } = await supabase
            .from("daily_cash_closures")
            .upsert(payload, { onConflict: "business_date" })
            .select()
            .single();

        setSavingClosure(false);
        if (error) {
            toast.error("No se pudo guardar el cuadre: " + error.message);
            return;
        }

        setClosure(data as DailyCashClosure);
        toast.success(status === "CERRADO" ? "Cuadre cerrado." : "Borrador de cuadre guardado.");
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

                <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr] no-print">
                    <div className="rounded-xl border bg-card p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-brand" />
                                    Cierre de caja operativo
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Compara pedidos entregados/pagados contra dinero reportado. Los pendientes quedan separados.
                                </p>
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-full border",
                                closure?.status === "CERRADO"
                                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                                    : "text-amber-400 bg-amber-400/10 border-amber-400/20"
                            )}>
                                {closure?.status || "SIN GUARDAR"}
                            </span>
                        </div>

                        <div className="grid md:grid-cols-4 gap-3 mt-5">
                            <div className="rounded-lg border bg-background/40 p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Esperado cobrado</p>
                                <p className="text-lg font-black font-mono text-brand">{fmt(cashSummary.expected)}</p>
                                <p className="text-[11px] text-muted-foreground">{cashSummary.completedCount} pedidos cerrados</p>
                            </div>
                            <div className="rounded-lg border bg-background/40 p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Pendiente operativo</p>
                                <p className="text-lg font-black font-mono text-yellow-400">{fmt(cashSummary.pendingValue)}</p>
                                <p className="text-[11px] text-muted-foreground">{cashSummary.pendingCount} sin entregar/pagar</p>
                            </div>
                            <div className="rounded-lg border bg-background/40 p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Reportado</p>
                                <p className="text-lg font-black font-mono">{fmt(cashSummary.reported)}</p>
                                <p className="text-[11px] text-muted-foreground">Caja + bancos + gastos</p>
                            </div>
                            <div className={cn(
                                "rounded-lg border p-3",
                                Math.abs(cashSummary.difference) < 1
                                    ? "bg-emerald-400/10 border-emerald-400/20"
                                    : "bg-red-400/10 border-red-400/20"
                            )}>
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Diferencia</p>
                                <p className={cn(
                                    "text-lg font-black font-mono",
                                    Math.abs(cashSummary.difference) < 1 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {fmt(cashSummary.difference)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">Reportado - esperado</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-4 gap-3 mt-4">
                            {[
                                { label: "Efectivo", value: countedCash, set: setCountedCash, icon: Banknote },
                                { label: "Transferencias", value: countedTransfer, set: setCountedTransfer, icon: Wallet },
                                { label: "Tarjeta", value: countedCard, set: setCountedCard, icon: CreditCard },
                                { label: "Gastos/egresos", value: expenses, set: setExpenses, icon: Receipt },
                            ].map((field) => (
                                <label key={field.label} className="space-y-1.5">
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                        <field.icon className="h-3 w-3" />
                                        {field.label}
                                    </span>
                                    <input
                                        inputMode="numeric"
                                        value={field.value}
                                        onChange={(e) => field.set(e.target.value)}
                                        placeholder="0"
                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                                    />
                                </label>
                            ))}
                        </div>

                        <textarea
                            value={closureNotes}
                            onChange={(e) => setClosureNotes(e.target.value)}
                            placeholder="Notas del cierre, novedades, pagos pendientes, diferencia explicada..."
                            className="mt-4 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand resize-none"
                        />

                        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                            <button
                                onClick={() => saveClosure("BORRADOR")}
                                disabled={savingClosure}
                                className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-bold hover:bg-muted/50 disabled:opacity-60"
                            >
                                <Save className="h-4 w-4" />
                                Guardar borrador
                            </button>
                            <button
                                onClick={() => saveClosure("CERRADO")}
                                disabled={savingClosure}
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-black hover:bg-brand/90 disabled:opacity-60"
                            >
                                <Lock className="h-4 w-4" />
                                Cerrar cuadre
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                Lectura correcta
                            </h3>
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                El esperado solo incluye pedidos en estado Entregado o Pagado. Lo pendiente no se trata como faltante:
                                queda visible para seguimiento antes de cerrar caja.
                            </p>
                        </div>
                        <div className="mt-4 rounded-lg bg-background/50 border p-3">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Ultimo guardado</p>
                            <p className="text-sm font-semibold mt-1">
                                {closure
                                    ? `${closure.status} · ${closure.closed_at ? new Date(closure.closed_at).toLocaleString("es-CO") : selectedDate}`
                                    : "Aun sin cuadre guardado"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 no-print">
                    <button
                        onClick={() => setActiveTab("drivers")}
                        className={cn(
                            "rounded-full px-4 py-2 text-sm font-bold border transition-colors",
                            activeTab === "drivers"
                                ? "bg-brand text-black border-brand"
                                : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                    >
                        Cuadre por domiciliario
                    </button>
                    <button
                        onClick={() => setActiveTab("sellers")}
                        className={cn(
                            "rounded-full px-4 py-2 text-sm font-bold border transition-colors",
                            activeTab === "sellers"
                                ? "bg-brand text-black border-brand"
                                : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                    >
                        Cuadre por vendedor
                    </button>
                </div>

                {/* ── DRIVER GROUPS ── */}
                {activeTab === "sellers" && !loading ? (
                    sellerGroups.length === 0 ? (
                        <div className="rounded-xl border bg-card p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Receipt className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No hay ventas sincronizadas por vendedor para esta fecha.</p>
                            <p className="text-xs text-muted-foreground">Ejecuta el sync de ventas del dia para poblar `sales_lines`.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sellerGroups.map((seller) => (
                                <div key={seller.id} className="rounded-xl border bg-card p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="h-9 w-9 rounded-full bg-brand/15 text-brand flex items-center justify-center text-sm font-black">
                                                    {seller.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold truncate">{seller.name}</h3>
                                                    <p className="text-xs text-muted-foreground font-mono">ID vendedor: {seller.id}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:min-w-[560px]">
                                            <div className="rounded-lg border bg-background/40 p-3">
                                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Total vendido</p>
                                                <p className="text-lg font-black font-mono text-brand">{fmt(seller.totalValue)}</p>
                                            </div>
                                            <div className="rounded-lg border bg-background/40 p-3">
                                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Facturas</p>
                                                <p className="text-lg font-black font-mono">{seller.invoiceCount}</p>
                                            </div>
                                            <div className="rounded-lg border bg-background/40 p-3">
                                                <p className="text-[10px] uppercase text-muted-foreground font-bold">BD1 interna</p>
                                                <p className="text-lg font-black font-mono text-indigo-300">{fmt(seller.bd1Value)}</p>
                                            </div>
                                            <div className="rounded-lg border bg-background/40 p-3">
                                                <p className="text-[10px] uppercase text-muted-foreground font-bold">BD2 fiscal</p>
                                                <p className="text-lg font-black font-mono text-emerald-300">{fmt(seller.bd2Value)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : loading ? (
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
                        <div className="hidden print:block mb-4 border-b pb-3 text-sm">
                            <p>Esperado cobrado: {fmt(cashSummary.expected)}</p>
                            <p>Reportado: {fmt(cashSummary.reported)}</p>
                            <p>Diferencia: {fmt(cashSummary.difference)}</p>
                            {closureNotes && <p>Notas: {closureNotes}</p>}
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
