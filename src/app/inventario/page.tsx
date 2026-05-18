'use client';

import React, { useState } from 'react';
import { UnifiedStockTable } from '@/components/inventory/UnifiedStockTable';
import { CyclicCountWizard } from '@/components/inventory/CyclicCountWizard';
import { 
  Package, 
  AlertTriangle, 
  History, 
  Plus, 
  ArrowUpRight,
  ClipboardCheck,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatsCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md hover:bg-white/10 transition-all group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
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
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  </motion.div>
);

export default function InventarioPage() {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Inventario</h1>
          <p className="text-gray-400 mt-1">Sincronización multi-base de datos y control cíclico.</p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl transition-all h-11">
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
                onClick={() => setShowWizard(false)}
                className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                title="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
              <CyclicCountWizard onComplete={() => setShowWizard(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Productos" 
          value="1,248" 
          icon={Package} 
          color="bg-blue-500/20" 
        />
        <StatsCard 
          title="Descuadres Detectados" 
          value="12" 
          icon={AlertTriangle} 
          color="bg-amber-500/20" 
        />
        <StatsCard 
          title="Conteos Pendientes" 
          value="5" 
          icon={ClipboardCheck} 
          color="bg-emerald-500/20" 
        />
        <StatsCard 
          title="Última Sincronización" 
          value="Hace 5m" 
          icon={History} 
          color="bg-purple-500/20" 
        />
      </div>

      {/* Unified Table Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Catálogo Unificado</h2>
          <span className="text-xs text-gray-500">Mostrando datos de DB 01 e DB 02</span>
        </div>
        
        <UnifiedStockTable />
      </div>
    </div>
  );
}
