"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DateFilterProps {
    date: string;
    onDateChange: (date: string) => void;
    className?: string;
}

export function DateFilter({ date, onDateChange, className }: DateFilterProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDivClick = () => {
        inputRef.current?.showPicker();
    };

    const formattedDate = date
        ? format(new Date(date + 'T00:00:00'), "EEE, d 'de' MMM", { locale: es })
        : "Seleccionar fecha";

    return (
        <div className={cn("relative inline-block", className)}>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDivClick}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background hover:bg-muted/50 transition-colors shadow-sm",
                    "text-sm font-medium text-foreground cursor-pointer group"
                )}
            >
                <CalendarIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="capitalize">{formattedDate}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-50" />
            </motion.button>

            <input
                ref={inputRef}
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                style={{ visibility: "hidden", position: "absolute" }} // Hide but keep accessible to showPicker
            />
        </div>
    );
}
