'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  getSessionInfo, 
  getSessionItems, 
  submitCount, 
  finishSessionIfComplete,
  MobileSessionItem 
} from './actions';
import { 
  Search, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ChevronRight, 
  Save, 
  Package, 
  Tag 
} from 'lucide-react';

interface PageProps {
    params: Promise<{ token: string }>;
}

export default function MobileCountPage({ params }: PageProps) {
    const { token } = use(params);

    // Estados de inicialización y verificación
    const [verifying, setVerifying] = useState(true);
    const [sessionName, setSessionName] = useState('');
    const [errorReason, setErrorReason] = useState<'not_found' | 'closed' | 'expired' | 'paused' | null>(null);

    // Estado de auto-cierre exitoso
    const [completedSummary, setCompletedSummary] = useState<{ items_counted: number; total_items: number; discrepancies: number; duration_minutes: number } | null>(null);

    // Estados de la app de conteo
    const [counterName, setCounterName] = useState('');
    const [tempName, setTempName] = useState('');
    const [hasName, setHasName] = useState(false);

    // Catálogo y búsqueda
    const [items, setItems] = useState<MobileSessionItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingItems, setLoadingItems] = useState(false);

    // Estados de envío y guardado local
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [countedValues, setCountedValues] = useState<Record<string, string>>({});
    const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // 1. Validar la sesión al montar el componente
    useEffect(() => {
        async function verify() {
            setVerifying(true);
            const info = await getSessionInfo(token);
            if (!info.valid) {
                setErrorReason(info.reason || 'not_found');
                if (info.name) setSessionName(info.name);
            } else {
                setSessionName(info.name || 'Conteo Móvil');
                
                // Cargar nombre del bodeguero si ya existe
                const storedName = localStorage.getItem(`conteo_nombre_${token}`);
                if (storedName) {
                    setCounterName(storedName);
                    setHasName(true);
                }

                // Cargar ítems
                await loadSessionItems();
            }
            setVerifying(false);
        }
        verify();
    }, [token]);

    // Cargar ítems de la sesión
    const loadSessionItems = async () => {
        setLoadingItems(true);
        const data = await getSessionItems(token);
        setItems(data);

        // Cargar los conteos que ya guardó en esta sesión en este dispositivo (opcional, para persistencia local)
        const storedCounts = localStorage.getItem(`conteo_guardados_${token}`);
        if (storedCounts) {
            try {
                const parsed = JSON.parse(storedCounts);
                setSavedItems(parsed.saved || {});
                setCountedValues(parsed.values || {});
            } catch (e) {
                console.error('Error cargando conteos locales:', e);
            }
        }
        setLoadingItems(false);
    };

    // 2. Manejo de nombre del bodeguero
    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = tempName.trim();
        if (!trimmed) return;

        setCounterName(trimmed);
        localStorage.setItem(`conteo_nombre_${token}`, trimmed);
        setHasName(true);
    };

    // Cambiar de bodeguero
    const handleResetName = () => {
        if (window.confirm('¿Deseas cambiar el nombre del bodeguero?')) {
            localStorage.removeItem(`conteo_nombre_${token}`);
            setCounterName('');
            setHasName(false);
            setTempName('');
        }
    };

    // 3. Guardado físico de un ítem
    const handleSaveCount = async (itemId: string) => {
        const valStr = countedValues[itemId];
        if (valStr === undefined || valStr === '') {
            alert('Por favor ingresa una cantidad.');
            return;
        }

        const value = parseFloat(valStr);
        if (isNaN(value) || value < 0) {
            alert('Por favor ingresa una cantidad válida (mayor o igual a 0).');
            return;
        }

        setSubmittingId(itemId);
        setErrorMessage(null);

        const res = await submitCount(token, itemId, value, counterName);

        if (res.success) {
            // Actualizar estado de guardado
            const newSaved = { ...savedItems, [itemId]: true };
            const newValues = { ...countedValues, [itemId]: valStr };
            setSavedItems(newSaved);
            
            // Guardar progreso en localStorage
            localStorage.setItem(
                `conteo_guardados_${token}`,
                JSON.stringify({ saved: newSaved, values: newValues })
            );

            // Verificar si contamos todos los productos y autocerrar (TASK-M28)
            if (res.counted_items !== undefined && res.total_items !== undefined && res.counted_items >= res.total_items) {
                const finishRes = await finishSessionIfComplete(token);
                if (finishRes.success) {
                    setCompletedSummary({
                        items_counted: finishRes.items_counted || res.counted_items,
                        total_items: finishRes.total_items || res.total_items,
                        discrepancies: finishRes.discrepancies || 0,
                        duration_minutes: finishRes.duration_minutes || 0
                    });
                }
            }
        } else {
            setErrorMessage(res.message || 'Error al guardar. Revisa tu conexión.');
            alert(res.message || 'No se pudo guardar el conteo. Inténtalo de nuevo.');
        }
        setSubmittingId(null);
    };

    const handleInputChange = (itemId: string, value: string) => {
        setCountedValues(prev => ({ ...prev, [itemId]: value }));
        // Si el valor cambia, quitamos el check de guardado temporalmente hasta que vuelva a guardar
        if (savedItems[itemId]) {
            setSavedItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    // Filtrar ítems en base a la búsqueda
    const filteredItems = items.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            item.description.toLowerCase().includes(query) ||
            item.sku.toLowerCase().includes(query)
        );
    });

    // --- RENDER ESTADO CARGANDO / VERIFICANDO ---
    if (verifying) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-slate-500 font-medium text-sm">Verificando enlace de conteo...</p>
            </div>
        );
    }

    // --- RENDER ESTADO ENLACE INVÁLIDO/EXPIRADO/CERRADO/PAUSADO ---
    if (errorReason) {
        const isPaused = errorReason === 'paused';
        return (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 text-center space-y-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isPaused ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-800">
                        {errorReason === 'not_found' && 'Enlace Inválido'}
                        {errorReason === 'closed' && 'Conteo Finalizado'}
                        {errorReason === 'expired' && 'Enlace Expirado'}
                        {errorReason === 'paused' && 'Conteo Pausado'}
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        {errorReason === 'not_found' && 'El enlace que intentas abrir no existe o es incorrecto.'}
                        {errorReason === 'closed' && `La sesión de conteo "${sessionName || 'Inventario'}" ya ha sido cerrada y no acepta más respuestas.`}
                        {errorReason === 'expired' && `El enlace de la sesión "${sessionName || 'Inventario'}" expiró.`}
                        {errorReason === 'paused' && `La sesión de conteo "${sessionName || 'Inventario'}" se encuentra en pausa temporal. Por favor, vuelve más tarde.`}
                    </p>
                </div>
                <div className="text-xs text-slate-400 border-t pt-4">
                    Código de error: {errorReason.toUpperCase()}
                </div>
            </div>
        );
    }

    // --- RENDER AUTO-COMPLETADO (TASK-M28) ---
    if (completedSummary) {
        return (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-800">¡Conteo Completado!</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Has registrado exitosamente todos los productos asignados a la sesión de conteo <strong>{sessionName}</strong>.
                    </p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-700">
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Contados</p>
                        <p className="text-base font-extrabold">{completedSummary.items_counted} / {completedSummary.total_items}</p>
                    </div>
                    <div className="text-center border-x border-slate-200 px-1">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Diferentes</p>
                        <p className="text-base font-extrabold text-amber-600">{completedSummary.discrepancies}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Duración</p>
                        <p className="text-base font-extrabold">{completedSummary.duration_minutes} min</p>
                    </div>
                </div>

                <div className="text-xs text-slate-400 leading-relaxed border-t pt-4">
                    La sesión ha sido cerrada en el sistema y guardada de forma segura. ¡Gracias por tu trabajo!
                </div>
            </div>
        );
    }

    // --- RENDER CAPTURA NOMBRE BODEGUERO ---
    if (!hasName) {
        return (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 space-y-6">
                <div className="text-center space-y-2">
                    <h2 className="text-lg font-bold text-slate-800">Bienvenido al Conteo</h2>
                    <p className="text-slate-500 text-xs">
                        Ingresa tu nombre para saber quién contó cada producto.
                    </p>
                </div>
                <form onSubmit={handleSaveName} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                            Nombre del Bodeguero
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                required
                                placeholder="Ej. Carlos Mendoza"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!tempName.trim()}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-55"
                    >
                        Comenzar
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </form>
            </div>
        );
    }

    // --- RENDER CAPTURA DE INVENTARIO ---
    return (
        <div className="space-y-4 flex-1 flex flex-col">
            {/* Cabecera Info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{sessionName}</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Contando como: <span className="text-slate-700 font-semibold">{counterName}</span></p>
                </div>
                <button 
                    onClick={handleResetName}
                    className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider"
                >
                    Cambiar
                </button>
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por descripción o SKU..."
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-slate-800 placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Catálogo de Ítems */}
            <div className="flex-1 space-y-3">
                {loadingItems ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-slate-400 text-xs font-medium">Cargando catálogo...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="bg-slate-100/50 rounded-2xl p-8 text-center border border-slate-200/55">
                        <p className="text-slate-500 text-sm font-medium">No se encontraron productos.</p>
                        <p className="text-slate-400 text-xs mt-1">Verifica los filtros o el buscador.</p>
                    </div>
                ) : (
                    filteredItems.map((item) => {
                        const isSaved = savedItems[item.id];
                        const isSubmitting = submittingId === item.id;
                        const value = countedValues[item.id] || '';

                        return (
                            <div 
                                key={item.id} 
                                className={`bg-white border rounded-2xl p-4 shadow-sm transition-all duration-200 ${isSaved ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200'}`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                                            {item.description}
                                        </h3>
                                        {isSaved && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-full shrink-0">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Guardado
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-medium text-slate-400">
                                        <span className="flex items-center gap-0.5"><Package className="w-3 h-3" /> SKU: {item.sku}</span>
                                        {item.classification && (
                                            <span className="flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                                <Tag className="w-3 h-3" /> {item.classification}
                                            </span>
                                        )}
                                        {item.unit && (
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                                                {item.unit}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                    {/* Stock teórico del sistema como guía rápida */}
                                    <div className="text-left shrink-0">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sistema</p>
                                        <p className="text-sm font-mono font-bold text-slate-600">
                                            {item.system_stock} <span className="text-[10px] text-slate-400 font-sans font-semibold">{item.unit || ''}</span>
                                        </p>
                                    </div>

                                    {/* Campo de conteo y botón guardar */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="Físico"
                                            className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 text-center font-bold text-sm focus:bg-white focus:border-primary outline-none"
                                            value={value}
                                            onChange={(e) => handleInputChange(item.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSaveCount(item.id);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => handleSaveCount(item.id)}
                                            disabled={isSubmitting || value === ''}
                                            className={`p-2.5 rounded-xl text-white font-bold transition-all active:scale-95 disabled:opacity-40 shrink-0 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'}`}
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
