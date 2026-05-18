"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Pause } from "lucide-react";

export type PasteStep = "INV1_CODE" | "INV1_VALUE" | "INV2_CODE" | "INV2_VALUE" | "CLIENT" | "DONE";

interface SequentialPasteProps {
    currentStep: PasteStep;
    onStepComplete: (step: PasteStep, value: string) => void;
    onReset: () => void;
    autoStart?: boolean;
    className?: string;
}

export function SequentialPaste({ currentStep, onStepComplete, onReset, autoStart = false, className }: SequentialPasteProps) {
    const [isListening, setIsListening] = React.useState(autoStart);
    const [lastPastedText, setLastPastedText] = React.useState("");

    // Auto-stop logic
    React.useEffect(() => {
        if (currentStep === "DONE") {
            setIsListening(false);
        } else if (autoStart) {
            setIsListening(true);
        }
    }, [currentStep, autoStart]);

    React.useEffect(() => {
        const handleFocus = async () => {
            if (!isListening || currentStep === "DONE") return;

            try {
                const text = await navigator.clipboard.readText();
                if (text === lastPastedText) return;

                // Visual feedback could go here
                setLastPastedText(text);
                onStepComplete(currentStep, text.trim());

            } catch (err) {
                // Silently fail if permissions denied or focus issue
            }
        };

        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [isListening, currentStep, lastPastedText, onStepComplete]);

    const stepLabels: Record<PasteStep, string> = {
        INV1_CODE: "Copia Código Factura 1",
        INV1_VALUE: "Copia Valor Factura 1",
        INV2_CODE: "Copia Código Factura 2",
        INV2_VALUE: "Copia Valor Factura 2",
        CLIENT: "Copia Cliente (Opcional)",
        DONE: "Proceso Completado",
    };

    if (currentStep === 'DONE') return null; // Hide completely when done

    return (
        <div className={cn("flex items-center gap-3 py-2 px-1 transition-all duration-300", className)}>
            {/* Status LED */}
            <div className="relative flex items-center justify-center">
                <div className={cn("h-3 w-3 rounded-full transition-colors duration-500", isListening ? "bg-green-500" : "bg-slate-300")} />
                {isListening && (
                    <div className="absolute h-3 w-3 rounded-full bg-green-500 animate-ping opacity-75" />
                )}
            </div>

            <div className="flex flex-col">
                <span className={cn("text-sm font-medium transition-colors", isListening ? "text-foreground" : "text-muted-foreground")}>
                    {stepLabels[currentStep]}
                </span>
                {isListening ? (
                    <span className="text-[10px] text-brand font-medium tracking-wide uppercase animate-pulse">Escuchando portapapeles...</span>
                ) : (
                    <span className="text-[10px] text-muted-foreground">Pausado</span>
                )}
            </div>

            {/* Optional Manual Override (Only if stuck) - Hidden by default unless hover or interaction needed, keeping it minimalist */}
            {/* User asked to remove buttons, so we rely 100% on state logic. */}
        </div>
    );
}
