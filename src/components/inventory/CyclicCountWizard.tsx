'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Box, 
  Search, 
  Save, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CyclicCountWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [sessionName, setSessionName] = useState(`Conteo Semanal - ${new Date().toLocaleDateString()}`);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('inventory_master').select('category');
    const unique = Array.from(new Set(data?.map(d => d.category).filter(Boolean)));
    setCategories(unique as string[]);
  };

  const startCounting = async () => {
    setLoading(true);
    let query = supabase.from('inventory_master').select('*');
    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }
    const { data } = await query;
    setItems(data || []);
    setStep(2);
    setLoading(false);
  };

  const handleCountChange = (id: string, value: string) => {
    setCounts(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const finishCount = async () => {
    setLoading(true);
    
    // 1. Crear la sesión
    const { data: session, error: sError } = await supabase
      .from('inventory_sessions')
      .insert({
        name: sessionName,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sError) {
      alert('Error creando sesión: ' + sError.message);
      setLoading(false);
      return;
    }

    // 2. Insertar los conteos
    const countsToInsert = items.map(item => ({
      session_id: session.id,
      inventory_item_id: item.id,
      expected_stock: item.system_stock,
      counted_stock: counts[item.id] ?? item.system_stock, // Default to system if not touched? Or 0?
    }));

    const { error: cError } = await supabase.from('inventory_counts').insert(countsToInsert);

    if (cError) {
      alert('Error guardando conteos: ' + cError.message);
    } else {
      // 3. Actualizar el stock maestro (opcional, dependiendo de si queremos que el conteo pise el sistema)
      // Por ahora solo guardamos el registro.
      setStep(3);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl max-w-4xl mx-auto shadow-2xl">
      {/* Header Progreso */}
      <div className="flex border-b border-white/10">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`flex-1 py-4 text-center text-xs font-bold tracking-widest uppercase transition-all ${step === s ? 'text-blue-400 bg-white/5' : 'text-gray-600'}`}
          >
            Paso {s}: {s === 1 ? 'Configuración' : s === 2 ? 'Conteo' : 'Finalizar'}
          </div>
        ))}
      </div>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-400">Nombre de la Sesión</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-400">Filtrar por Categoría (Para conteo segmentado)</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">Todas las Categorías</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="pt-6">
                <button 
                  onClick={startCounting}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {loading ? 'Preparando...' : 'Comenzar Conteo'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {items.map((item) => (
                  <div key={item.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{item.description}</p>
                      <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Box className="w-3 h-3"/> {item.sku}</span>
                        <span className="bg-white/5 px-2 rounded">{item.category}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase">Sistema</p>
                        <p className="text-sm font-mono text-gray-300">{item.system_stock}</p>
                      </div>
                      <input 
                        type="number"
                        placeholder="Físico"
                        className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-right focus:border-blue-500 outline-none"
                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-all"
                >
                  Atrás
                </button>
                <button 
                  onClick={finishCount}
                  disabled={loading}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                   <Save className="w-5 h-5" />
                   {loading ? 'Guardando...' : 'Finalizar y Guardar'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">¡Conteo Finalizado!</h2>
                <p className="text-gray-400">La sesión ha sido guardada y los descuadres han sido registrados.</p>
              </div>
              <button 
                onClick={onComplete}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl transition-all"
              >
                Volver al Inventario
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
