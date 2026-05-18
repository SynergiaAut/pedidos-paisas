"use client";

import * as React from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DeliveryDriver } from "@/types/order";

interface DriverSelectorProps {
    drivers: DeliveryDriver[];
    selectedDriverId?: string;
    onSelect: (driverId: string) => void;
    isLoading?: boolean;
}

export function DriverSelector({ drivers, selectedDriverId, onSelect, isLoading }: DriverSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Close when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

    return (
        <div className="relative w-full" ref={containerRef}>
            <motion.button
                onClick={() => setOpen(!open)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                    "w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    open ? "border-primary ring-1 ring-primary" : "border-input"
                )}
            >
                <span className="flex items-center gap-2 truncate">
                    {selectedDriver ? (
                        <>
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {selectedDriver.full_name.charAt(0)}
                            </div>
                            <span className="truncate text-foreground font-medium">{selectedDriver.full_name}</span>
                        </>
                    ) : (
                        <span className="text-muted-foreground">Asignar Domiciliario...</span>
                    )}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md p-1"
                    >
                        <div className="space-y-0.5">
                            <div
                                onClick={() => { onSelect("unassigned"); setOpen(false); }}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                    !selectedDriverId && "bg-accent"
                                )}
                            >
                                <span className="text-muted-foreground italic">Sin asignar</span>
                                {!selectedDriverId && <Check className="ml-auto h-3 w-3 opacity-50" />}
                            </div>

                            {drivers.map((driver) => (
                                <div
                                    key={driver.id}
                                    onClick={() => { onSelect(driver.id); setOpen(false); }}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                        selectedDriverId === driver.id && "bg-accent font-medium"
                                    )}
                                >
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mr-2">
                                        {driver.full_name.charAt(0)}
                                    </div>
                                    <span className="truncate">{driver.full_name}</span>
                                    {selectedDriverId === driver.id && (
                                        <Check className="ml-auto h-3 w-3 opacity-100 text-primary" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
