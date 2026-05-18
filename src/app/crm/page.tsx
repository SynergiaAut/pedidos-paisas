'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Filter, RefreshCw, UserPlus, TrendingUp, DollarSign, Crown, Target } from 'lucide-react';
import { ClientCard } from '@/components/crm/ClientCard';
import { Client, CRMMetrics, ClientSourceDistribution } from '@/types/crm';
import { getAllClients, recalculateAllRFMScores, getCRMMetrics, getClientSourceDistribution, getTopClients } from '@/app/actions/crm';
import Link from 'next/link';
import { CRMIcon } from '@/components/icons/CRMIcon';
import { RFMBadge } from '@/components/crm/RFMBadge';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CRMPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSegment, setSelectedSegment] = useState<string>('');
    const [total, setTotal] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // New state for dashboard
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
    const [sourceDistribution, setSourceDistribution] = useState<ClientSourceDistribution[]>([]);
    const [topClients, setTopClients] = useState<any[]>([]);

    useEffect(() => {
        loadClients();
    }, [searchQuery, selectedSegment]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    async function loadClients() {
        try {
            setLoading(true);
            const result = await getAllClients(1, 50, {
                search: searchQuery || undefined,
                rfm_segment: selectedSegment || undefined,
            });
            setClients(result.clients);
            setTotal(result.total);
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadDashboardData() {
        try {
            setMetricsLoading(true);
            const [metricsData, sourceData, topClientsData] = await Promise.all([
                getCRMMetrics(),
                getClientSourceDistribution(),
                getTopClients(10, 'lifetime_value')
            ]);
            setMetrics(metricsData);
            setSourceDistribution(sourceData);
            setTopClients(topClientsData);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setMetricsLoading(false);
        }
    }

    async function handleRefreshRFM() {
        try {
            setIsRefreshing(true);
            await recalculateAllRFMScores();
            await loadClients();
        } catch (error) {
            console.error('Error refreshing RFM:', error);
        } finally {
            setIsRefreshing(false);
        }
    }

    const segments = [
        { value: '', label: 'Todos los Segmentos' },
        { value: 'CHAMPIONS', label: 'Champions' },
        { value: 'LOYAL', label: 'Leales' },
        { value: 'POTENTIAL', label: 'Potencial' },
        { value: 'AT_RISK', label: 'En Riesgo' },
        { value: 'HIBERNATING', label: 'Inactivos' },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Sticky Header Section - Matching pedidos page */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b pb-4 pt-4 shadow-sm">
                <div className="container mx-auto max-w-6xl space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-4 md:px-0">
                        <div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <CRMIcon className="w-6 h-6" />
                                    CRM - Clientes
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {total} clientes registrados
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Link
                                href="/pedidos"
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 shadow-sm"
                            >
                                ← Volver a Pedidos
                            </Link>
                            <button
                                onClick={handleRefreshRFM}
                                disabled={isRefreshing}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Recalcular RFM
                            </button>
                            <Link
                                href="/crm/nuevo"
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-brand hover:bg-brand/90 text-black font-bold h-9 px-6 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <UserPlus className="mr-2 h-4 w-4" /> Nuevo Cliente
                            </Link>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-3 px-4 md:px-0">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, teléfono o email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all placeholder:text-muted-foreground"
                            />
                        </div>

                        {/* Segment Filter */}
                        <div className="md:w-64 relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <select
                                value={selectedSegment}
                                onChange={(e) => setSelectedSegment(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-input outline-none appearance-none cursor-pointer transition-all"
                            >
                                {segments.map((seg) => (
                                    <option key={seg.value} value={seg.value}>
                                        {seg.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dashboard KPIs */}
                    {!metricsLoading && metrics && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 md:px-0">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-lg border bg-card p-3 shadow-sm flex flex-col justify-center items-center"
                            >
                                <Users className="w-5 h-5 text-blue-500 mb-1" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Total Clientes</span>
                                <span className="text-xl font-bold text-foreground">{metrics.total_clients}</span>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 }}
                                className="rounded-lg border bg-green-950/20 border-green-900/30 p-3 shadow-sm flex flex-col justify-center items-center"
                            >
                                <Target className="w-5 h-5 text-green-500 mb-1" />
                                <span className="text-xs font-semibold text-green-600 uppercase">Activos (30d)</span>
                                <span className="text-xl font-bold text-green-500">{metrics.active_clients}</span>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="rounded-lg border bg-brand/10 border-brand/30 p-3 shadow-sm flex flex-col justify-center items-center"
                            >
                                <UserPlus className="w-5 h-5 text-brand mb-1" />
                                <span className="text-xs font-semibold text-brand/80 uppercase">Nuevos (Mes)</span>
                                <span className="text-xl font-bold text-brand">{metrics.new_clients_this_month}</span>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="rounded-lg border bg-purple-950/20 border-purple-900/30 p-3 shadow-sm flex flex-col justify-center items-center"
                            >
                                <DollarSign className="w-5 h-5 text-purple-400 mb-1" />
                                <span className="text-xs font-semibold text-purple-500 uppercase">LTV Promedio</span>
                                <span className="text-lg font-bold text-purple-400">${Math.round(metrics.avg_lifetime_value).toLocaleString()}</span>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dashboard Visualizations - Below Header */}
            {
                !metricsLoading && (
                    <div className="container mx-auto max-w-6xl py-6 px-4 md:px-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Client Source Distribution */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border bg-card shadow-sm p-6"
                            >
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-5 h-5" />
                                    Fuentes de Registro
                                </h3>
                                {sourceDistribution.length > 0 ? (
                                    <div className="flex-1 flex items-center justify-center relative">
                                        {/* Central Label */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-3xl font-bold text-foreground">
                                                {sourceDistribution.reduce((sum, item) => sum + item.count, 0)}
                                            </span>
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Clientes</span>
                                        </div>

                                        <div className="w-full h-[260px]" style={{ filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.25))' }}>
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
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={['#22c55e', '#3b82f6', '#f59e0b', '#FCA311', '#8b5cf6', '#ef4444'][index % 6]}
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                                                        itemStyle={{ color: '#fff' }}
                                                        formatter={(value: any, name: any, props: any) => {
                                                            const rawSource = props.payload.source;
                                                            let label = rawSource;
                                                            if (['DIRECT', 'PHONE', 'UNKNOWN'].includes(rawSource)) label = 'Sistema (Asesor)';
                                                            if (rawSource === 'REFERRAL' || rawSource === 'WEB' || rawSource === 'AUTO_REGISTRO') label = 'Auto-registro (Web)';

                                                            return [
                                                                <span key="val" className="font-mono text-lg">{value} <span className="text-xs text-muted-foreground">({props.payload.percentage.toFixed(1)}%)</span></span>,
                                                                <span key="name" className="uppercase text-xs font-bold text-muted-foreground mb-1 block">{label}</span>
                                                            ]
                                                        }}
                                                        labelStyle={{ display: 'none' }}
                                                    />
                                                    <Legend
                                                        verticalAlign="bottom"
                                                        height={36}
                                                        iconType="circle"
                                                        formatter={(value, entry: any) => {
                                                            const item = sourceDistribution.find(d => d.source === value);
                                                            let label = value;
                                                            if (['DIRECT', 'PHONE', 'UNKNOWN'].includes(value)) label = 'Sistema';
                                                            if (value === 'REFERRAL' || value === 'WEB' || value === 'AUTO_REGISTRO') label = 'Auto-registro';

                                                            return <span className="text-xs font-medium text-muted-foreground ml-1 uppercase">{label}: {item?.count || 0}</span>;
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">No hay datos</p>
                                )}
                            </motion.div>

                            {/* Top Clients Ranking */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="rounded-xl border bg-card shadow-sm"
                            >
                                <div className="p-6 border-b border-border">
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Crown className="w-5 h-5 text-brand" />
                                        Top 10 Clientes
                                    </h3>
                                </div>
                                <div className="p-4 max-h-[300px] overflow-y-auto">
                                    {topClients.length > 0 ? (
                                        <div className="space-y-2">
                                            {topClients.map((client, idx) => (
                                                <Link
                                                    key={client.id}
                                                    href={`/crm/${client.id}`}
                                                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                                >
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50' :
                                                        idx === 1 ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                                                            idx === 2 ? 'bg-orange-700/20 text-orange-500 border border-orange-700/30' :
                                                                'bg-muted/50 text-muted-foreground border border-border'
                                                        }`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-foreground truncate">{client.full_name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{client.total_orders} pedidos</p>
                                                    </div>
                                                    {client.rfm_segment && (
                                                        <RFMBadge segment={client.rfm_segment} />
                                                    )}
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-green-400">${Math.round(client.lifetime_value).toLocaleString()}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">No hay datos</p>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )
            }

            {/* Clients List & Scrollable Area */}
            <div className="flex-1 container mx-auto max-w-6xl py-6 px-4 md:px-0">
                <div className="space-y-4">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-64 bg-card rounded-xl border border-border animate-pulse"
                                />
                            ))}
                        </div>
                    ) : clients.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-xl border bg-card shadow-sm p-12 text-center"
                        >
                            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-foreground mb-2">
                                No se encontraron clientes
                            </h3>
                            <p className="text-muted-foreground">
                                {searchQuery || selectedSegment
                                    ? 'Intenta con otros filtros de búsqueda'
                                    : 'Aún no hay clientes registrados'}
                            </p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <AnimatePresence mode="popLayout">
                                {clients.map((client) => (
                                    <ClientCard key={client.id} client={client} />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
