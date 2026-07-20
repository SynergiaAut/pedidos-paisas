"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
    ArrowLeft,
    BarChart3,
    Crown,
    DollarSign,
    Filter,
    RefreshCw,
    Search,
    Target,
    UserPlus,
    Users,
} from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getAllClients, getClientSourceDistribution, getCRMMetrics, getTopClients, recalculateAllRFMScores } from "@/app/actions/crm";
import { Client, ClientSourceDistribution, CRMMetrics } from "@/types/crm";
import { ClientCard } from "@/components/crm/ClientCard";
import { CRMIcon } from "@/components/icons/CRMIcon";
import { RFMBadge } from "@/components/crm/RFMBadge";

interface TopClientRow {
    id: string;
    full_name: string;
    total_orders: number;
    lifetime_value: number;
    rfm_segment?: string;
}

const sourceColors = ["#10b981", "#3b82f6", "#f59e0b", "#f97316", "#8b5cf6", "#ef4444"];

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(value || 0);
}

function sourceLabel(source: string) {
    if (["DIRECT", "PHONE", "UNKNOWN"].includes(source)) return "Sistema";
    if (["REFERRAL", "WEB", "AUTO_REGISTRO"].includes(source)) return "Auto-registro";
    return source;
}

export default function CRMPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSegment, setSelectedSegment] = useState("");
    const [total, setTotal] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
    const [sourceDistribution, setSourceDistribution] = useState<ClientSourceDistribution[]>([]);
    const [topClients, setTopClients] = useState<TopClientRow[]>([]);

    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            const result = await getAllClients(1, 50, {
                search: searchQuery || undefined,
                rfm_segment: selectedSegment || undefined,
            });
            setClients(result.clients);
            setTotal(result.total);
        } catch (error) {
            console.error("Error loading clients:", error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedSegment]);

    const loadDashboardData = useCallback(async () => {
        try {
            setMetricsLoading(true);
            const [metricsData, sourceData, topClientsData] = await Promise.all([
                getCRMMetrics(),
                getClientSourceDistribution(),
                getTopClients(10, "lifetime_value"),
            ]);
            setMetrics(metricsData);
            setSourceDistribution(sourceData);
            setTopClients(topClientsData as TopClientRow[]);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setMetricsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    useEffect(() => {
        void loadDashboardData();
    }, [loadDashboardData]);

    async function handleRefreshRFM() {
        try {
            setIsRefreshing(true);
            await recalculateAllRFMScores();
            await Promise.all([loadClients(), loadDashboardData()]);
        } catch (error) {
            console.error("Error refreshing RFM:", error);
        } finally {
            setIsRefreshing(false);
        }
    }

    const segments = [
        { value: "", label: "Todos los segmentos" },
        { value: "CHAMPIONS", label: "Champions" },
        { value: "LOYAL", label: "Leales" },
        { value: "POTENTIAL", label: "Potencial" },
        { value: "AT_RISK", label: "En riesgo" },
        { value: "HIBERNATING", label: "Inactivos" },
    ];

    return (
        <main className="min-h-screen bg-background">
            <section className="border-b border-border bg-background/95">
                <div className="container mx-auto max-w-7xl px-4 py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                                <CRMIcon className="h-3.5 w-3.5" />
                                CRM
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white">Clientes</h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {total} clientes registrados con analitica RFM y comportamiento comercial.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/pedidos"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Pedidos
                            </Link>
                            <button
                                onClick={handleRefreshRFM}
                                disabled={isRefreshing}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                Recalcular RFM
                            </button>
                            <Link
                                href="/crm/nuevo"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-black text-black shadow-sm shadow-brand/20 transition hover:bg-brand/90"
                            >
                                <UserPlus className="h-4 w-4" />
                                Nuevo cliente
                            </Link>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_320px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, telefono o email..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand"
                            />
                        </div>

                        <div className="relative">
                            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <select
                                value={selectedSegment}
                                onChange={(event) => setSelectedSegment(event.target.value)}
                                className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-border bg-card pl-9 pr-4 text-sm font-bold outline-none transition focus:border-brand"
                            >
                                {segments.map((segment) => (
                                    <option key={segment.value} value={segment.value}>
                                        {segment.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {!metricsLoading && metrics && (
                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                { label: "Total clientes", value: metrics.total_clients, icon: Users, tone: "blue" },
                                { label: "Activos 30d", value: metrics.active_clients, icon: Target, tone: "green" },
                                { label: "Nuevos mes", value: metrics.new_clients_this_month, icon: UserPlus, tone: "brand" },
                                { label: "LTV promedio", value: formatCurrency(metrics.avg_lifetime_value), icon: DollarSign, tone: "violet" },
                            ].map((item, index) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className="rounded-lg border border-border bg-card p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase text-muted-foreground">{item.label}</p>
                                            <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
                                        </div>
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                                item.tone === "brand" ? "bg-brand/15 text-brand" : ""
                                            } ${item.tone === "green" ? "bg-emerald-500/10 text-emerald-300" : ""} ${
                                                item.tone === "blue" ? "bg-blue-500/10 text-blue-300" : ""
                                            } ${item.tone === "violet" ? "bg-violet-500/10 text-violet-300" : ""}`}
                                        >
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {!metricsLoading && (
                <section className="container mx-auto max-w-7xl px-4 py-6">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card">
                            <div className="border-b border-border px-5 py-4">
                                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                                    <BarChart3 className="h-5 w-5 text-brand" />
                                    Fuentes de registro
                                </h2>
                            </div>
                            {sourceDistribution.length > 0 ? (
                                <div className="relative p-5">
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-black text-white">{sourceDistribution.reduce((sum, item) => sum + item.count, 0)}</span>
                                        <span className="text-xs font-bold uppercase text-muted-foreground">Clientes</span>
                                    </div>
                                    <div className="h-[240px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={sourceDistribution}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="count"
                                                    nameKey="source"
                                                    cornerRadius={6}
                                                    stroke="none"
                                                >
                                                    {sourceDistribution.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={sourceColors[index % sourceColors.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "#0f172a",
                                                        border: "1px solid #273244",
                                                        borderRadius: "8px",
                                                        boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
                                                    }}
                                                    itemStyle={{ color: "#fff" }}
                                                    formatter={(value, _name, props) => [
                                                        <span key="val" className="font-mono text-base text-white">
                                                            {Number(value).toLocaleString()}{" "}
                                                            <span className="text-xs text-slate-400">({props.payload.percentage.toFixed(1)}%)</span>
                                                        </span>,
                                                        <span key="name" className="block text-xs font-bold uppercase text-slate-400">
                                                            {sourceLabel(String(props.payload.source))}
                                                        </span>,
                                                    ]}
                                                    labelStyle={{ display: "none" }}
                                                />
                                                <Legend
                                                    verticalAlign="bottom"
                                                    height={36}
                                                    iconType="circle"
                                                    formatter={(value) => {
                                                        const item = sourceDistribution.find((source) => source.source === value);
                                                        return (
                                                            <span className="ml-1 text-xs font-bold uppercase text-muted-foreground">
                                                                {sourceLabel(String(value))}: {item?.count || 0}
                                                            </span>
                                                        );
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : (
                                <p className="py-12 text-center text-muted-foreground">No hay datos</p>
                            )}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 }}
                            className="rounded-lg border border-border bg-card"
                        >
                            <div className="border-b border-border px-5 py-4">
                                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                                    <Crown className="h-5 w-5 text-brand" />
                                    Top clientes
                                </h2>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto p-4">
                                {topClients.length > 0 ? (
                                    <div className="space-y-2">
                                        {topClients.map((client, index) => (
                                            <Link
                                                key={client.id}
                                                href={`/crm/${client.id}`}
                                                className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 transition hover:border-brand/40 hover:bg-muted/30"
                                            >
                                                <div
                                                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${
                                                        index === 0
                                                            ? "border border-brand/50 bg-brand/15 text-brand"
                                                            : index === 1
                                                              ? "border border-slate-500/30 bg-slate-500/15 text-slate-200"
                                                              : index === 2
                                                                ? "border border-orange-500/30 bg-orange-500/10 text-orange-300"
                                                                : "border border-border bg-muted/30 text-muted-foreground"
                                                    }`}
                                                >
                                                    {index + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-black text-white">{client.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{client.total_orders} pedidos</p>
                                                </div>
                                                {client.rfm_segment && <RFMBadge segment={client.rfm_segment} />}
                                                <p className="text-right text-xs font-black text-emerald-300">{formatCurrency(client.lifetime_value)}</p>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="py-12 text-center text-muted-foreground">No hay datos</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </section>
            )}

            <section className="container mx-auto max-w-7xl px-4 pb-8">
                {loading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[...Array(6)].map((_, index) => (
                            <div key={index} className="h-56 animate-pulse rounded-lg border border-border bg-card" />
                        ))}
                    </div>
                ) : clients.length === 0 ? (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-lg border border-border bg-card p-12 text-center">
                        <Users className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
                        <h3 className="mb-2 text-xl font-black text-white">No se encontraron clientes</h3>
                        <p className="text-muted-foreground">{searchQuery || selectedSegment ? "Intenta con otros filtros de busqueda" : "Aun no hay clientes registrados"}</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <AnimatePresence mode="popLayout">
                            {clients.map((client) => (
                                <ClientCard key={client.id} client={client} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </section>
        </main>
    );
}
