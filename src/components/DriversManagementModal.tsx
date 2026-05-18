"use client";

import * as React from "react";
import { X, Save, Loader2, User, Phone, Car, Trash2, Check, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { DeliveryDriver } from "@/types/order";
import { cn } from "@/lib/utils";

interface DriversManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DriversManagementModal({ isOpen, onClose }: DriversManagementModalProps) {
    const [drivers, setDrivers] = React.useState<DeliveryDriver[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);

    // New Driver Form
    const [newName, setNewName] = React.useState("");
    const [newPhone, setNewPhone] = React.useState("");
    const [newPlate, setNewPlate] = React.useState("");

    React.useEffect(() => {
        if (isOpen) {
            fetchDrivers();
        }
    }, [isOpen]);

    const fetchDrivers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('delivery_drivers')
            .select('*')
            .order('is_active', { ascending: false }) // Active first
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        else setDrivers(data as DeliveryDriver[] || []);
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName) return;
        setCreating(true);

        const { data, error } = await supabase.from('delivery_drivers').insert({
            full_name: newName.toUpperCase(),
            phone: newPhone,
            vehicle_plate: newPlate.toUpperCase(),
            is_active: true
        }).select().single();

        setCreating(false);

        if (error) {
            alert("Error al crear domiciliario");
        } else if (data) {
            setDrivers(prev => [data, ...prev]);
            setNewName("");
            setNewPhone("");
            setNewPlate("");
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        // Optimistic update
        setDrivers(prev => prev.map(d => d.id === id ? { ...d, is_active: !currentStatus } : d));

        const { error } = await supabase
            .from('delivery_drivers')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (error) {
            alert("Error al actualizar estado");
            // Revert on error
            setDrivers(prev => prev.map(d => d.id === id ? { ...d, is_active: currentStatus } : d));
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-background border shadow-xl rounded-xl w-full max-w-lg pointer-events-auto flex flex-col max-h-[85vh] overflow-hidden"
                        >
                            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight">Gestionar Domiciliarios</h2>
                                    <p className="text-xs text-muted-foreground">Registra y administra tu flota de domiciliarios.</p>
                                </div>
                                <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Add Form */}
                            <div className="p-4 bg-accent/5 border-b">
                                <form onSubmit={handleCreate} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground ml-1">Nombre *</label>
                                            <div className="relative">
                                                <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                <input
                                                    required
                                                    value={newName}
                                                    onChange={e => setNewName(e.target.value.toUpperCase())}
                                                    placeholder="NOMBRE COMPLETO"
                                                    className="w-full pl-8 h-9 rounded-md border text-sm bg-background uppercase focus:ring-1 focus:ring-primary outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground ml-1">Teléfono</label>
                                            <div className="relative">
                                                <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                <input
                                                    value={newPhone}
                                                    onChange={e => setNewPhone(e.target.value)}
                                                    placeholder="300..."
                                                    className="w-full pl-8 h-9 rounded-md border text-sm bg-background focus:ring-1 focus:ring-primary outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="space-y-1 flex-1">
                                            <label className="text-xs font-medium text-muted-foreground ml-1">Placa (Opcional)</label>
                                            <div className="relative">
                                                <Car className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                <input
                                                    value={newPlate}
                                                    onChange={e => setNewPlate(e.target.value.toUpperCase())}
                                                    placeholder="ABC-123"
                                                    className="w-full pl-8 h-9 rounded-md border text-sm bg-background uppercase focus:ring-1 focus:ring-primary outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="submit"
                                                disabled={creating || !newName}
                                                className="h-9 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                Agregar
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/10">
                                {loading && drivers.length === 0 ? (
                                    <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                                ) : drivers.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-muted-foreground">No hay domiciliarios registrados.</div>
                                ) : (
                                    drivers.map(driver => (
                                        <div key={driver.id} className={cn("flex items-center justify-between p-3 rounded-lg border bg-card transition-all", !driver.is_active && "opacity-60 grayscale bg-muted")}>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {driver.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm flex items-center gap-2">
                                                        {driver.full_name}
                                                        {!driver.is_active && <span className="text-[10px] bg-muted-foreground text-white px-1.5 rounded">INACTIVO</span>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex gap-3">
                                                        {driver.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {driver.phone}</span>}
                                                        {driver.vehicle_plate && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {driver.vehicle_plate}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleStatus(driver.id, driver.is_active)}
                                                className={cn("text-xs font-medium px-2 py-1 rounded border hover:bg-muted transition-colors", driver.is_active ? "text-red-600 border-red-200 bg-red-50" : "text-green-600 border-green-200 bg-green-50")}
                                            >
                                                {driver.is_active ? "Desactivar" : "Activar"}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
