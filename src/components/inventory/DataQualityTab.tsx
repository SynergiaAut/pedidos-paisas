"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Filter, Loader2, Search, ShieldAlert } from "lucide-react";
import { getInventoryQualityReport, type QualityReportItem } from "@/app/actions/sales-analytics";

export function DataQualityTab() {
    const [report, setReport] = useState<QualityReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("ALL");

    const loadQualityReport = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const result = await getInventoryQualityReport();
            if ("error" in result) {
                setErrorMsg(result.error);
                setReport([]);
            } else {
                setReport(result);
            }
        } catch {
            setErrorMsg("Error al conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadQualityReport();
    }, []);

    const filteredReport = report.filter((item) => {
        const matchesSearch =
            item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.details.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesFilter = filterType === "ALL" || item.inconsistencyType === filterType;
        return matchesSearch && matchesFilter;
    });

    const exportToCSV = () => {
        if (report.length === 0) return;

        const headers = ["SKU", "Descripcion", "Tipo Inconsistencia", "Severidad", "Detalles", "Valor BD1 (Interna)", "Valor BD2 (Fiscal)"];
        const rows = filteredReport.map((item) => [
            `"${item.sku}"`,
            `"${item.description.replace(/"/g, '""')}"`,
            `"${item.inconsistencyType}"`,
            `"${item.severity}"`,
            `"${item.details.replace(/"/g, '""')}"`,
            `"${(item.db1Value || "").replace(/"/g, '""')}"`,
            `"${(item.db2Value || "").replace(/"/g, '""')}"`,
        ]);

        const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
        const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `auditoria_calidad_inventario_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getSeverityStyles = (severity: "high" | "medium" | "low") => {
        switch (severity) {
            case "high":
                return "text-red-200 bg-red-500/10 border-red-500/25";
            case "medium":
                return "text-amber-200 bg-amber-500/10 border-amber-500/25";
            case "low":
                return "text-blue-200 bg-blue-500/10 border-blue-500/25";
        }
    };

    const translateType = (type: string) => {
        switch (type) {
            case "description_divergence":
                return "Descripcion divergente";
            case "unit_divergence":
                return "Unidad divergente";
            case "stock_outlier":
                return "Outlier de stock";
            case "cost_outlier":
                return "Outlier de costo";
            case "missing_unit":
                return "Falta unidad";
            default:
                return type;
        }
    };

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-black text-white">
                            <ShieldAlert className="h-5 w-5 text-brand" />
                            Reporte de Calidad de Datos ERP
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Identifica inconsistencias y valores atipicos para corregirlos en Milenium.
                        </p>
                    </div>

                    {report.length > 0 && (
                        <button
                            onClick={exportToCSV}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-black text-black transition hover:bg-brand/90"
                        >
                            <Download className="h-4 w-4" />
                            Exportar CSV
                        </button>
                    )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_320px_220px] md:items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar por SKU, descripcion o detalle..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-sm text-white outline-none transition focus:border-brand"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <select
                            value={filterType}
                            onChange={(event) => setFilterType(event.target.value)}
                            className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background pl-9 pr-3 text-sm font-bold text-white outline-none transition focus:border-brand"
                        >
                            <option value="ALL">Todas las discrepancias</option>
                            <option value="description_divergence">Descripcion divergente</option>
                            <option value="unit_divergence">Unidad divergente</option>
                            <option value="stock_outlier">Valores de stock atipicos</option>
                            <option value="cost_outlier">Valores de costo atipicos</option>
                            <option value="missing_unit">Falta unidad de medida</option>
                        </select>
                    </div>

                    <div className="rounded-lg border border-border bg-background px-4 py-2 text-right">
                        <p className="text-xs font-black uppercase text-muted-foreground">Hallazgos</p>
                        <p className="text-lg font-black text-white">{filteredReport.length.toLocaleString("es-CO")}</p>
                    </div>
                </div>
            </div>

            {errorMsg ? (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-8 text-center text-red-200">
                    <AlertTriangle className="mx-auto mb-3 h-9 w-9" />
                    <h3 className="text-lg font-black text-white">Error de carga</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm">{errorMsg}</p>
                </div>
            ) : loading ? (
                <div className="rounded-lg border border-border bg-card py-24 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand" />
                    <p className="text-sm font-bold">Auditando catalogo en busca de discrepancias...</p>
                </div>
            ) : filteredReport.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-12 text-center text-emerald-300">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10" />
                    <h3 className="text-base font-black text-white">Catalogo sin discrepancias activas</h3>
                    <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">No se encontraron inconsistencias para el filtro seleccionado.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-border bg-muted/25 text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-black uppercase">SKU</th>
                                    <th className="p-4 font-black uppercase">Producto</th>
                                    <th className="p-4 font-black uppercase">Discrepancia</th>
                                    <th className="p-4 font-black uppercase">Severidad</th>
                                    <th className="p-4 font-black uppercase">Auditoria</th>
                                    <th className="p-4 text-right font-black uppercase">BD1 Interna</th>
                                    <th className="p-4 text-right font-black uppercase">BD2 Fiscal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredReport.map((item, index) => (
                                    <tr key={`${item.sku}-${index}`} className="transition hover:bg-muted/20">
                                        <td className="p-4 font-mono font-black text-white">{item.sku}</td>
                                        <td className="max-w-[240px] truncate p-4 font-bold text-white" title={item.description}>{item.description}</td>
                                        <td className="p-4 font-bold text-gray-300">{translateType(item.inconsistencyType)}</td>
                                        <td className="p-4">
                                            <span className={`rounded border px-2.5 py-1 text-[10px] font-black ${getSeverityStyles(item.severity)}`}>
                                                {item.severity.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="max-w-[320px] truncate p-4 text-gray-400" title={item.details}>{item.details}</td>
                                        <td className="p-4 text-right font-mono text-gray-400">{item.db1Value || "-"}</td>
                                        <td className="p-4 text-right font-mono text-gray-400">{item.db2Value || "-"}</td>
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
