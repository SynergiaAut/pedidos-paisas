"use client";

import React, { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Calendar, Database, RefreshCw, Scale, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatNumber, getStockInterpretation, type StockInterpretationMode } from "@/lib/inventory-unit-interpretation";
import { cn } from "@/lib/utils";
import { DbBadge } from "../ui/DbBadge";

interface Product {
  db_source: string;
  item_id: number | null;
  sku: string;
  barcode: string | null;
  description: string;
  system_stock: number;
  physical_stock: number | null;
  last_counted_at: string | null;
  is_service?: boolean;
  classification?: string | null;
  brand?: string | null;
  unit?: string | null;
  cost_avg?: number | null;
  last_sync_at: string | null;
  needs_review?: boolean | null;
  review_reason?: string | null;
}

const ROW_OPTIONS = [100, 250, 500, 1000] as const;
const INTERPRETATION_OPTIONS: { value: StockInterpretationMode; label: string }[] = [
  { value: "raw", label: "Dato ERP" },
  { value: "as_grams", label: "Si crudo = gramos" },
  { value: "as_pounds", label: "Si crudo = libras" },
  { value: "packages_from_grams", label: "Paquetes desde gramos" },
];

const formatCOP = (value: number | null | undefined) =>
  value && value > 0 ? `$${Math.round(value).toLocaleString("es-CO")}` : "-";

export const UnifiedStockTable = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "01" | "02">("all");
  const [showServices, setShowServices] = useState(false);
  const [rowLimit, setRowLimit] = useState<number | "all">(100);
  const [interpretationMode, setInterpretationMode] = useState<StockInterpretationMode>("as_grams");

  const fetchProducts = async () => {
    setLoading(true);
    const pageSize = 1000;
    const rows: Product[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from("inventory_master")
        .select("*")
        .order("last_counted_at", { ascending: false, nullsFirst: false })
        .order("description")
        .range(from, from + pageSize - 1);

      if (filterSource !== "all") query = query.eq("db_source", filterSource);
      if (!showServices) query = query.eq("is_service", false);

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching products:", error);
        break;
      }

      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    setProducts(rows);
    setLoading(false);
  };

  useEffect(() => {
    void fetchProducts();

    const channel = supabase
      .channel("inventory_master_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_master" }, () => {
        void fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSource, showServices]);

  const filteredProducts = products.filter((product) =>
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.includes(searchTerm) ||
    product.barcode?.includes(searchTerm) ||
    product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.classification?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const visibleProducts = rowLimit === "all" ? filteredProducts : filteredProducts.slice(0, rowLimit);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por descripcion, SKU o codigo..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-white outline-none transition focus:border-brand"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "all", label: "Todos" },
              { value: "01", label: "Interna (01)" },
              { value: "02", label: "Fiscal (02)" },
            ].map((source) => (
              <button
                key={source.value}
                onClick={() => setFilterSource(source.value as "all" | "01" | "02")}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-black transition",
                  filterSource === source.value
                    ? "bg-brand text-black"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-white"
                )}
              >
                {source.value !== "all" && <Database className="h-3 w-3" />}
                {source.label}
              </button>
            ))}

            <button
              onClick={() => setShowServices((value) => !value)}
              className={cn(
                "h-9 rounded-md px-3 text-xs font-black transition",
                showServices
                  ? "border border-amber-500/30 bg-amber-500/15 text-amber-200"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-white"
              )}
              title="Incluir fletes/servicios sin bodega"
            >
              Servicios
            </button>

            <select
              value={rowLimit === "all" ? "all" : String(rowLimit)}
              onChange={(event) => setRowLimit(event.target.value === "all" ? "all" : Number(event.target.value))}
              className="h-9 rounded-md border border-border bg-background px-3 text-xs font-bold text-slate-300 outline-none focus:border-brand"
              title="Filas a mostrar"
            >
              {ROW_OPTIONS.map((rows) => (
                <option key={rows} value={rows}>
                  {rows} filas
                </option>
              ))}
              <option value="all">Todas</option>
            </select>

            <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3">
              <Scale className="h-4 w-4 text-cyan-300" />
              <select
                value={interpretationMode}
                onChange={(event) => setInterpretationMode(event.target.value as StockInterpretationMode)}
                className="bg-transparent text-xs font-bold text-slate-300 outline-none"
                title="Unidad de visualizacion"
              >
                {INTERPRETATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => void fetchProducts()}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted/40"
              title="Actualizar catalogo"
            >
              <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border bg-cyan-500/5 px-5 py-3 text-xs text-cyan-100/80 md:flex-row md:items-center md:justify-between">
          <span>Stock ERP intacto. La interpretacion solo traduce escenarios de lectura para validar unidades con inventario.</span>
          <span className="font-black text-cyan-300">
            Vista actual: {INTERPRETATION_OPTIONS.find((option) => option.value === interpretationMode)?.label}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/25 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-xs font-black uppercase">Origen</th>
                <th className="px-5 py-3 text-xs font-black uppercase">Producto</th>
                <th className="px-5 py-3 text-xs font-black uppercase">SKU / Barra</th>
                <th className="px-5 py-3 text-right text-xs font-black uppercase">Costo Prom.</th>
                <th className="px-5 py-3 text-right text-xs font-black uppercase">Stock Sistema</th>
                <th className="px-5 py-3 text-xs font-black uppercase">Interpretacion</th>
                <th className="px-5 py-3 text-right text-xs font-black uppercase">Stock Fisico</th>
                <th className="px-5 py-3 text-xs font-black uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-brand" />
                    Cargando inventario...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                visibleProducts.map((product) => {
                  const interpretation = getStockInterpretation(
                    {
                      description: product.description,
                      systemStock: product.system_stock,
                      unit: product.unit,
                      needsReview: product.needs_review,
                    },
                    interpretationMode
                  );

                  return (
                    <tr
                      key={`${product.db_source}-${product.sku}`}
                      className={cn("transition hover:bg-muted/20", interpretation.isSuspicious && "bg-amber-500/[0.03]")}
                    >
                      <td className="px-5 py-4">
                        <DbBadge db={product.db_source} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{product.description}</span>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {[product.classification, product.brand !== "SIN MARCA" ? product.brand : null].filter(Boolean).join(" · ") || "-"}
                            </span>
                            {product.last_counted_at && (
                              <span className="flex shrink-0 items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                                <Calendar className="h-2.5 w-2.5" />
                                Contado {formatDistanceToNow(new Date(product.last_counted_at), { addSuffix: true, locale: es })}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                        <div className="flex flex-col">
                          <span>{product.sku}</span>
                          <span className="text-[10px] opacity-60">{product.barcode || "Sin barra"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-gray-400">{formatCOP(product.cost_avg)}</td>
                      <td className="px-5 py-4 text-right font-mono text-gray-300">
                        <div className="flex flex-col">
                          <span>{formatNumber(Number(product.system_stock) || 0, 4)}</span>
                          <span className="font-sans text-[10px] text-muted-foreground">{product.unit || "Sin unidad"}</span>
                        </div>
                      </td>
                      <td className="min-w-[220px] px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-cyan-100">{interpretation.value}</span>
                            {interpretation.isAmbiguous && (
                              <span
                                className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black text-amber-300"
                                title={product.review_reason || "Unidad pendiente de validar"}
                              >
                                REVISAR UNIDAD
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{interpretation.detail}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-gray-300">
                        {product.physical_stock !== null ? product.physical_stock : "-"}
                      </td>
                      <td className="px-5 py-4">
                        {product.system_stock !== product.physical_stock && product.physical_stock !== null ? (
                          <div className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300">
                            <AlertCircle className="h-4 w-4" />
                            DESCUADRE
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground">Sincronizado</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            Mostrando {visibleProducts.length.toLocaleString("es-CO")} de {filteredProducts.length.toLocaleString("es-CO")} productos
            {searchTerm && ` · filtro: "${searchTerm}"`}
          </span>
          {rowLimit !== "all" && filteredProducts.length > rowLimit && (
            <button onClick={() => setRowLimit("all")} className="font-black text-brand transition hover:text-brand/80">
              Ver todas
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
