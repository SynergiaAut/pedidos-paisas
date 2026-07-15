'use client';

import React, { useEffect, useState } from 'react';
import { 
    getProductsBehaviorData, 
    getProductDetailData, 
    getIntradaySnapshots,
    BehaviorStats, 
    ProductDetailData,
    IntradayPoint
} from '@/app/actions/sales-analytics';
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    ShoppingBag, 
    Activity, 
    AlertTriangle, 
    Search, 
    Loader2, 
    ChevronRight, 
    ArrowRight,
    Tag,
    Layers,
    Info,
    CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const CORRUPT_SKUS = ['2202007', '701042', '606042'];

export function BehaviorTab() {
    const [periodDays, setPeriodDays] = useState<number>(30);
    const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
    const [stats, setStats] = useState<BehaviorStats | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // Búsqueda de producto individual
    const [searchSku, setSearchSku] = useState<string>('');
    const [searchingDetail, setSearchingDetail] = useState<boolean>(false);
    const [productDetail, setProductDetail] = useState<ProductDetailData | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);

    // Estados para snapshots intradía (Fase S5)
    const [intradayDate, setIntradayDate] = useState<string>(() => {
        const d = new Date();
        const colombiaOffset = -5 * 60; // en minutos
        const utcTime = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
        const colombiaTime = new Date(utcTime + (colombiaOffset * 60 * 1000));
        
        const year = colombiaTime.getFullYear();
        const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
        const day = String(colombiaTime.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [intradayData, setIntradayData] = useState<IntradayPoint[]>([]);
    const [loadingIntraday, setLoadingIntraday] = useState<boolean>(true);
    const [intradayError, setIntradayError] = useState<string | null>(null);
    const [intradayViewMode, setIntradayViewMode] = useState<'cumulative' | 'delta'>('cumulative');

    const loadIntradayData = async () => {
        setLoadingIntraday(true);
        setIntradayError(null);
        try {
            const result = await getIntradaySnapshots(intradayDate);
            if ('error' in result) {
                setIntradayError(result.error);
                setIntradayData([]);
            } else {
                setIntradayData(result);
            }
        } catch (e) {
            setIntradayError('Error al recuperar datos intradía.');
        } finally {
            setLoadingIntraday(false);
        }
    };

    useEffect(() => {
        loadIntradayData();
    }, [intradayDate]);

    const loadBehaviorData = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const result = await getProductsBehaviorData({
                periodDays,
                classification: selectedClassification
            });
            
            if ('error' in result) {
                setErrorMsg(result.error);
                setStats(null);
            } else {
                setStats(result);
            }
        } catch (e) {
            setErrorMsg('Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBehaviorData();
    }, [periodDays, selectedClassification]);

    const handleSearchProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchSku.trim()) return;
        
        setSearchingDetail(true);
        setDetailError(null);
        setProductDetail(null);
        
        try {
            const result = await getProductDetailData(searchSku.trim());
            if ('error' in result) {
                setDetailError(result.error);
            } else {
                setProductDetail(result);
            }
        } catch (e) {
            setDetailError('Error al recuperar detalles del producto.');
        } finally {
            setSearchingDetail(false);
        }
    };

    // Formatear monedas COP
    const formatCOP = (num: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(num);
    };

    return (
        <div className="space-y-8">
            {/* --- SECCIÓN A: MONITOREO EN TIEMPO REAL (INTRADÍA) --- */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
                            Monitoreo de Ventas Intradía (En Vivo)
                        </h3>
                        <p className="text-gray-400 text-xs mt-1">Acumulados y deltas por franja horaria para la fecha de negocio seleccionada.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <input 
                            type="date" 
                            value={intradayDate}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setIntradayDate(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
                        />

                        <div className="flex bg-slate-900 border border-white/10 rounded-xl p-0.5">
                            <button 
                                onClick={() => setIntradayViewMode('cumulative')}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    intradayViewMode === 'cumulative' 
                                        ? 'bg-emerald-600 text-white' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Acumulado
                            </button>
                            <button 
                                onClick={() => setIntradayViewMode('delta')}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    intradayViewMode === 'delta' 
                                        ? 'bg-emerald-600 text-white' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Franjas
                            </button>
                        </div>
                    </div>
                </div>

                {loadingIntraday ? (
                    <div className="h-72 flex flex-col items-center justify-center text-gray-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        <span className="text-xs">Cargando serie intradía...</span>
                    </div>
                ) : intradayError ? (
                    <div className="h-72 flex items-center justify-center text-red-400 text-xs bg-red-500/5 rounded-2xl border border-red-500/10">
                        {intradayError}
                    </div>
                ) : intradayData.length === 0 ? (
                    <div className="h-72 flex flex-col items-center justify-center text-gray-500 text-xs bg-white/5 border border-white/5 rounded-2xl p-6 text-center gap-1">
                        <Info className="w-5 h-5 text-gray-500" />
                        <span className="font-bold text-gray-400 mt-1">Sin datos de snapshots para esta fecha</span>
                        <span className="text-[10px] text-gray-600 max-w-xs">Los snapshots se capturan automáticamente cada 5 minutos durante la jornada de ventas.</span>
                    </div>
                ) : (
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {intradayViewMode === 'cumulative' ? (
                                <AreaChart data={intradayData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIntradayAll" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorIntraday01" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorIntraday02" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="hora" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        labelClassName="text-gray-400 text-xs font-bold"
                                        formatter={(value: any, name: any) => [formatCOP(Number(value)), String(name)]}
                                    />
                                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                    <Area 
                                        type="monotone" 
                                        name="General (Consolidado)"
                                        dataKey="venta_all"
                                        stroke="#94a3b8"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorIntradayAll)"
                                    />
                                    <Area 
                                        type="monotone" 
                                        name="BD1 (Interna)"
                                        dataKey="venta_01"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorIntraday01)"
                                    />
                                    <Area 
                                        type="monotone" 
                                        name="BD2 (Fiscal)"
                                        dataKey="venta_02"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorIntraday02)"
                                    />
                                </AreaChart>
                            ) : (
                                <LineChart data={intradayData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="hora" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        labelClassName="text-gray-400 text-xs font-bold"
                                        formatter={(value: any, name: any) => [formatCOP(Number(value)), String(name)]}
                                    />
                                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                    <Line 
                                        type="monotone" 
                                        name="General (Consolidado)"
                                        dataKey="delta_venta_all"
                                        stroke="#94a3b8"
                                        strokeWidth={2.5}
                                        dot={true}
                                    />
                                    <Line 
                                        type="monotone" 
                                        name="BD1 (Interna)"
                                        dataKey="delta_venta_01"
                                        stroke="#6366f1"
                                        strokeWidth={1.8}
                                        dot={true}
                                    />
                                    <Line 
                                        type="monotone" 
                                        name="BD2 (Fiscal)"
                                        dataKey="delta_venta_02"
                                        stroke="#10b981"
                                        strokeWidth={1.8}
                                        dot={true}
                                    />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="border-t border-white/10 my-6"></div>

            {/* --- SECCIÓN B: ANÁLISIS HISTÓRICO Y RENTABILIDAD --- */}
            <div className="space-y-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div>
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <Layers className="w-5 h-5 text-emerald-400" />
                            Análisis de Tendencias Históricas y Rentabilidad
                        </h3>
                        <p className="text-gray-400 text-xs mt-1">Monitoreo acumulativo de márgenes de ganancia y volúmenes facturados del ERP.</p>
                    </div>

                    {/* Controles de Filtros Históricos */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="flex bg-slate-900 border border-white/10 rounded-xl p-0.5">
                            <button 
                                onClick={() => setPeriodDays(7)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    periodDays === 7 
                                        ? 'bg-emerald-600 text-white font-bold' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                7D
                            </button>
                            <button 
                                onClick={() => setPeriodDays(30)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    periodDays === 30 
                                        ? 'bg-emerald-600 text-white font-bold' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                30D
                            </button>
                            <button 
                                onClick={() => setPeriodDays(90)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    periodDays === 90 
                                        ? 'bg-emerald-600 text-white font-bold' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                90D
                            </button>
                        </div>

                        <select 
                            value={selectedClassification}
                            onChange={(e) => setSelectedClassification(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 w-full lg:w-48 font-medium cursor-pointer"
                        >
                            <option value="ALL">Todas las Categorías</option>
                            {stats?.classifications.map(cl => (
                                <option key={cl} value={cl}>{cl}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {errorMsg ? (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-6 text-center space-y-2">
                        <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                        <h3 className="font-bold text-white text-lg">Error de Acceso</h3>
                        <p className="text-sm max-w-md mx-auto">{errorMsg}</p>
                    </div>
                ) : loading ? (
                    <div className="py-24 text-center text-gray-400 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                        <p className="text-sm font-medium animate-pulse">Cargando análisis de ventas y rentabilidad...</p>
                    </div>
                ) : stats ? (
                    <div className="space-y-8">
                        {/* KPIs Aggregated Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500"></div>
                            <div className="p-3 bg-blue-500/10 rounded-xl w-fit mb-4">
                                <DollarSign className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-gray-400 text-xs font-semibold block">Total Facturado</span>
                            <span className="text-2xl font-bold text-white block mt-1">{formatCOP(stats.totalSales)}</span>
                            <span className="text-[10px] text-gray-500 mt-2 block">Bruto consolidado en el período</span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                            <div className="p-3 bg-emerald-500/10 rounded-xl w-fit mb-4">
                                <Activity className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-gray-400 text-xs font-semibold block">Margen Promedio</span>
                            <span className={`text-2xl font-bold block mt-1 ${stats.avgMarginPct >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {stats.avgMarginPct.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-gray-500 mt-2 block">Excluyendo SKUs corruptos del ERP</span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all duration-500"></div>
                            <div className="p-3 bg-red-500/10 rounded-xl w-fit mb-4">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="text-gray-400 text-xs font-semibold block">Márgenes Negativos</span>
                            <span className={`text-2xl font-bold block mt-1 ${stats.negativeMarginCount > 0 ? 'text-red-400' : 'text-white'}`}>
                                {stats.negativeMarginCount} SKUs
                            </span>
                            <span className="text-[10px] text-gray-500 mt-2 block">Productos vendidos por debajo de costo</span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500"></div>
                            <div className="p-3 bg-amber-500/10 rounded-xl w-fit mb-4">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <span className="text-gray-400 text-xs font-semibold block">Rotación Nula (Dead Stock)</span>
                            <span className="text-2xl font-bold text-white block mt-1">{stats.deadStockCount} SKUs</span>
                            <span className="text-[10px] text-gray-500 mt-2 block">Con stock sistema &gt; 0 pero 0 ventas</span>
                        </div>
                    </div>

                    {/* Gráficos de Tendencias */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-blue-400" />
                                Tendencia de Ventas Diarias
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                            labelClassName="text-gray-400 text-xs"
                                            formatter={(value: any) => [formatCOP(Number(value)), 'Venta Bruta']}
                                        />
                                        <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                Margen Diario Promedio
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                            labelClassName="text-gray-400 text-xs"
                                            formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Margen']}
                                        />
                                        <Line type="monotone" dataKey="margenPct" stroke="#10b981" strokeWidth={2.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Rankings Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Top Ventas */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                Más Vendidos (Top Ventas)
                            </h3>
                            {stats.topSellers.length === 0 ? (
                                <p className="text-gray-500 text-xs py-8 text-center">No hay registros de ventas en este período.</p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.topSellers.map((s, idx) => (
                                        <div key={s.sku} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                            <div className="space-y-0.5 max-w-[70%]">
                                                <span className="text-gray-400 text-[10px] font-mono">{s.sku}</span>
                                                <p className="text-white text-xs font-semibold truncate">{s.descripcion}</p>
                                                <span className="text-gray-500 text-[10px] block">{s.cantidad} unidades vendidas</span>
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <span className="text-white text-xs font-bold block">{formatCOP(s.total)}</span>
                                                <span className={`text-[10px] font-semibold ${s.marginPct >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    Margen: {s.marginPct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Dead Stock */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                Rotación Nula (Dead Stock)
                            </h3>
                            {stats.bottomSellers.length === 0 ? (
                                <p className="text-emerald-400 text-xs py-8 text-center flex items-center justify-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    ¡Todos los productos tienen movimiento!
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.bottomSellers.map(s => (
                                        <div key={s.sku} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                            <div className="space-y-0.5 max-w-[70%]">
                                                <span className="text-gray-400 text-[10px] font-mono">{s.sku}</span>
                                                <p className="text-white text-xs font-semibold truncate">{s.descripcion}</p>
                                                <span className="text-gray-500 text-[10px] block">{s.classification} | {s.brand}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-amber-400 text-xs font-bold block">{s.system_stock} unds</span>
                                                <span className="text-gray-500 text-[9px]">Stock inmovilizado</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Alerta Márgenes Críticos */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-red-400" />
                                Márgenes Críticos / Negativos
                            </h3>
                            {stats.negativeMargins.length === 0 ? (
                                <p className="text-emerald-400 text-xs py-8 text-center flex items-center justify-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Márgenes saludables en todas las ventas
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.negativeMargins.map(s => (
                                        <div key={s.sku} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                            <div className="space-y-0.5 max-w-[70%]">
                                                <span className="text-gray-400 text-[10px] font-mono">{s.sku}</span>
                                                <p className="text-white text-xs font-semibold truncate">{s.descripcion}</p>
                                                <span className="text-gray-500 text-[10px] block">Facturado: {formatCOP(s.total)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-xs font-bold block ${s.marginPct < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                                    {s.marginPct.toFixed(1)}%
                                                </span>
                                                <span className="text-gray-500 text-[9px] block">Margen crítico</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
            </div>

            {/* Ficha de Producto (Drill-Down) */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6">
                <div>
                    <h3 className="text-white font-bold text-lg">Ficha de Producto</h3>
                    <p className="text-gray-400 text-xs mt-1">Busca un producto por SKU para auditar su rotación, rentabilidad e historial de descuadres cíclicos.</p>
                </div>

                <form onSubmit={handleSearchProduct} className="flex gap-3 max-w-md">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Buscar SKU (ej. 502089, 1002008)…" 
                            value={searchSku}
                            onChange={(e) => setSearchSku(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full h-11"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={searchingDetail || !searchSku.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl text-sm font-bold flex items-center gap-1.5 h-11 shrink-0 transition-all"
                    >
                        {searchingDetail ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <span>Buscar</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                {detailError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-xs flex items-start gap-2 max-w-md">
                        <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <span>{detailError}</span>
                    </div>
                )}

                <AnimatePresence>
                    {productDetail && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="border border-white/5 bg-white/5 rounded-2xl p-5 space-y-6"
                        >
                            {/* Cabecera del producto */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/5">
                                <div className="space-y-1">
                                    <span className="text-gray-400 text-xs font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">{productDetail.sku}</span>
                                    <h4 className="text-white font-bold text-xl mt-2">{productDetail.description}</h4>
                                    <div className="flex gap-4 text-gray-500 text-xs mt-1">
                                        <span>Categoría: <strong className="text-gray-300">{productDetail.classification || 'General'}</strong></span>
                                        <span>Marca: <strong className="text-gray-300">{productDetail.brand || 'Genérica'}</strong></span>
                                        <span>Unidad: <strong className="text-gray-300">{productDetail.unit || 'Und'}</strong></span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-400 text-xs block">Costo Kardex Promedio</span>
                                    <span className="text-white text-xl font-bold block mt-0.5">{formatCOP(productDetail.costAvg)}</span>
                                </div>
                            </div>

                            {/* Grid de Métricas del Producto */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase tracking-wider">Unidades Vendidas</span>
                                    <span className="text-xl font-bold text-white block mt-1">{productDetail.totalSoldQty} unds</span>
                                </div>
                                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase tracking-wider">Ingresos Facturados</span>
                                    <span className="text-xl font-bold text-white block mt-1">{formatCOP(productDetail.totalRevenue)}</span>
                                </div>
                                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase tracking-wider">Margen % Real</span>
                                    <span className={`text-xl font-bold block mt-1 ${
                                        CORRUPT_SKUS.includes(productDetail.sku) 
                                            ? 'text-gray-400' 
                                            : productDetail.avgMarginPct >= 20 
                                                ? 'text-emerald-400' 
                                                : productDetail.avgMarginPct < 0 
                                                    ? 'text-red-400' 
                                                    : 'text-amber-400'
                                    }`}>
                                        {CORRUPT_SKUS.includes(productDetail.sku) ? 'CORRUPTO (ERP)' : `${productDetail.avgMarginPct.toFixed(2)}%`}
                                    </span>
                                </div>
                                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase tracking-wider">Stock (Sistema / Físico)</span>
                                    <span className="text-xl font-bold text-white block mt-1">
                                        {productDetail.systemStock} / <span className="text-emerald-400">{productDetail.physicalStock ?? '—'}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Gráfico e Historial de Ventas */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4">
                                    <span className="text-white text-xs font-bold block mb-3 uppercase tracking-wider">Tendencia de Ventas (Cantidad)</span>
                                    {productDetail.salesTrend.length === 0 ? (
                                        <p className="text-gray-500 text-xs py-12 text-center">Este producto no registra ventas.</p>
                                    ) : (
                                        <div className="h-48 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={productDetail.salesTrend} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorProdSales" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis dataKey="fecha" stroke="#64748b" fontSize={9} />
                                                    <YAxis stroke="#64748b" fontSize={9} />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                                        labelClassName="text-gray-400 text-[10px]"
                                                        formatter={(value: any) => [`${value} unidades`, 'Cantidad']}
                                                    />
                                                    <Area type="monotone" dataKey="cantidad" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorProdSales)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4">
                                    <span className="text-white text-xs font-bold block mb-3 uppercase tracking-wider">Últimas Transacciones de Venta</span>
                                    {productDetail.recentSales.length === 0 ? (
                                        <p className="text-gray-500 text-xs py-12 text-center">Sin transacciones registradas.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="text-gray-500 border-b border-white/5">
                                                        <th className="pb-2 font-medium">Fecha</th>
                                                        <th className="pb-2 font-medium">Factura</th>
                                                        <th className="pb-2 font-medium text-right">Cant.</th>
                                                        <th className="pb-2 font-medium text-right">Precio</th>
                                                        <th className="pb-2 font-medium text-right">Margen</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {productDetail.recentSales.map((s, i) => (
                                                        <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                            <td className="py-2 text-gray-400">{s.fecha}</td>
                                                            <td className="py-2 text-white font-mono">{s.tipodoc}-{s.numero}</td>
                                                            <td className="py-2 text-white text-right font-bold">{s.cantidad}</td>
                                                            <td className="py-2 text-white text-right">{formatCOP(s.precio)}</td>
                                                            <td className={`py-2 text-right font-semibold ${
                                                                CORRUPT_SKUS.includes(productDetail.sku) 
                                                                    ? 'text-gray-400' 
                                                                    : s.margenPct >= 20 
                                                                        ? 'text-emerald-400' 
                                                                        : s.margenPct < 0 
                                                                            ? 'text-red-400' 
                                                                            : 'text-amber-400'
                                                            }`}>
                                                                {CORRUPT_SKUS.includes(productDetail.sku) ? 'CORRUPTO' : `${s.margenPct.toFixed(1)}%`}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Historial de Auditoría de Conteos Cíclicos */}
                            <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4">
                                <span className="text-white text-xs font-bold block mb-3 uppercase tracking-wider">Historial de Descuadres y Mermas (Conteo Cíclico)</span>
                                {productDetail.countsHistory.length === 0 ? (
                                    <p className="text-gray-500 text-xs py-8 text-center">Este producto no ha sido registrado en ninguna sesión de conteo cíclico.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="text-gray-500 border-b border-white/5">
                                                    <th className="pb-2 font-medium">Sesión</th>
                                                    <th className="pb-2 font-medium">Fecha</th>
                                                    <th className="pb-2 font-medium text-right">Stock Sistema</th>
                                                    <th className="pb-2 font-medium text-right">Físico Contado</th>
                                                    <th className="pb-2 font-medium text-right">Diferencia</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {productDetail.countsHistory.map((c, i) => (
                                                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                        <td className="py-2 text-white font-semibold">{c.sessionName}</td>
                                                        <td className="py-2 text-gray-400">{new Date(c.countedAt).toLocaleDateString('es-CO')}</td>
                                                        <td className="py-2 text-white text-right">{c.mileniumStock}</td>
                                                        <td className="py-2 text-emerald-400 text-right font-bold">{c.physicalCount}</td>
                                                        <td className={`py-2 text-right font-bold ${
                                                            c.delta === 0 
                                                                ? 'text-gray-400' 
                                                                : c.delta < 0 
                                                                    ? 'text-red-400 bg-red-400/5 px-2 rounded-lg' 
                                                                    : 'text-blue-400 bg-blue-400/5 px-2 rounded-lg'
                                                        }`}>
                                                            {c.delta > 0 ? `+${c.delta}` : c.delta}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
