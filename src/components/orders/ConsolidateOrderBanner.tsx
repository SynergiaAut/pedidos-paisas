"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Merge, FilePlus, ChevronRight, Receipt, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvoiceEntry {
    code: string;
    value: string;
}

interface ExistingOrder {
    id: string;
    public_id: string;
    status: string;
    invoices_data: InvoiceEntry[];
    client_name: string;
}

interface ConsolidateOrderBannerProps {
    existingOrder: ExistingOrder;
    newInvoices: InvoiceEntry[];  // The invoices about to be added
    onConsolidate: () => void;    // User chose to merge
    onCreateNew: () => void;      // User chose a fresh order
    isLoading?: boolean;
}

const MAX_INVOICES = 4;

const STATUS_LABELS: Record<string, string> = {
    TOMADO: "En preparación",
    EN_CAMINO: "En camino",
    PENDIENTE: "Pendiente",
};

export function ConsolidateOrderBanner({
    existingOrder,
    newInvoices,
    onConsolidate,
    onCreateNew,
    isLoading = false,
}: ConsolidateOrderBannerProps) {
    const currentCount = existingOrder.invoices_data?.length ?? 0;
    const newCount = newInvoices.filter(inv => inv.code || inv.value).length;
    const totalAfterMerge = Math.min(currentCount + newCount, MAX_INVOICES);
    const wouldBeCapped = currentCount + newCount > MAX_INVOICES;
    const canConsolidate = currentCount < MAX_INVOICES;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="rounded-lg border-2 border-amber-500/40 bg-amber-950/20 overflow-hidden shadow-lg"
            >
                {/* Header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-300">
                            Pedido activo detectado
                        </p>
                        <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
                            <span className="font-mono font-bold">{existingOrder.public_id}</span>
                            {" · "}{STATUS_LABELS[existingOrder.status] ?? existingOrder.status}
                        </p>
                    </div>
                </div>

                {/* Invoice slots visual */}
                <div className="px-4 pb-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2 tracking-wider">
                        Facturas del pedido
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: MAX_INVOICES }).map((_, i) => {
                            const isExisting = i < currentCount;
                            const isNew = i >= currentCount && i < currentCount + newCount && i < MAX_INVOICES;
                            const isEmpty = !isExisting && !isNew;

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "rounded border px-2 py-1.5 text-center text-[10px] font-mono transition-all",
                                        isExisting && "border-slate-500/50 bg-slate-800/50 text-slate-400",
                                        isNew && "border-green-500/50 bg-green-950/40 text-green-400 font-bold",
                                        isEmpty && "border-dashed border-slate-700/50 bg-transparent text-slate-600"
                                    )}
                                >
                                    {isExisting && (
                                        <span title={existingOrder.invoices_data[i]?.code}>
                                            <Receipt className="h-3 w-3 mx-auto mb-0.5 opacity-70" />
                                            Existente
                                        </span>
                                    )}
                                    {isNew && (
                                        <span>
                                            <FilePlus className="h-3 w-3 mx-auto mb-0.5" />
                                            Nueva
                                        </span>
                                    )}
                                    {isEmpty && (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {wouldBeCapped && (
                        <p className="text-[10px] text-amber-400/70 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Solo se agregarán {MAX_INVOICES - currentCount} de {newCount} facturas (límite de 4 alcanzado)
                        </p>
                    )}
                    {!canConsolidate && (
                        <p className="text-[10px] text-red-400/80 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            El pedido existente ya tiene 4 facturas. Debes crear uno nuevo.
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="border-t border-amber-500/20 grid grid-cols-2 divide-x divide-amber-500/20">
                    <button
                        type="button"
                        disabled={isLoading || !canConsolidate}
                        onClick={onConsolidate}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition-colors",
                            canConsolidate
                                ? "text-green-400 hover:bg-green-950/30 hover:text-green-300"
                                : "text-slate-600 cursor-not-allowed"
                        )}
                    >
                        <Merge className="h-4 w-4" />
                        <span>Agregar al pedido</span>
                        {canConsolidate && (
                            <span className="text-[9px] font-mono text-green-600">
                                {currentCount} → {totalAfterMerge} facturas
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={onCreateNew}
                        className="flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold text-slate-400 hover:bg-slate-800/40 hover:text-slate-300 transition-colors"
                    >
                        <FilePlus className="h-4 w-4" />
                        <span>Crear nuevo pedido</span>
                        <ChevronRight className="h-3 w-3 opacity-50" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
