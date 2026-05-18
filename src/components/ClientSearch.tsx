"use client";

import * as React from "react";
import { Search, Phone, MapPin, Plus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Client } from "@/types/order";
import { CreateClientModal } from "./CreateClientModal";

interface ClientSearchProps {
    onSelect: (client: Client) => void;
    className?: string;
}

export function ClientSearch({ onSelect, className }: ClientSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<Client[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
    // Index of the currently highlighted item (-1 = none)
    const [activeIndex, setActiveIndex] = React.useState(-1);

    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    // Debounced search
    React.useEffect(() => {
        const searchClients = async () => {
            if (!query || query.length < 2) {
                setResults([]);
                setActiveIndex(-1);
                return;
            }

            setLoading(true);
            const { data, error } = await supabase
                .from('clients')
                .select('id, full_name, phone, address, document_id, email, total_orders')
                .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,document_id.ilike.%${query}%`)
                .limit(7);

            if (error) {
                console.error("Error searching clients:", error);
            } else {
                setResults(data || []);
                setActiveIndex(-1); // Reset highlight on new results
            }
            setLoading(false);
        };

        const timeoutId = setTimeout(searchClients, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    // Scroll highlighted item into view
    React.useEffect(() => {
        if (activeIndex >= 0 && listRef.current) {
            const item = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
            item?.scrollIntoView({ block: "nearest" });
        }
    }, [activeIndex]);

    const handleSelect = (client: Client) => {
        setSelectedClient(client);
        onSelect(client);
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
    };

    const handleClear = () => {
        setSelectedClient(null);
        setQuery("");
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const handleCreateNew = () => {
        setOpen(false);
        setIsModalOpen(true);
    };

    /**
     * Keyboard handler:
     *   ArrowDown  → move highlight down (wraps)
     *   ArrowUp    → move highlight up (wraps)
     *   Enter      → select highlighted item (or create new if none)
     *   Escape     → close dropdown and clear query
     *   Tab        → if dropdown open, select highlighted item and move to next field
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                setOpen(true);
                return;
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % results.length);
                break;

            case "ArrowUp":
                e.preventDefault();
                setActiveIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
                break;

            case "Enter":
                e.preventDefault();
                if (activeIndex >= 0 && results[activeIndex]) {
                    handleSelect(results[activeIndex]);
                } else if (results.length === 1) {
                    // If only one result, Enter auto-selects it
                    handleSelect(results[0]);
                } else if (results.length === 0 && query.length >= 2) {
                    handleCreateNew();
                }
                break;

            case "Escape":
                e.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
                setQuery("");
                inputRef.current?.blur();
                break;

            case "Tab":
                // Close dropdown; if something highlighted, select it first
                if (activeIndex >= 0 && results[activeIndex]) {
                    e.preventDefault(); // Prevent tab until we select
                    handleSelect(results[activeIndex]);
                    // Then let the form move to the next field
                    setTimeout(() => {
                        const nextInput = inputRef.current
                            ?.closest('form, [data-form]')
                            ?.querySelectorAll('input, select, textarea, button:not([tabindex="-1"])');
                        if (nextInput) {
                            const arr = Array.from(nextInput) as HTMLElement[];
                            const idx = arr.indexOf(inputRef.current!);
                            arr[idx + 1]?.focus();
                        }
                    }, 0);
                }
                // Otherwise let Tab flow naturally through the form
                break;
        }
    };

    const showDropdown = open && (query.length > 0 || results.length > 0);

    return (
        <div className={cn("relative", className)}>
            <CreateClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialName={query}
                onSuccess={(newClient) => {
                    handleSelect(newClient);
                }}
            />
            <div className="relative">
                <div className={cn(
                    "flex items-center border rounded-md px-3 py-2 bg-background transition-all shadow-sm",
                    open ? "ring-2 ring-ring border-transparent" : "hover:border-muted-foreground/50"
                )}>
                    <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                    <input
                        ref={inputRef}
                        role="combobox"
                        aria-expanded={open}
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        aria-controls="client-search-listbox"
                        aria-activedescendant={activeIndex >= 0 ? `client-option-${activeIndex}` : undefined}
                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground uppercase min-w-0"
                        placeholder="BUSCAR CLIENTE POR NOMBRE O TELÉFONO..."
                        value={selectedClient ? selectedClient.full_name : query}
                        onChange={(e) => {
                            setQuery(e.target.value.toUpperCase());
                            setSelectedClient(null);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => {
                            // Small delay so mouseDown on list item fires first
                            setTimeout(() => setOpen(false), 150);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1 shrink-0" />}
                </div>
                {/* Clear button lives outside the input wrapper to avoid ARIA nesting issues */}
                {selectedClient && !loading && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={handleClear}
                        aria-label="Limpiar selección"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}

                {showDropdown && (
                    <div
                        role="listbox"
                        id="client-search-listbox"
                        aria-label="Resultados de búsqueda de clientes"
                        className="absolute top-full left-0 right-0 mt-1.5 bg-popover text-popover-foreground border rounded-md shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-100"
                    >
                        {results.length > 0 ? (
                            <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1">
                                {results.map((client, idx) => (
                                    <div
                                        key={client.id}
                                        id={`client-option-${idx}`}
                                        role="option"
                                        aria-selected={idx === activeIndex}
                                        data-index={idx}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm cursor-pointer transition-colors select-none",
                                            idx === activeIndex
                                                ? "bg-brand/15 text-brand ring-1 ring-inset ring-brand/30"
                                                : "hover:bg-accent hover:text-accent-foreground"
                                        )}
                                        // Use onMouseDown instead of onClick — fires BEFORE onBlur
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent input losing focus before we handle
                                            handleSelect(client);
                                        }}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        onMouseLeave={() => setActiveIndex(-1)}
                                    >
                                        <div className={cn(
                                            "flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm shrink-0 transition-colors",
                                            idx === activeIndex ? "bg-brand text-black" : "bg-primary/10 text-primary"
                                        )}>
                                            {client.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold truncate">{client.full_name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                {client.phone && (
                                                    <span className="flex items-center gap-0.5">
                                                        <Phone className="h-3 w-3" /> {client.phone}
                                                    </span>
                                                )}
                                                {client.address && (
                                                    <span className="flex items-center gap-0.5 truncate">
                                                        <MapPin className="h-3 w-3 shrink-0" /> {client.address}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {(client.total_orders ?? 0) > 0 && (
                                            <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full font-mono shrink-0">
                                                ★ {client.total_orders}
                                            </span>
                                        )}
                                        {/* Keyboard shortcut hint */}
                                        {idx === activeIndex && (
                                            <span className="text-[10px] text-brand/70 font-mono shrink-0">↵ Enter</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                {query.length < 2 ? (
                                    <span>Escribe al menos 2 caracteres...</span>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <span>No se encontraron resultados.</span>
                                        <button
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleCreateNew();
                                            }}
                                            className="flex items-center gap-1 text-primary hover:underline font-medium"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Crear nuevo cliente &quot;{query}&quot;
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Keyboard hints footer */}
                        {results.length > 0 && (
                            <div className="px-3 py-1.5 border-t border-border bg-muted/30 flex items-center gap-3 text-[10px] text-muted-foreground">
                                <span>↑↓ navegar</span>
                                <span>↵ seleccionar</span>
                                <span>Esc cerrar</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
