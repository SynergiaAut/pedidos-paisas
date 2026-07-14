'use client';

import React, { useEffect, useState } from 'react';
import { getInventoryQualityReport, QualityReportItem } from '@/app/actions/sales-analytics';
import { 
    AlertTriangle, 
    Download, 
    Loader2, 
    CheckCircle2, 
    Search,
    Filter,
    ShieldAlert
} from 'lucide-react';

export function DataQualityTab() {
    const [report, setReport] = useState<QualityReportItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('ALL');

    const loadQualityReport = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const result = await getInventoryQualityReport();
            if ('error' in result) {
                setErrorMsg(result.error);
                setReport([]);
            } else {
                setReport(result);
            }
        } catch (e) {
            setErrorMsg('Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQualityReport();
    }, []);

    // Exportar listado a CSV
    const exportToCSV = () => {
        if (report.length === 0) return;

        // Cabeceras de columna
        const headers = ['SKU', 'Descripcion', 'Tipo Inconsistencia', 'Severidad', 'Detalles', 'Valor BD1 (Interna)', 'Valor BD2 (Fiscal)'];
        
        // Mapear filas
        const rows = filteredReport.map(item => [
            `"${item.sku}"`,
            `"${item.description.replace(/"/g, '""')}"`,
            `"${item.inconsistencyType}"`,
            `"${item.severity}"`,
            `"${item.details.replace(/"/g, '""')}"`,
            `"${(item.db1Value || '').replace(/"/g, '""')}"`,
            `"${(item.db2Value || '').replace(/"/g, '""')}"`
        ]);

        // Unir con saltos de línea
        const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        
        // Crear blob y descargar
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `auditoria_calidad_inventario_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filtrar reporte en base a búsqueda y selector
    const filteredReport = report.filter(item => {
        const matchesSearch = 
            item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.details.toLowerCase().includes(searchQuery.toLowerCase());
            
        const matchesFilter = filterType === 'ALL' || item.inconsistencyType === filterType;
        
        return matchesSearch && matchesFilter;
    });

    const getSeverityStyles = (severity: 'high' | 'medium' | 'low') => {
        switch (severity) {
            case 'high':
                return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'medium':
                return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'low':
                return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
    };

    const translateType = (type: string) => {
        switch (type) {
            case 'description_divergence':
                return 'Descripción Divergente';
            case 'unit_divergence':
                return 'Unidad Divergente';
            case 'stock_outlier':
                return 'Outlier de Stock';
            case 'cost_outlier':
                return 'Outlier de Costo';
            case 'missing_unit':
                return 'Falta Unidad';
            default:
                return type;
        }
    };

    return (
        <div className="space-y-6">
            {/* Cabecera del Reporte */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                <div className="space-y-1">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                        Reporte de Calidad de Datos ERP
                    </h3>
                    <p className="text-gray-400 text-xs">Identifica inconsistencias y valores atípicos en Millenium ERP para su corrección directa en origen.</p>
                </div>
                
                {report.length > 0 && (
                    <button 
                        onClick={exportToCSV}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        <span>Exportar a Excel (CSV)</span>
                    </button>
                )}
            </div>

            {/* Controles de Búsqueda y Filtro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Buscar por SKU, descripción…" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 w-full h-10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500 shrink-0" />
                    <select 
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 w-full h-10 font-medium cursor-pointer"
                    >
                        <option value="ALL">Todas las Discrepancias</option>
                        <option value="description_divergence">Descripción Divergente</option>
                        <option value="unit_divergence">Unidad Divergente</option>
                        <option value="stock_outlier">Valores de Stock Atípicos</option>
                        <option value="cost_outlier">Valores de Costo Atípicos</option>
                        <option value="missing_unit">Falta Unidad de Medida</option>
                    </select>
                </div>

                <div className="flex items-center justify-end text-xs text-gray-500">
                    Mostrando {filteredReport.length} discrepancias encontradas
                </div>
            </div>

            {errorMsg ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-6 text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                    <h3 className="font-bold text-white text-lg">Error de Carga</h3>
                    <p className="text-sm max-w-md mx-auto">{errorMsg}</p>
                </div>
            ) : loading ? (
                <div className="py-24 text-center text-gray-400 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                    <p className="text-sm font-medium animate-pulse">Auditando catálogo en busca de discrepancias...</p>
                </div>
            ) : filteredReport.length === 0 ? (
                <div className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-2xl p-12 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                    <h3 className="font-bold text-white text-base">¡Catálogo sin discrepancias activas!</h3>
                    <p className="text-xs max-w-sm mx-auto text-gray-400">No se encontraron inconsistencias para el filtro seleccionado.</p>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="text-gray-400 bg-white/5 border-b border-white/10">
                                    <th className="p-4 font-bold">SKU</th>
                                    <th className="p-4 font-bold">Descripción / Producto</th>
                                    <th className="p-4 font-bold">Discrepancia</th>
                                    <th className="p-4 font-bold">Severidad</th>
                                    <th className="p-4 font-bold">Detalles de Auditoría</th>
                                    <th className="p-4 font-bold text-right">Valor BD1 (Int.)</th>
                                    <th className="p-4 font-bold text-right">Valor BD2 (Fis.)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReport.map((item, idx) => (
                                    <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-mono font-bold text-white">{item.sku}</td>
                                        <td className="p-4 text-white max-w-[200px] truncate">{item.description}</td>
                                        <td className="p-4 text-gray-300 font-semibold">{translateType(item.inconsistencyType)}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getSeverityStyles(item.severity)}`}>
                                                {item.severity.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-400 max-w-[280px] truncate">{item.details}</td>
                                        <td className="p-4 text-right text-gray-400 font-mono">{item.db1Value || '—'}</td>
                                        <td className="p-4 text-right text-gray-400 font-mono">{item.db2Value || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
