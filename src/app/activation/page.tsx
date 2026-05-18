'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Key, ShieldCheck, Server, Lock } from 'lucide-react';
import { activateLicense } from '@/app/actions/security';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function ActivationPage() {
    const [hardwareId, setHardwareId] = useState<string>('');
    const [licenseKey, setLicenseKey] = useState('');
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // Simulate Hardware ID generation (In a real app, this might come from a server component or system info)
    useEffect(() => {
        // PoC: Generate a semi-persistent ID based on browser for demo purposes
        let hid = localStorage.getItem('poc_hardware_id');
        if (!hid) {
            hid = 'HW-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
            localStorage.setItem('poc_hardware_id', hid);
        }
        setHardwareId(hid);
    }, []);

    const handleActivate = () => {
        if (!licenseKey.trim()) {
            toast.error("Por favor ingresa una licencia válida");
            return;
        }

        startTransition(async () => {
            const result = await activateLicense(licenseKey, hardwareId);
            if (result.success) {
                toast.success("¡Producto activado correctamente!");
                // Force hard reload to bypass any middleware cache
                window.location.href = '/crm';
            } else {
                toast.error(result.message || "Error al activar la licencia");
            }
        });
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-black">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="animated-gradient-bg" />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

            <div className="relative z-10 w-full max-w-md p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-blue-900/20"
                >
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 ring-1 ring-blue-500/30">
                            <Lock className="h-8 w-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Activación de Producto</h1>
                        <p className="text-zinc-400 text-sm mt-2">
                            Este servidor no cuenta con una licencia activa para <span className="text-blue-400 font-semibold">Pedidos Paisas v2.0</span>
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <Server className="h-3 w-3" /> Hardware ID Detectado
                            </label>
                            <div className="font-mono text-sm bg-black/50 border border-zinc-800 rounded-md py-2 px-3 text-zinc-300 flex justify-between items-center">
                                {hardwareId || <span className="animate-pulse">Calculando...</span>}
                                {hardwareId && <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <Key className="h-3 w-3" /> Clave de Licencia
                            </label>
                            <input
                                type="text"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                className="w-full bg-zinc-950/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono text-center tracking-widest text-lg"
                            />
                        </div>

                        <button
                            onClick={handleActivate}
                            disabled={isPending || !hardwareId}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            {isPending ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" /> Verificando...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-5 w-5" /> Activar Licencia
                                </>
                            )}
                        </button>

                        <div className="text-center">
                            <p className="text-[10px] text-zinc-600">
                                Protected by AntiGravity Security Layer™<br />
                                ID de Sesión: {new Date().getTime().toString(36).toUpperCase()}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
