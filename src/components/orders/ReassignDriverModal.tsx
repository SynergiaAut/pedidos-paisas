"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { Order, DeliveryDriver } from "@/types/order";
import { Truck, X, Loader2, CheckCircle2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ReassignDriverModalProps {
    order: Order;
    drivers: DeliveryDriver[];
    onSuccess: () => void;
    onClose: () => void;
}

export function ReassignDriverModal({ order, drivers, onSuccess, onClose }: ReassignDriverModalProps) {
    const [selectedDriverId, setSelectedDriverId] = React.useState<string | null>(order.driver_id ?? null);
    const [saving, setSaving] = React.useState(false);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("orders")
            .update({ driver_id: selectedDriverId ?? null })
            .eq("id", order.id);

        if (error) {
            toast.error("Error al reasignar: " + error.message);
        } else {
            const driverName = drivers.find(d => d.id === selectedDriverId)?.full_name ?? "Sin asignar";
            toast.success(`Pedido ${order.public_id} reasignado a ${driverName}`);
            onSuccess();
        }
        setSaving(false);
    };

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Panel */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className="pointer-events-auto w-full max-w-sm rounded-2xl border bg-card shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
                        <div>
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <Truck className="h-4 w-4 text-brand" />
                                Reasignar Domiciliario
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Pedido <span className="font-mono font-bold">{order.public_id}</span> · {order.client_name}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Cerrar modal"
                            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Driver List */}
                    <div className="p-4 space-y-1.5 max-h-72 overflow-y-auto">
                        {/* "Sin asignar" option */}
                        <button
                            onClick={() => setSelectedDriverId(null)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border transition-all",
                                selectedDriverId === null
                                    ? "border-brand bg-brand/10 text-brand font-semibold"
                                    : "border-transparent hover:bg-muted/50 text-muted-foreground"
                            )}
                        >
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="h-4 w-4" />
                            </div>
                            <span>Sin asignar</span>
                            {selectedDriverId === null && <CheckCircle2 className="h-4 w-4 ml-auto text-brand" />}
                        </button>

                        {drivers.map((driver) => (
                            <button
                                key={driver.id}
                                onClick={() => setSelectedDriverId(driver.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border transition-all",
                                    selectedDriverId === driver.id
                                        ? "border-brand bg-brand/10 font-semibold"
                                        : "border-transparent hover:bg-muted/50"
                                )}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                                    selectedDriverId === driver.id ? "bg-brand/20 text-brand" : "bg-muted"
                                )}>
                                    {driver.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium leading-tight">{driver.full_name}</p>
                                    {driver.vehicle_plate && (
                                        <p className="text-[11px] text-muted-foreground">🏍️ {driver.vehicle_plate}</p>
                                    )}
                                </div>
                                {selectedDriverId === driver.id && (
                                    <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 px-4 pb-4 pt-2 border-t">
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 rounded-lg bg-brand text-black font-bold px-4 py-2 text-sm hover:bg-brand/90 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirmar
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
