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
  AlertCircle,
  Laptop,
  Smartphone,
  Copy,
  Share2,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  createMobileCountSession, 
  closeMobileCountSession, 
  getMobileSessionProgress,
  pauseMobileCountSession,
  resumeMobileCountSession
} from '@/app/actions/mobile-count';
import { saveDesktopInventoryCount } from '@/app/actions/inventory';

export const CyclicCountWizard = ({ 
  onComplete,
  initialSession
}: { 
  onComplete: () => void;
  initialSession?: { id: string; name: string; mode: 'desktop' | 'mobile_link'; link_token: string | null } | null;
}) => {
  const [step, setStep] = useState(1);
  const [sessionName, setSessionName] = useState(`Conteo Semanal - ${new Date().toLocaleDateString()}`);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Estados nuevos para el modo móvil
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileToken, setMobileToken] = useState('');
  const [mobileUrl, setMobileUrl] = useState('');
  const [mobileSessionId, setMobileSessionId] = useState('');
  const [mobileProgress, setMobileProgress] = useState({ counted: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [recentCounts, setRecentCounts] = useState<any[]>([]);
  const [sessionPaused, setSessionPaused] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (initialSession) {
      if (initialSession.mode === 'mobile_link') {
        setMobileSessionId(initialSession.id);
        setMobileToken(initialSession.link_token || '');
        setMobileUrl(`${window.location.origin}/conteo/${initialSession.link_token || ''}`);
        setSessionName(initialSession.name);
        setMode('mobile');
        setStep(4);
        
        // Consultar estado de pausa
        const checkStatus = async () => {
          const { data, error } = await supabase
            .from('inventory_sessions')
            .select('status')
            .eq('id', initialSession.id)
            .single();
          if (data && data.status === 'paused') {
            setSessionPaused(true);
          }
        };
        checkStatus();
      }
    }
  }, [initialSession]);

  // Suscripción Realtime para el progreso móvil
  useEffect(() => {
    if (step !== 4 || !mobileSessionId) return;

    // Cargar progreso inicial
    const initProgress = async () => {
      const res = await getMobileSessionProgress(mobileSessionId);
      if (res && 'counted' in res) {
        setMobileProgress(res);
      }
    };
    initProgress();

    // Suscribirse a inserciones de conteo físico para esta sesión
    const channel = supabase
      .channel(`live-progress-${mobileSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_counts',
          filter: `session_id=eq.${mobileSessionId}`
        },
        async (payload) => {
          // 1. Recalcular progreso
          const progress = await getMobileSessionProgress(mobileSessionId);
          if (progress && 'counted' in progress) {
            setMobileProgress(progress);
          }

          // 2. Agregar a la lista de recientes
          const newCount = payload.new as any;
          const matchingItem = items.find(it => it.id === newCount.item_master_id);
          const description = matchingItem ? matchingItem.description : 'Producto desconocido';
          const sku = matchingItem ? matchingItem.sku : '';

          setRecentCounts(prev => [
            {
              id: newCount.id,
              description,
              sku,
              quantity: newCount.counted_quantity,
              counter_name: newCount.counter_name || 'Bodeguero',
              time: new Date(newCount.counted_at).toLocaleTimeString()
            },
            ...prev.slice(0, 4) // Mantener solo los últimos 5
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [step, mobileSessionId, items]);

  const fetchCategories = async () => {
    // classification viene del ERP (DESCRIPCION_CLASIFICACION) via sync
    const { data } = await supabase.from('inventory_master').select('classification').eq('is_service', false);
    const unique = Array.from(new Set(data?.map(d => d.classification).filter(Boolean)));
    setCategories((unique as string[]).sort());
  };

  const startCounting = async () => {
    setLoading(true);
    let query = supabase.from('inventory_master').select('*').eq('is_service', false);
    if (selectedCategory !== 'all') {
      query = query.eq('classification', selectedCategory);
    }
    const { data } = await query;
    const itemsData = data || [];
    setItems(itemsData);

    if (mode === 'desktop') {
      setStep(2);
      setLoading(false);
    } else {
      // Crear sesión móvil
      const res = await createMobileCountSession({
        name: sessionName,
        categoryFilter: selectedCategory,
        hoursValid: 24
      });

      if ('error' in res && res.error) {
        alert('Error creando sesión de conteo móvil: ' + res.error);
        setLoading(false);
        return;
      }

      if ('success' in res && res.success && res.session) {
        setMobileSessionId(res.session.id);
        setMobileToken(res.token);
        setMobileUrl(res.url || '');
        setMobileProgress({ counted: 0, total: itemsData.length });
        setRecentCounts([]);
        setStep(4); // Paso móvil
      }
      setLoading(false);
    }
  };

  const handleCountChange = (id: string, value: string) => {
    setCounts(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const finishCount = async () => {
    setLoading(true);
    
    const itemsCounts = items.map(item => ({
      id: item.id,
      system_stock: item.system_stock,
      counted_quantity: counts[item.id] ?? item.system_stock
    }));

    const res = await saveDesktopInventoryCount({
      sessionName,
      categoryFilter: selectedCategory,
      itemsCounts
    });

    if (res.error) {
      alert('Error guardando conteos: ' + res.error);
    } else {
      setStep(3);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl max-w-4xl mx-auto shadow-2xl">
      {/* Header Progreso */}
      <div className="flex border-b border-white/10">
        {[1, 2, 3].map((s) => {
          const isActive = step === s || (s === 2 && step === 4);
          const label = s === 1 ? 'Configuración' : s === 2 ? 'Conteo' : 'Finalizar';
          return (
            <div 
              key={s} 
              className={`flex-1 py-4 text-center text-xs font-bold tracking-widest uppercase transition-all ${isActive ? 'text-blue-400 bg-white/5' : 'text-gray-600'}`}
            >
              Paso {s}: {label}
            </div>
          );
        })}
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  style={{ colorScheme: 'dark' }}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all" className="bg-gray-900 text-white">Todas las Categorías</option>
                  {categories.map(c => <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>)}
                </select>
              </div>

              {/* Selector de modo */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-400">¿Cómo se contará?</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setMode('desktop')}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${mode === 'desktop' ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'}`}
                  >
                    <Laptop className="w-6 h-6" />
                    <span className="text-xs font-bold">Desde este computador</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('mobile')}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${mode === 'mobile' ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'}`}
                  >
                    <Smartphone className="w-6 h-6" />
                    <span className="text-xs font-bold">Conteo móvil (compartir link)</span>
                  </button>
                </div>
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
                {[...items]
                  .sort((a, b) => {
                    const hasA = a.id in counts;
                    const hasB = b.id in counts;
                    if (hasA && !hasB) return -1;
                    if (!hasA && hasB) return 1;
                    return 0;
                  })
                  .map((item) => (
                    <div key={item.id} className={`bg-white/5 border rounded-xl p-4 flex items-center justify-between gap-4 transition-colors ${item.id in counts ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-white/5'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{item.description}</p>
                        <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><Box className="w-3 h-3"/> {item.sku}</span>
                          {/* BUG FIX: item.category -> item.classification */}
                          <span className="bg-white/5 px-2 rounded">{item.classification}</span>
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
                          className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-right focus:border-blue-500 outline-none font-bold"
                          value={counts[item.id] !== undefined ? counts[item.id] : ''}
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

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {sessionPaused ? (
                 <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                   <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                   <div className="space-y-1">
                     <p className="text-white text-sm font-semibold">Sesión de Conteo Pausada</p>
                     <p className="text-gray-400 text-xs leading-relaxed">
                       La sesión se encuentra pausada temporalmente. Los bodegueros no podrán ingresar conteos hasta que la reanudes.
                     </p>
                   </div>
                 </div>
               ) : (
                 <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                   <Smartphone className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                   <div className="space-y-1">
                     <p className="text-white text-sm font-semibold">Modo Conteo Móvil Activo</p>
                     <p className="text-gray-400 text-xs leading-relaxed">
                       Comparte el enlace de abajo con los bodegueros. Pueden ingresar desde sus celulares al mismo tiempo sin necesidad de iniciar sesión.
                     </p>
                   </div>
                 </div>
               )}

              {/* URL Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Enlace Público de Conteo</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-mono select-all focus:border-blue-500 outline-none"
                    value={mobileUrl}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(mobileUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`px-4 rounded-xl text-xs font-bold transition-all border shrink-0 ${copied ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'}`}
                  >
                    {copied ? 'Copiado ✓' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => {
                      const text = encodeURIComponent(`¡Hola! Por favor ingresa a este enlace para realizar el conteo de bodega en vivo: ${mobileUrl}`);
                      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartir
                  </button>
                </div>
              </div>

              {/* Progreso */}
              <div className="space-y-3 bg-white/5 border border-white/5 rounded-xl p-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-medium">Progreso de Captura</span>
                  <span className="text-blue-400 font-bold font-mono">
                    {mobileProgress.counted} de {mobileProgress.total} productos ({mobileProgress.total > 0 ? Math.round((mobileProgress.counted / mobileProgress.total) * 100) : 0}%)
                  </span>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${mobileProgress.total > 0 ? (mobileProgress.counted / mobileProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Registro de Actividad Realtime */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Actividad en Vivo (Realtime)</h3>
                <div className="bg-black/20 border border-white/5 rounded-xl p-4 min-h-[120px] max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar">
                  {recentCounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Loader2 className="w-5 h-5 text-gray-600 animate-spin mb-2" />
                      <p className="text-gray-500 text-xs font-medium">Esperando primer conteo...</p>
                    </div>
                  ) : (
                    recentCounts.map((rc) => (
                      <div key={rc.id} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                        <div className="min-w-0 pr-2">
                          <p className="text-white font-medium truncate">{rc.description}</p>
                          <p className="text-[10px] text-gray-500">Por: <span className="text-gray-300 font-semibold">{rc.counter_name}</span> · {rc.time}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded font-mono">
                            {rc.quantity}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                {sessionPaused ? (
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      const res = await resumeMobileCountSession(mobileSessionId);
                      if ('error' in res && res.error) {
                        alert('Error al reanudar la sesión: ' + res.error);
                      } else {
                        setSessionPaused(false);
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs md:text-sm"
                  >
                    Reanudar Conteo
                  </button>
                ) : (
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      const res = await pauseMobileCountSession(mobileSessionId);
                      if ('error' in res && res.error) {
                        alert('Error al pausar la sesión: ' + res.error);
                      } else {
                        setSessionPaused(true);
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs md:text-sm"
                  >
                    Pausar Conteo
                  </button>
                )}
                <button 
                  onClick={async () => {
                    setLoading(true);
                    const res = await closeMobileCountSession(mobileSessionId);
                    if ('error' in res && res.error) {
                      alert('Error al cerrar la sesión: ' + res.error);
                    } else {
                      setStep(3);
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs md:text-sm"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {loading ? 'Cerrando...' : 'Finalizar y Cerrar Conteo'}
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
