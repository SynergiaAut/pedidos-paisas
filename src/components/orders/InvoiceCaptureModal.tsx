'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, X, Check, ShoppingBag, Printer, AlertCircle, Clock, Plus, Loader2 } from 'lucide-react';

export interface InvoiceProduct {
    name: string;
    qty: number;
    price: number;
    type?: string;
}

export interface InvoiceEvent {
    id: string;
    invoice_number_1: string;
    invoice_value_1: number;
    invoice_number_2?: string | null;
    invoice_value_2?: number | null;
    products?: InvoiceProduct[];
    created_at: string;
    status: 'PENDING' | 'PROCESSED' | 'IGNORED';
}

interface InvoiceCaptureModalProps {
    isOpen: boolean;
    /** First invoice event captured */
    data: InvoiceEvent | null;
    /** Second invoice event, if detected within the patience window */
    secondData?: InvoiceEvent | null;
    /** Whether the system is still in the 2-second wait window */
    isWaitingForSecond: boolean;
    /** Remaining wait time in milliseconds */
    waitRemaining: number;
    onClose: () => void;
    onAccept: (primaryEvent: InvoiceEvent, secondEvent?: InvoiceEvent | null) => void;
    onIgnore: (id: string) => void;
    /**
     * Called when the user manually triggers "hay otra factura" 
     * to extend the wait window or flag that a second invoice is expected.
     */
    onRequestSecond?: () => void;
    /** TEST ONLY: callback to simulate a second print event from inside the modal */
    onSimulateSecond?: () => void;
}

const WAIT_DURATION_MS = 2500; // matches the pedidos page timeout

export function InvoiceCaptureModal({
    isOpen,
    data,
    secondData,
    isWaitingForSecond,
    waitRemaining,
    onClose,
    onAccept,
    onIgnore,
    onRequestSecond,
    onSimulateSecond,
}: InvoiceCaptureModalProps) {
    if (!data || !isOpen) return null;

    const hasSecondInvoice = !!secondData;
    const totalValue =
        (data.invoice_value_1 || 0) +
        (secondData?.invoice_value_1 || 0);

    // Products come from first event (or merged if needed)
    const allProducts = data.products || [];
    const waitProgress = isWaitingForSecond
        ? ((WAIT_DURATION_MS - waitRemaining) / WAIT_DURATION_MS) * 100
        : 100;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                    >
                        {/* Progress bar (patience window) */}
                        {isWaitingForSecond && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted overflow-hidden z-10">
                                <motion.div
                                    className="h-full bg-amber-400"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${waitProgress}%` }}
                                    transition={{ duration: 0.1 }}
                                />
                            </div>
                        )}

                        {/* Header */}
                        <div className="bg-brand/10 p-4 border-b border-brand/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center w-10 h-10 bg-brand text-black rounded-full shrink-0">
                                    <div className="absolute inset-0 bg-brand rounded-full animate-ping opacity-20" />
                                    <Printer className="w-5 h-5 relative z-10" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-foreground leading-none">
                                        Factura Detectada
                                    </h3>
                                    {isWaitingForSecond ? (
                                        <p className="text-xs text-amber-400 flex items-center gap-1.5 mt-0.5">
                                            <Clock className="w-3 h-3 animate-pulse" />
                                            Esperando 2ª factura... ({Math.ceil(waitRemaining / 1000)}s)
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            Captura en tiempo real
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Cerrar"
                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Invoice Grid */}
                            <div className={`grid ${hasSecondInvoice ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                {/* Invoice 1 */}
                                <div className="p-4 rounded-lg bg-background border border-border hover:border-brand/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <Receipt className="w-4 h-4" />
                                        <span className="text-xs font-medium uppercase tracking-wide">Factura #1</span>
                                    </div>
                                    <p className="text-xl font-bold text-foreground font-mono">{data.invoice_number_1}</p>
                                    <p className="text-lg font-bold text-green-500 font-mono">
                                        ${data.invoice_value_1?.toLocaleString()}
                                    </p>
                                </div>

                                {/* Invoice 2: detected, waiting, or add button */}
                                {hasSecondInvoice ? (
                                    <div className="p-4 rounded-lg bg-background border border-green-500/40 hover:border-green-500/70 transition-colors relative">
                                        <div className="absolute top-2 right-2">
                                            <span className="text-[10px] font-bold bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full uppercase border border-green-500/20">
                                                detectada
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Receipt className="w-4 h-4" />
                                            <span className="text-xs font-medium uppercase tracking-wide">Factura #2</span>
                                        </div>
                                        <p className="text-xl font-bold text-foreground font-mono">{secondData?.invoice_number_1}</p>
                                        <p className="text-lg font-bold text-green-500 font-mono">
                                            ${secondData?.invoice_value_1?.toLocaleString()}
                                        </p>
                                    </div>
                                ) : isWaitingForSecond ? (
                                    <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-500/30 flex flex-col items-center justify-center gap-2 text-amber-400">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="text-xs font-medium">Esperando 2ª factura...</span>
                                        <span className="text-[10px] text-amber-400/60">
                                            {Math.ceil(waitRemaining / 1000)}s restantes
                                        </span>
                                        {/* TEST ONLY button — visible while waiting */}
                                        {onSimulateSecond && (
                                            <button
                                                onClick={onSimulateSecond}
                                                className="mt-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/40 text-orange-400 rounded-full transition-colors"
                                            >
                                                TEST: Simular 2ª
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    /* Manual "there IS another invoice" button */
                                    onRequestSecond && (
                                        <button
                                            onClick={onRequestSecond}
                                            className="p-4 rounded-lg bg-background border border-dashed border-border hover:border-brand/50 hover:bg-brand/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-brand group"
                                        >
                                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-medium text-center">¿Hay otra<br />factura?</span>
                                        </button>
                                    )
                                )}
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-accent">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider">
                                        Valor Total {hasSecondInvoice ? '(Ambas Facturas)' : 'Detectado'}
                                    </span>
                                    <span className="text-2xl font-bold text-brand font-mono tracking-tight">
                                        ${totalValue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="bg-brand/10 p-2 rounded-full">
                                    <Check className="w-6 h-6 text-brand" />
                                </div>
                            </div>

                            {/* Products Preview */}
                            {allProducts.length > 0 ? (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2 tracking-wider">
                                        <ShoppingBag className="w-3 h-3" />
                                        Productos ({allProducts.length})
                                    </h4>
                                    <div className="bg-muted/30 rounded-lg border border-border max-h-[140px] overflow-y-auto">
                                        {allProducts.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between items-center p-3 text-sm border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-background border border-border rounded-full text-[10px] font-bold">
                                                        {item.qty}
                                                    </span>
                                                    <span className="font-medium text-foreground">{item.name}</span>
                                                </div>
                                                <span className="font-medium font-mono bg-background px-2 py-0.5 rounded border border-border">
                                                    ${(item.price * item.qty).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 rounded-lg border border-dashed border-border bg-muted/10 flex items-center justify-center text-sm text-muted-foreground gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>No se detectaron productos detallados</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 bg-muted/30 border-t border-border flex gap-3 justify-end items-center">
                            <button
                                onClick={() => onIgnore(data.id)}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:bg-muted rounded-md"
                            >
                                Ignorar
                            </button>
                            <button
                                onClick={() => onAccept(data, secondData)}
                                disabled={isWaitingForSecond}
                                className="flex items-center gap-2 px-6 py-2 bg-brand hover:bg-brand/90 text-black font-bold rounded-md shadow-lg shadow-brand/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                {isWaitingForSecond ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Esperando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Crear Pedido
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
