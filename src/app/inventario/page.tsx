'use client';

import React, { useEffect, useState } from 'react';
import { UnifiedStockTable } from '@/components/inventory/UnifiedStockTable';
import { CyclicCountWizard } from '@/components/inventory/CyclicCountWizard';
import { InventoryAnalysisTab } from '@/components/inventory/InventoryAnalysisTab';
import { BehaviorTab } from '@/components/inventory/BehaviorTab';
import { 
  Package, 
  AlertTriangle, 
  History, 
  Plus, 
  ArrowUpRight,
  ClipboardCheck,
  Boxes,
  X
} from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getInventoryStats, triggerInventorySync, InventoryStats } from '@/app/actions/inventory';

const StatsCard = ({ title, value, subtitle, icon: Icon, trend, color, onClick, cursorPointer }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={`bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md transition-all group ${
      cursorPointer ? 'cursor-pointer hover:bg-white/10' : ''
    }`}
  >
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend && (
        <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
          <ArrowUpRight className="w-3 h-3 mr-1" />
          {trend}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
    </div>
  </motion.div>
);

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nunca';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'analysis' | 'behavior'>('catalog');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPendingSession, setSelectedPendingSession] = useState<any | null>(null);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadStats = async () => {
    const result = await getInventoryStats();
    if (!('error' in result)) setStats(result);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('Sincronizando con Milenium… puede tardar hasta 1 minuto por base.');
    try {
      const result = await triggerInventorySync('all');
      if ('error' in result) {
        setSyncMsg(`❌ ${result.error}`);
      } else {
        const parts = result.results.map((r) =>
          r.error ? `BD${r.db_source}: ❌ ${r.error}` : `BD${r.db_source}: ${r.upserted} productos`
        );
        setSyncMsg(`${result.status === 'success' ? '✅' : '⚠️'} ${parts.join(' · ')} (${(result.duration_ms / 1000).toFixed(1)}s)`);
        await loadStats();
      }
    } catch (e) {
      setSyncMsg(`❌ Error inesperado: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleGoToHistory = () => {
    setActiveTab('analysis');
    setTimeout(() => {
      const el = document.getElementById('historial-sesiones');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Inventario</h1>
          <p className="text-gray-400 mt-1">Sincronización multi-base de datos y control cíclico.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition-all h-11 font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando…' : 'Sincronizar'}</span>
          </button>

          <button 
            onClick={handleGoToHistory}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl transition-all h-11 font-semibold"
          >
            <History className="w-4 h-4" />
            <span>Historial</span>
          </button>
          
          <button 
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/20 font-bold h-11"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Conteo</span>
          </button>
        </div>
      </div>

      {/* Wizard Overlay */}
      <AnimatePresence>
        {showWizard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl relative"
            >
              <button 
                onClick={() => { setShowWizard(false); setSelectedPendingSession(null); }}
                className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                title="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
              <CyclicCountWizard 
                onComplete={() => { setShowWizard(false); setSelectedPendingSession(null); loadStats(); }} 
                initialSession={selectedPendingSession}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resultado del sync */}
      {syncMsg && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300">
          {syncMsg}
        </div>
      )}

      {/* Stats Grid (datos reales de inventory_master) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatsCard
          title="Total Productos"
          value={stats ? stats.totalProducts.toLocaleString('es-CO') : '…'}
          subtitle={stats ? `+ ${stats.totalServices.toLocaleString('es-CO')} servicios/fletes (${(stats.totalProducts + stats.totalServices).toLocaleString('es-CO')} ítems en el ERP)` : undefined}
          icon={Package}
          color="bg-blue-500/20"
        />
        <StatsCard
          title="Unidades en Stock"
          value={stats ? Math.round(stats.stockUnits).toLocaleString('es-CO') : '…'}
          subtitle={stats ? `BD1: ${Math.round(stats.stockUnitsByDb['01'] ?? 0).toLocaleString('es-CO')} · BD2: ${Math.round(stats.stockUnitsByDb['02'] ?? 0).toLocaleString('es-CO')}` : undefined}
          icon={Boxes}
          color="bg-cyan-500/20"
        />
        <StatsCard
          title="Descuadres Detectados"
          value={stats ? stats.discrepancies.toLocaleString('es-CO') : '…'}
          subtitle="Conteo físico ≠ stock del sistema"
          icon={AlertTriangle}
          color="bg-amber-500/20"
        />
        <StatsCard
          title="Conteos Pendientes"
          value={stats ? stats.pendingSessions.toLocaleString('es-CO') : '…'}
          subtitle={stats && stats.pendingSession ? `Reanudar: ${stats.pendingSession.name}` : "Sesiones de conteo sin completar"}
          icon={ClipboardCheck}
          color="bg-emerald-500/20"
          cursorPointer={stats && stats.pendingSessions > 0}
          onClick={() => {
            if (stats && stats.pendingSession) {
              setSelectedPendingSession(stats.pendingSession);
              setShowWizard(true);
            }
          }}
        />
        <StatsCard
          title="Última Sincronización"
          value={stats ? timeAgo(stats.lastSyncAt) : '…'}
          subtitle="Desde Milenium vía API Flex CRM"
          icon={History}
          color="bg-purple-500/20"
        />
      </div>

      {/* Tabs de Navegación */}
      <div className="border-b border-white/10 pb-px mb-6 flex gap-4">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'catalog'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Catálogo Unificado
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'analysis'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Análisis y Consolidados
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'behavior'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Comportamiento
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'catalog' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Catálogo de Productos</h2>
              <span className="text-xs text-gray-500">Mostrando datos de DB 01 e DB 02</span>
            </div>
            
            <UnifiedStockTable />
          </div>
        ) : activeTab === 'analysis' ? (
          <InventoryAnalysisTab />
        ) : (
          <BehaviorTab />
        )}
      </div>
    </div>
  );
}
