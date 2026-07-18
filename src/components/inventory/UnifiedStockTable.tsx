'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Database, RefreshCw, AlertCircle, Calendar, Scale } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { DbBadge } from '../ui/DbBadge';
import {
  getStockInterpretation,
  StockInterpretationMode,
  formatNumber,
} from '@/lib/inventory-unit-interpretation';

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
  { value: 'raw', label: 'Dato ERP' },
  { value: 'as_grams', label: 'Si crudo = gramos' },
  { value: 'as_pounds', label: 'Si crudo = libras' },
  { value: 'packages_from_grams', label: 'Paquetes desde gramos' },
];

const formatCOP = (n: number | null | undefined) =>
  n && n > 0 ? `$${Math.round(n).toLocaleString('es-CO')}` : '—';

export const UnifiedStockTable = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | '01' | '02'>('all');
  const [showServices, setShowServices] = useState(false);
  const [rowLimit, setRowLimit] = useState<number | 'all'>(100);
  const [interpretationMode, setInterpretationMode] = useState<StockInterpretationMode>('as_grams');

  useEffect(() => {
    fetchProducts();

    // Suscripción en tiempo real
    const channel = supabase
      .channel('inventory_master_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_master' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSource, showServices]);

  const fetchProducts = async () => {
    setLoading(true);
    // PostgREST limita a 1000 filas por request: paginamos el catálogo completo.
    const PAGE = 1000;
    const all: Product[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from('inventory_master')
        .select('*')
        .order('last_counted_at', { ascending: false, nullsFirst: false })
        .order('description')
        .range(from, from + PAGE - 1);

      if (filterSource !== 'all') query = query.eq('db_source', filterSource);
      if (!showServices) query = query.eq('is_service', false);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching products:', error);
        break;
      }
      all.push(...(data || []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }

    setProducts(all);
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.includes(searchTerm) ||
    p.barcode?.includes(searchTerm) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.classification?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const visibleProducts = rowLimit === 'all' ? filteredProducts : filteredProducts.slice(0, rowLimit);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, SKU o código..."
            className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setFilterSource('all')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${filterSource === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilterSource('01')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${filterSource === '01' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Database className="w-3 h-3" /> Interna (01)
          </button>
          <button 
            onClick={() => setFilterSource('02')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${filterSource === '02' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Database className="w-3 h-3" /> Fiscal (02)
          </button>
          <button
            onClick={() => setShowServices(!showServices)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${showServices ? 'bg-amber-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            title="Incluir fletes/servicios sin bodega"
          >
            Servicios
          </button>

          <select
            value={rowLimit === 'all' ? 'all' : String(rowLimit)}
            onChange={(e) => setRowLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ml-2"
            title="Filas a mostrar"
          >
            {ROW_OPTIONS.map((n) => (
              <option key={n} value={n} className="bg-gray-900">{n} filas</option>
            ))}
            <option value="all" className="bg-gray-900">Todas</option>
          </select>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <Scale className="w-4 h-4 text-cyan-300" />
            <select
              value={interpretationMode}
              onChange={(e) => setInterpretationMode(e.target.value as StockInterpretationMode)}
              className="bg-transparent text-gray-300 text-xs focus:outline-none"
              title="Unidad de visualizacion"
            >
              {INTERPRETATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchProducts}
            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-3 border-b border-white/10 bg-cyan-500/5 text-xs text-cyan-100/80 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <span>
            Stock ERP intacto. La interpretacion solo traduce escenarios de lectura para validar unidades con inventario.
          </span>
          <span className="text-cyan-300 font-semibold">
            Vista actual: {INTERPRETATION_OPTIONS.find((option) => option.value === interpretationMode)?.label}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-wider">Origen</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider">SKU / Barra</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Costo Prom.</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Stock Sistema</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider">Interpretacion</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Stock Físico</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Cargando inventario...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                visibleProducts.map((p) => {
                  const interpretation = getStockInterpretation({
                    description: p.description,
                    systemStock: p.system_stock,
                    unit: p.unit,
                    needsReview: p.needs_review,
                  }, interpretationMode);

                  return (
                  <tr key={`${p.db_source}-${p.sku}`} className={`hover:bg-white/5 transition-colors ${interpretation.isSuspicious ? 'bg-amber-500/[0.03]' : ''}`}>
                    <td className="px-6 py-4">
                      <DbBadge db={p.db_source} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{p.description}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">
                            {[p.classification, p.brand !== 'SIN MARCA' ? p.brand : null].filter(Boolean).join(' · ') || '—'}
                          </span>
                          {p.last_counted_at && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <Calendar className="w-2.5 h-2.5" />
                              Contado {formatDistanceToNow(new Date(p.last_counted_at), { addSuffix: true, locale: es })}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      <div className="flex flex-col">
                        <span>{p.sku}</span>
                        <span className="text-[10px] opacity-60">{p.barcode || 'Sin barra'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-400">{formatCOP(p.cost_avg)}</td>
                    <td className="px-6 py-4 text-right font-mono text-gray-300">
                      <div className="flex flex-col">
                        <span>{formatNumber(Number(p.system_stock) || 0, 4)}</span>
                        <span className="text-[10px] text-gray-500 font-sans">{p.unit || 'Sin unidad'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 min-w-[220px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-cyan-100">{interpretation.value}</span>
                          {interpretation.isAmbiguous && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-300"
                              title={p.review_reason || 'Unidad pendiente de validar'}
                            >
                              REVISAR UNIDAD
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500">{interpretation.detail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-300">
                       {p.physical_stock !== null ? p.physical_stock : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                       {p.system_stock !== p.physical_stock && p.physical_stock !== null ? (
                         <div className="flex items-center gap-1 text-amber-500" title="Diferencia de inventario">
                           <AlertCircle className="w-4 h-4" />
                           <span className="text-[10px] font-bold">DESCUADRE</span>
                         </div>
                       ) : (
                         <span className="text-gray-600 text-[10px]">Sincronizado</span>
                       )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie: conteo de filas */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 text-xs text-gray-500">
          <span>
            Mostrando {visibleProducts.length.toLocaleString('es-CO')} de {filteredProducts.length.toLocaleString('es-CO')} productos
            {searchTerm && ` (filtro: "${searchTerm}")`}
          </span>
          {rowLimit !== 'all' && filteredProducts.length > (rowLimit as number) && (
            <button onClick={() => setRowLimit('all')} className="text-blue-400 hover:text-blue-300 transition-colors">
              Ver todas →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
