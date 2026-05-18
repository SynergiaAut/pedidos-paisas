'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Package, Truck, BarChart3, Percent, Target, Award } from 'lucide-react';
import Link from 'next/link';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getDailySales, getTopProducts, getDeliveryTypeBreakdown, getDriverPerformance, getMetricsSummary, getRevenueComparison, getTopClients, getWeekdayPatterns, getMonthlyTrends } from '@/app/actions/analytics';
import type { DailySalesData, TopProduct, DeliveryTypeBreakdown, DriverPerformance, MetricsSummary, RevenueComparison, TopClient, WeekdayPattern, MonthlyTrend } from '@/types/crm';
import { RFMBadge } from '@/components/crm/RFMBadge';
import { Calendar, Crown } from 'lucide-react';

export default function AnalyticsPage() {
    const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [deliveryBreakdown, setDeliveryBreakdown] = useState<DeliveryTypeBreakdown[]>([]);
    const [driverPerformance, setDriverPerformance] = useState<DriverPerformance[]>([]);
    const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
    const [revenueComparison, setRevenueComparison] = useState<RevenueComparison | null>(null);
    const [topClients, setTopClients] = useState<TopClient[]>([]);
    const [weekdayPatterns, setWeekdayPatterns] = useState<WeekdayPattern[]>([]);
    const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    });

    useEffect(() => {
        loadAnalytics();
    }, [dateRange]);

    async function loadAnalytics() {
        try {
            setLoading(true);

            // Calculate previous period
            const endDate = new Date(dateRange.end);
            const startDate = new Date(dateRange.start);
            const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            const prevEnd = new Date(startDate);
            prevEnd.setDate(prevEnd.getDate() - 1);
            const prevStart = new Date(prevEnd);
            prevStart.setDate(prevStart.getDate() - daysDiff);

            const [salesData, productsData, deliveryData, driversData, metricsData, comparisonData, clientsData, weekdayData, monthlyData] = await Promise.all([
                getDailySales(dateRange.start, dateRange.end),
                getTopProducts(dateRange.start, dateRange.end, 10),
                getDeliveryTypeBreakdown(dateRange.start, dateRange.end),
                getDriverPerformance(dateRange.start, dateRange.end),
                getMetricsSummary(dateRange.start, dateRange.end),
                getRevenueComparison(
                    dateRange.start, dateRange.end,
                    prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]
                ),
                getTopClients(dateRange.start, dateRange.end, 10),
                getWeekdayPatterns(dateRange.start, dateRange.end),
                getMonthlyTrends(dateRange.start, dateRange.end)
            ]);

            setDailySales(salesData);
            setTopProducts(productsData);
            setDeliveryBreakdown(deliveryData);
            setDriverPerformance(driversData);
            setMetrics(metricsData);
            setRevenueComparison(comparisonData);
            setTopClients(clientsData);
            setWeekdayPatterns(weekdayData);
            setMonthlyTrends(monthlyData);
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };

    // Vibrant neon colors for donut chart
    const NEON_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#FCA311', '#8b5cf6', '#ef4444'];

    // Calculate advanced KPIs
    const conversionRate = metrics ? (metrics.delivered_orders / metrics.total_orders) * 100 : 0;
    const trenChange = revenueComparison?.percentage_change || 0;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b pb-4 pt-4 shadow-sm">
                <div className="container mx-auto max-w-7xl px-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <BarChart3 className="w-6 h-6" />
                                Analytics <span className="text-green-400 text-xs px-2 py-0.5 border border-green-500/30 rounded-full ml-2">En Vivo</span>
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Análisis avanzado de ventas y rendimiento
                            </p>
                        </div>
                        <Link
                            href="/pedidos"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
                        >
                            ← Volver
                        </Link>
                    </div>

                    {/* Date Range */}
                    <div className="flex gap-3 mt-4">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Desde</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-brand dark:[color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Hasta</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-brand dark:[color-scheme:dark]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto max-w-7xl py-6 px-4 space-y-6">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
                    </div>
                ) : (
                    <>
                        {/* Primary KPIs */}
                        {metrics && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="rounded-xl border bg-gradient-to-br from-green-950/40 to-green-950/20 border-green-900/30 p-5 shadow-lg relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors" />
                                    <div className="relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                                                <DollarSign className="w-5 h-5 text-green-400" />
                                            </div>
                                            {trenChange !== 0 && (
                                                <div className={`flex items-center gap-1 text-xs ${trenChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {trenChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {Math.abs(trenChange).toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-green-500 font-semibold uppercase tracking-wider mb-1">Ingresos Totales</p>
                                        <p className="text-2xl font-bold text-green-400">{formatCurrency(metrics.delivered_revenue)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">De {formatCurrency(metrics.total_revenue)} tomados</p>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="rounded-xl border bg-card p-5 shadow-sm"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2">
                                        <Target className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Ticket Promedio</p>
                                    <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.average_order_value)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{metrics.total_orders} pedidos</p>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="rounded-xl border bg-card p-5 shadow-sm"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-2">
                                        <Percent className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Tasa Conversión</p>
                                    <p className="text-2xl font-bold text-blue-400">{conversionRate.toFixed(1)}%</p>
                                    <p className="text-xs text-muted-foreground mt-1">{metrics.delivered_orders} de {metrics.total_orders}</p>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="rounded-xl border bg-card p-5 shadow-sm"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-2">
                                        <Users className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Nuevos Clientes</p>
                                    <p className="text-2xl font-bold text-purple-400">{metrics.new_clients}</p>
                                    <p className="text-xs text-muted-foreground mt-1">En el período</p>
                                </motion.div>
                            </div>
                        )}

                        {/* Charts Row 1 */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Daily Sales Area Chart */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="lg:col-span-2 rounded-xl border bg-card p-6 shadow-sm"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.4))' }}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5" />
                                        Tendencia de Ingresos
                                    </h3>
                                    <div className="text-xs text-muted-foreground">Últimos 30 días</div>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={dailySales}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#FCA311" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#FCA311" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888"
                                            fontSize={11}
                                            tickFormatter={(value) => {
                                                // Value is "YYYY-MM-DD"
                                                // Create date as UTC
                                                const [y, m, d] = value.split('-').map(Number);
                                                const date = new Date(Date.UTC(y, m - 1, d));
                                                // Use getUTCDate to get the day in UTC, ignoring local offset
                                                return date.getUTCDate().toString();
                                            }}
                                        />
                                        <YAxis stroke="#888" fontSize={11} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                            labelStyle={{ color: '#fff', marginBottom: '8px' }}
                                            formatter={(value: any) => formatCurrency(value)}
                                            labelFormatter={(value) => {
                                                if (!value) return '';
                                                const [y, m, d] = value.split('-').map(Number);
                                                const date = new Date(Date.UTC(y, m - 1, d));
                                                return date.toLocaleDateString('es-CO', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    timeZone: 'UTC'
                                                });
                                            }}
                                        />
                                        <Area type="monotone" dataKey="delivered_revenue" stroke="#FCA311" strokeWidth={2} fill="url(#colorRevenue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </motion.div>

                            {/* Delivery Type Donut Chart */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="rounded-xl border bg-card p-6 shadow-sm flex flex-col"
                            >
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
                                    <Package className="w-5 h-5" />
                                    Tipo de Entrega
                                </h3>
                                <div className="flex-1 flex items-center justify-center relative">
                                    {/* Central Label */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl font-bold text-foreground">
                                            {deliveryBreakdown.reduce((sum, item) => sum + item.total_orders, 0)}
                                        </span>
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Pedidos</span>
                                    </div>

                                    <div className="w-full h-[280px]" style={{ filter: 'drop-shadow(0 0 15px rgba(0,0,0,0.2))' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={deliveryBreakdown}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={80}
                                                    outerRadius={110}
                                                    paddingAngle={5}
                                                    dataKey="total_orders"
                                                    cornerRadius={6}
                                                    stroke="none"
                                                >
                                                    {deliveryBreakdown.map((entry, index) => {
                                                        // Use brand colors: Green, Blue, Orange
                                                        const COLORS = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6'];
                                                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                                    })}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: any, name: any, props: any) => [
                                                        <span key="val" className="font-mono text-lg">{value} <span className="text-xs text-muted-foreground">({formatCurrency(props.payload.total_revenue)})</span></span>,
                                                        <span key="name" className="uppercase text-xs font-bold text-muted-foreground mb-1 block">{props.payload.delivery_type}</span>
                                                    ]}
                                                    labelStyle={{ display: 'none' }}
                                                />
                                                <Legend
                                                    verticalAlign="bottom"
                                                    height={36}
                                                    iconType="circle"
                                                    formatter={(value, entry: any) => (
                                                        <span className="text-xs font-medium text-muted-foreground ml-1 uppercase">{value}</span>
                                                    )}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Charts Row 2 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Top Products Bar Chart */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border bg-card p-6 shadow-sm"
                            >
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                                    <Award className="w-5 h-5" />
                                    Top 5 Productos
                                </h3>
                                <div style={{ filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.35))' }}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={topProducts.slice(0, 5)} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis type="number" stroke="#888" fontSize={11} />
                                            <YAxis dataKey="product_name" type="category" stroke="#888" fontSize={11} width={120} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                                cursor={{ fill: 'transparent' }}
                                                formatter={(value: any) => formatCurrency(value)}
                                            />
                                            <Bar dataKey="total_revenue" fill="#22c55e" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </motion.div>

                            {/* Driver Performance */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border bg-card shadow-sm"
                            >
                                <div className="p-6 border-b border-border">
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Truck className="w-5 h-5" />
                                        Ranking Domiciliarios
                                    </h3>
                                </div>
                                <div className="p-6">
                                    {driverPerformance.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">No hay datos</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {driverPerformance.slice(0, 5).map((driver, idx) => (
                                                <div key={idx} className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50' :
                                                        idx === 1 ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                                                            'bg-muted/50 text-muted-foreground border border-border'
                                                        }`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-foreground">{driver.driver_name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {driver.completed_deliveries} entregas • {((driver.completed_deliveries / driver.total_deliveries) * 100).toFixed(0)}% efectividad
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-bold text-green-400">{formatCurrency(driver.total_revenue)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        {/* Advanced Analytics Row - Temporal Patterns */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Weekday Patterns */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border bg-card p-6 shadow-sm"
                            >
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                                    <Calendar className="w-5 h-5" />
                                    Patrón por Día de Semana
                                </h3>
                                {weekdayPatterns.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No hay datos</p>
                                ) : (
                                    <div style={{ filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.4))' }}>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={weekdayPatterns}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis dataKey="day_name" stroke="#888" fontSize={11} />
                                                <YAxis stroke="#888" fontSize={11} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                                    cursor={{ fill: 'transparent' }}
                                                    formatter={(value: any, name: any) => {
                                                        if (name === 'total_revenue') return [`${formatCurrency(value)}`, 'Ingresos'];
                                                        if (name === 'total_orders') return [`${value} pedidos`, 'Pedidos'];
                                                        return [value, name];
                                                    }}
                                                />
                                                <Bar dataKey="total_revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </motion.div>

                            {/* Monthly Trends */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="rounded-xl border bg-card p-6 shadow-sm"
                            >
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-5 h-5" />
                                    Tendencia Mensual
                                </h3>
                                {monthlyTrends.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No hay datos</p>
                                ) : (
                                    <div style={{ filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.35))' }}>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={monthlyTrends}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis dataKey="month_name" stroke="#888" fontSize={11} />
                                                <YAxis stroke="#888" fontSize={11} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                                    formatter={(value: any) => formatCurrency(value)}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="total_revenue"
                                                    stroke="#22c55e"
                                                    strokeWidth={3}
                                                    dot={{ r: 5, fill: '#22c55e', strokeWidth: 0 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* Top Clients Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border bg-card shadow-sm"
                        >
                            <div className="p-6 border-b border-border">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Crown className="w-5 h-5" />
                                    Top 10 Clientes
                                </h3>
                            </div>
                            <div className="p-6">
                                {topClients.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Crown className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                                        <p className="text-muted-foreground mb-2">No hay datos de clientes vinculados</p>
                                        <p className="text-xs text-muted-foreground/70">Los pedidos necesitan tener <code className="px-1 py-0.5 bg-muted rounded text-xs">client_id</code> para aparecer aquí</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {topClients.map((client, idx) => (
                                            <Link
                                                key={client.client_id}
                                                href={`/crm/${client.client_id}`}
                                                className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50' :
                                                    idx === 1 ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                                                        idx === 2 ? 'bg-orange-700/20 text-orange-500 border border-orange-700/30' :
                                                            'bg-muted/50 text-muted-foreground border border-border'
                                                    }`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{client.client_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {client.total_orders} pedidos • Ticket promedio: {formatCurrency(client.average_order_value)}
                                                    </p>
                                                </div>
                                                {client.rfm_segment && (
                                                    <RFMBadge segment={client.rfm_segment} />
                                                )}
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-green-400">{formatCurrency(client.total_revenue)}</p>
                                                    <p className="text-xs text-muted-foreground">Total</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
}
