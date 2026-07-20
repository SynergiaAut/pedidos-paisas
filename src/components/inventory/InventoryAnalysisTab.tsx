'use client';

import React, { useEffect, useState } from 'react';
import { 
    getSessionsSummary, 
    getDiscrepancyTrend, 
    getCoverage, 
    getProblemProductsRanking,
    getInventoryValuation,
    getSessionDetail,
    SessionSummary,
    DiscrepancyTrendPoint,
    CoverageStats,
    ProblemProductRanking,
    InventoryValuation,
    SessionDetail
} from '@/app/actions/inventory-analytics';
import { 
    AlertTriangle, 
    TrendingUp, 
    Layers, 
    Monitor, 
    Smartphone, 
    Calendar,
    DollarSign,
    Loader2,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

function formatCOP(value: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function InventoryAnalysisTab() {
    const [loading, setLoading] = useState(true);
    const [coverage, setCoverage] = useState<CoverageStats | null>(null);
    const [trend, setTrend] = useState<DiscrepancyTrendPoint[]>([]);
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [ranking, setRanking] = useState<ProblemProductRanking[]>([]);
    const [valuation, setValuation] = useState<InventoryValuation | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Estados para el modal de detalle de sesión (TASK-D27)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const handleRowClick = async (sessionId: string) => {
        setSelectedSessionId(sessionId);
        setLoadingDetail(true);
        try {
            const res = await getSessionDetail(sessionId);
            if ('error' in res) {
                alert(`Error al cargar el detalle: ${res.error}`);
            } else {
                setSessionDetail(res);
            }
        } catch (err) {
            console.error('[InventoryAnalysis] Error al cargar detalle:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [covRes, trendRes, sessRes, rankRes, valRes] = await Promise.all([
                getCoverage(),
                getDiscrepancyTrend(),
                getSessionsSummary(),
                getProblemProductsRanking(),
                getInventoryValuation()
            ]);

            if ('error' in covRes) throw new Error(covRes.error);
            if ('error' in trendRes) throw new Error(trendRes.error);
            if ('error' in sessRes) throw new Error(sessRes.error);
            if ('error' in rankRes) throw new Error(rankRes.error);
            if ('error' in valRes) throw new Error(valRes.error);

            setCoverage(covRes);
            setTrend(trendRes);
            setSessions(sessRes);
            setRanking(rankRes);
            setValuation(valRes);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Error inesperado al cargar la analitica.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-gray-400 text-sm font-medium">Analizando historial de conteos físicos...</p>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center space-y-3 max-w-lg mx-auto">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                <h3 className="text-white font-bold text-lg">Error de Carga</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{errorMsg}</p>
                <button 
                    onClick={loadData}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition-all"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 1. Tarjeta de Cobertura (TASK-D07) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-1 bg-card border border-border rounded-lg p-4 backdrop-blur-md flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                                <Layers className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-gray-300 text-sm font-bold uppercase tracking-wider">Cobertura de Catálogo</h3>
                        </div>
                        <p className="text-5xl font-extrabold text-white mt-2">
                            {coverage ? `${coverage.percentage}%` : '0%'}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            {coverage ? `${coverage.counted.toLocaleString('es-CO')} de ${coverage.total.toLocaleString('es-CO')} productos del catálogo físico han sido contados alguna vez.` : ''}
                        </p>
                    </div>

                    {/* Barra de progreso */}
                    <div className="mt-6 space-y-2">
                        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${coverage ? coverage.percentage : 0}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="bg-emerald-500 h-full rounded-full"
                            />
                        </div>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block text-right">
                            {coverage ? `${coverage.total - coverage.counted} productos a ciegas` : ''}
                        </span>
                    </div>
                </motion.div>

                {/* 2. Resumen rápido de discrepancias monetarias */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 bg-card border border-border rounded-lg p-4 backdrop-blur-md flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-amber-500/20 rounded-lg">
                                <DollarSign className="w-5 h-5 text-amber-400" />
                            </div>
                            <h3 className="text-gray-300 text-sm font-bold uppercase tracking-wider">Valor Estimado de Descuadres</h3>
                        </div>
                        <p className="text-4xl font-extrabold text-white mt-2">
                            {sessions.length > 0 
                                ? formatCOP(sessions.reduce((acc, s) => acc + s.discrepancy_value, 0))
                                : formatCOP(0)
                            }
                        </p>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                            Magnitud económica agregada de las discrepancias físicas vs el stock del sistema en base a su costo promedio de adquisición (`cost_avg`). Ayuda a dimensionar la merma total en pesos colombianos.
                        </p>
                    </div>
                    <div className="mt-6 flex justify-between items-center text-xs text-gray-500 border-t border-border pt-4">
                        <span>SESIONES AGREGADAS: {sessions.length}</span>
                        <span>DISCREPANCIAS TOTALES: {sessions.reduce((acc, s) => acc + s.discrepancies, 0)}</span>
                    </div>
                </motion.div>
            </div>

            {/* Valorización y Pérdidas de Inventario (TASK-D24) */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card border border-border rounded-lg p-4 backdrop-blur-md space-y-4"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                        <Layers className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Valorización y Pérdidas de Inventario</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Estimación económica operativa calculada según el costo promedio de adquisición (cost_avg) de los productos.</p>
                        <p className="text-[10px] text-emerald-400/80 mt-1 italic font-medium">Nota: El descuadre neto se reconcilia automáticamente al cierre de cada sesión comparando contra el stock fresco del ERP para neutralizar ventas ocurridas durante el conteo.</p>
                    </div>
                </div>

                {/* Alerta de costos unitarios sospechosos (outliers) */}
                {valuation && valuation.suspiciousCostItems && valuation.suspiciousCostItems.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2 text-red-300">
                        <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                            <span>{valuation.suspiciousCostItems.length} producto(s) con costo unitario sospechoso excluido(s)</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            Se detectaron artículos con costos promedio fuera de rango (umbral mayor a $5.000.000 COP) que han sido omitidos para no distorsionar las estadísticas analíticas. Por favor revisa y corrige en Milenium:
                        </p>
                        <ul className="text-[10px] space-y-1 list-disc pl-5 font-mono text-red-200/80">
                            {valuation.suspiciousCostItems.map((item, idx) => (
                                <li key={idx}>
                                    SKU {item.sku}: {item.description} (Costo: {formatCOP(item.cost_avg)} COP)
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-black/30 border border-border rounded-lg p-4 space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Valor Total Catálogo</span>
                        <p className="text-2xl font-extrabold text-white">{formatCOP(valuation?.totalInventoryValue || 0)}</p>
                        <p className="text-[9px] text-gray-500">Todo el stock del sistema no-servicio</p>
                    </div>
                    <div className="bg-black/30 border border-border rounded-lg p-4 space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Valor Contado (Auditado)</span>
                        <p className="text-2xl font-extrabold text-white">{formatCOP(valuation?.countedInventoryValue || 0)}</p>
                        <p className="text-[9px] text-gray-500">Productos contados al menos una vez</p>
                    </div>
                    <div className="bg-black/30 border border-border rounded-lg p-4 space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Costo Total Descuadres</span>
                        <p className="text-2xl font-extrabold text-amber-500">{formatCOP(valuation?.totalDiscrepancyValue || 0)}</p>
                        <p className="text-[9px] text-gray-500">Mermas y discrepancias detectadas</p>
                    </div>
                    <div className="bg-black/30 border border-border rounded-lg p-4 space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Porcentaje de Pérdida</span>
                        <p className="text-2xl font-extrabold text-red-400">
                            {valuation ? `${valuation.lossPercentage}%` : '0%'}
                        </p>
                        <p className="text-[9px] text-gray-500">Descuadres sobre valor auditado</p>
                    </div>
                </div>

                {/* Texto secundario de cobertura de costos en Milenium */}
                {valuation && valuation.zeroCostPercentage > 0 && (
                    <p className="text-[11px] text-gray-400 leading-relaxed italic">
                        * El <strong>{valuation.zeroCostPercentage}%</strong> del catálogo físico ({valuation.zeroCostCount} productos no-servicio) no tiene costo promedio registrado en el ERP Milenium (cost_avg = 0), por lo que suman $0 a las valorizaciones.
                    </p>
                )}

                {/* Nota aclaratoria financiera visible */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-1.5 text-amber-300">
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-[11px] leading-relaxed">
                            Estos valores son estimados a partir de costos promedio y conteos físicos operativos — <strong>no constituyen un estado financiero oficial</strong>. Para cifras contables consulta el ERP Milenium.
                        </p>
                    </div>
                    <div className="text-[10px] text-gray-400 border-t border-border pt-2 pl-6">
                        {(() => {
                            const dbSourceNames = (valuation?.dbSourcesIncluded || []).map(src => {
                                if (src === '01') return 'Empresa 1 (GRANESLOSPAISAS)';
                                if (src === '02') return 'Empresa 2 (PAISASFISCAL)';
                                return `BD ${src}`;
                            });
                            const dbText = dbSourceNames.length > 0 
                                ? `Cifras calculadas solo sobre: ${dbSourceNames.join(', ')}`
                                : 'Sin bases de datos de origen cargadas';
                            const hasBD2 = (valuation?.dbSourcesIncluded || []).includes('02');
                            return `${dbText} — ${!hasBD2 ? 'Empresa 2 (PAISASFISCAL) aún no está integrada.' : ''}`;
                        })()}
                    </div>
                </div>
            </motion.div>

            {/* 3. Gráfico de Tendencia (TASK-D08) */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-lg p-6 backdrop-blur-md"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-blue-500/20 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Tendencia de Descuadres</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Evolución de discrepancias y su costo estimado a través del historial de sesiones completadas.</p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    {trend.length === 0 ? (
                        <div className="h-full flex items-center justify-center border border-dashed border-border rounded-lg">
                            <p className="text-gray-400 text-sm">Completa sesiones de conteo para visualizar la tendencia en el tiempo.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trend} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="rgba(255,255,255,0.5)" 
                                    fontSize={10} 
                                    tickLine={false}
                                />
                                <YAxis 
                                    yAxisId="left"
                                    stroke="#3b82f6" 
                                    fontSize={10} 
                                    tickLine={false}
                                    label={{ value: 'Cantidad de Descuadres', angle: -90, position: 'insideLeft', style: { fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' } }}
                                />
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#10b981" 
                                    fontSize={10} 
                                    tickLine={false}
                                    tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
                                    label={{ value: 'Valor Descuadre (COP)', angle: 90, position: 'insideRight', style: { fill: '#10b981', fontSize: 10, fontWeight: 'bold' } }}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    labelClassName="text-white text-xs font-bold"
                                    formatter={(value, name) => {
                                        if (name === 'discrepancy_value') return [formatCOP(Number(value)), 'Valor del Descuadre'];
                                        return [value, 'Cantidad de Descuadres'];
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                <Line 
                                    yAxisId="left"
                                    type="monotone" 
                                    dataKey="discrepancies" 
                                    name="Descuadres (Items)" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    activeDot={{ r: 6 }}
                                />
                                <Line 
                                    yAxisId="right"
                                    type="monotone" 
                                    dataKey="discrepancy_value" 
                                    name="Valor Descuadre (COP)" 
                                    stroke="#10b981" 
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </motion.div>

            {/* 4. Tablas: Historial y Ranking (TASK-D09 & TASK-D10) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Historial de Sesiones */}
                <motion.div 
                    id="historial-sesiones"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-card border border-border rounded-lg p-6 backdrop-blur-md flex flex-col"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <h3 className="text-white font-bold text-lg">Historial de Sesiones</h3>
                    </div>
                    
                    <div className="overflow-x-auto flex-1 max-h-[400px] custom-scrollbar">
                        {sessions.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 text-sm">No se han registrado sesiones de conteo aún.</div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-gray-400 font-bold uppercase">
                                        <th className="pb-3 pr-2">Nombre / Modo</th>
                                        <th className="pb-3 pr-2">Categoría</th>
                                        <th className="pb-3 pr-2">Fecha</th>
                                        <th className="pb-3 text-center">Items</th>
                                        <th className="pb-3 text-center">Descuadres</th>
                                        <th className="pb-3 text-right">Valor Descuadre</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {sessions.map((sess) => (
                                        <tr 
                                            key={sess.session_id} 
                                            onClick={() => handleRowClick(sess.session_id)}
                                            className="hover:bg-muted/40 cursor-pointer transition-colors"
                                        >
                                            <td className="py-3 pr-2 font-medium">
                                                <div className="flex items-center gap-2">
                                                     {sess.mode === 'mobile_link' ? (
                                                         <span title="Link móvil" className="flex shrink-0">
                                                             <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                                                         </span>
                                                     ) : (
                                                         <span title="Escritorio" className="flex shrink-0">
                                                             <Monitor className="w-3.5 h-3.5 text-slate-400" />
                                                         </span>
                                                     )}
                                                     <span className="line-clamp-1">{sess.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-2">
                                                <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${sess.category_filter ? 'bg-blue-500/20 text-blue-400 border border-blue-500/10' : 'bg-slate-500/20 text-slate-400'}`}>
                                                    {sess.category_filter || 'Todas'}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-2 text-gray-400">{formatDate(sess.completed_at || sess.started_at)}</td>
                                            <td className="py-3 text-center font-semibold">{sess.items_counted}</td>
                                            <td className="py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${sess.discrepancies > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    {sess.discrepancies}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right font-mono font-bold text-gray-400">{formatCOP(sess.discrepancy_value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>

                {/* Ranking de Productos Problemáticos */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-card border border-border rounded-lg p-6 backdrop-blur-md flex flex-col"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <div>
                            <h3 className="text-white font-bold text-lg">Fugas Recurrentes</h3>
                            <p className="text-[10px] text-gray-400">Productos con descuadre en 2 o más sesiones distintas.</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto flex-1 max-h-[400px] custom-scrollbar">
                        {ranking.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg text-center p-4">
                                <AlertTriangle className="w-8 h-8 text-gray-500 mb-2" />
                                <p className="text-gray-400 text-sm font-semibold">Aún no hay suficientes sesiones para detectar patrones.</p>
                                <p className="text-gray-500 text-[10px] mt-1">Los productos aparecerán en este ranking si registran diferencias físicas en 2 o más sesiones independientes.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-gray-400 font-bold uppercase">
                                        <th className="pb-3 pr-2">Producto / SKU</th>
                                        <th className="pb-3 text-center">Sesiones</th>
                                        <th className="pb-3 text-right">Magnitud Acumulada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {ranking.map((prod) => (
                                        <tr key={prod.item_master_id} className="hover:bg-muted/20">
                                            <td className="py-3 pr-2">
                                                <div className="space-y-0.5">
                                                    <span className="font-semibold line-clamp-1" title={prod.description}>{prod.description}</span>
                                                    <span className="text-[10px] text-gray-500 font-mono block">SKU: {prod.sku}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="bg-red-500/20 text-red-400 font-extrabold px-2 py-0.5 rounded-full text-[10px]">
                                                    {prod.sesiones_con_descuadre}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right font-mono font-bold text-amber-500">{formatCOP(prod.magnitud_acumulada)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Modal de Detalle de Sesión (TASK-D27) */}
            <AnimatePresence>
                {selectedSessionId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-background border border-border w-full max-w-4xl rounded-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
                        >
                            {/* Botón de cerrar */}
                            <button
                                onClick={() => {
                                    setSelectedSessionId(null);
                                    setSessionDetail(null);
                                }}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
                                title="Cerrar modal"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {loadingDetail && !sessionDetail ? (
                                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                                    <p className="text-gray-400 text-xs">Cargando desglose de la sesión...</p>
                                </div>
                            ) : sessionDetail ? (
                                <>
                                    {/* Header */}
                                    <div className="p-6 border-b border-border space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${sessionDetail.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                {sessionDetail.status === 'completed' ? 'Completado' : 'En Curso'}
                                            </span>
                                            {sessionDetail.category_filter && (
                                                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/10 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    Categoría: {sessionDetail.category_filter}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">{sessionDetail.name}</h2>
                                        <p className="text-[11px] text-gray-500">
                                            Iniciado: {formatDate(sessionDetail.started_at)}
                                            {sessionDetail.completed_at && ` · Finalizado: ${formatDate(sessionDetail.completed_at)}`}
                                        </p>
                                    </div>

                                    {/* Métricas consolidadas de la sesión */}
                                    <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-muted/10 border-b border-border">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Artículos Contados</span>
                                            <p className="text-xl font-extrabold text-white">{sessionDetail.items.length}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Productos con Diferencia</span>
                                            <p className="text-xl font-extrabold text-amber-500">
                                                {sessionDetail.items.filter((it: SessionDetail['items'][number]) => it.diferencia !== 0).length}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Valor de Descuadres</span>
                                            <p className="text-xl font-extrabold text-red-400">
                                                {formatCOP(sessionDetail.items.reduce((acc: number, it: SessionDetail['items'][number]) => acc + it.valor_descuadre, 0))}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Contenido / Detalle de ítems */}
                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                                        <div className="border border-border rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-muted/20 text-gray-400 font-bold uppercase">
                                                    <tr>
                                                        <th className="p-3 pr-2">Producto / SKU</th>
                                                        <th className="p-3 text-center">Esperado (ERP)</th>
                                                        <th className="p-3 text-center">Contado</th>
                                                        <th className="p-3 text-center">Diferencia</th>
                                                        <th className="p-3 text-right">Costo Promedio</th>
                                                        <th className="p-3 text-right">Valor Descuadre</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300">
                                                    {sessionDetail.items.map((item: SessionDetail['items'][number], idx: number) => {
                                                        const hasDiscrepancy = item.diferencia !== 0;
                                                        return (
                                                            <tr key={idx} className={`hover:bg-muted/10 ${hasDiscrepancy ? 'bg-amber-500/[0.03]' : ''}`}>
                                                                <td className="p-3 pr-2">
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-semibold block line-clamp-1" title={item.description}>{item.description}</span>
                                                                            {item.reconciliation_note && (
                                                                                <span 
                                                                                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 text-[9px] font-extrabold px-1.5 py-0.5 rounded cursor-help shrink-0"
                                                                                    title={item.reconciliation_note}
                                                                                >
                                                                                    Reconciliado
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-500 font-mono block">SKU: {item.sku}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-medium text-gray-400">
                                                                    {item.system_stock_at_close !== null && item.system_stock_at_close !== undefined ? (
                                                                        <div className="flex flex-col items-center justify-center" title={item.reconciliation_note || ''}>
                                                                            <span className="line-through text-gray-600 text-[10px]">{item.expected_stock}</span>
                                                                            <span className="text-emerald-400 text-xs font-bold">{item.system_stock_at_close}</span>
                                                                        </div>
                                                                    ) : (
                                                                        item.expected_stock
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-white">{item.counted_quantity}</td>
                                                                <td className="p-3 text-center font-mono font-extrabold">
                                                                    <span className={`px-2 py-0.5 rounded-md ${item.diferencia > 0 ? 'bg-blue-500/10 text-blue-400' : item.diferencia < 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right font-mono text-gray-500">{formatCOP(item.cost_avg)}</td>
                                                                <td className={`p-3 text-right font-mono font-bold ${item.valor_descuadre > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                                    {formatCOP(item.valor_descuadre)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-4 border-t border-border bg-background flex justify-end">
                                        <button
                                            onClick={() => {
                                                setSelectedSessionId(null);
                                                setSessionDetail(null);
                                            }}
                                            className="bg-muted/20 hover:bg-muted/40 border border-border text-white font-bold py-2 px-5 rounded-lg transition-all text-xs"
                                        >
                                            Cerrar Detalle
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-10 text-center text-gray-400 text-xs">Ocurrió un error inesperado al recuperar el detalle de la sesión.</div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
