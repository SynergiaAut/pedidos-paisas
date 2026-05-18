"use client";

import React, { useState, useEffect } from 'react';
import { Search, Plus, Database, Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface InventoryItem {
    id: string;
    db_source: '01' | '02';
    item_id: number;
    description: string;
    barcode: string | null;
    system_stock: number;
    category: string | null;
    price?: number; // Added locally or fetched if available
}

interface UnifiedProductSearchProps {
    onSelect: (item: any) => void;
    className?: string;
}

export function UnifiedProductSearch({ onSelect, className }: UnifiedProductSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) {
                searchProducts();
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const searchProducts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_master')
                .select('*')
                .or(`description.ilike.%${query}%,barcode.eq.${query}`)
                .limit(10);

            if (data) setResults(data as InventoryItem[]);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("relative", className)}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-brand outline-none transition-all"
                    placeholder="Buscar producto por nombre o código..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {isOpen && (results.length > 0 || query.length > 2) && (
                <div className="absolute z-50 w-full mt-2 bg-card border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {results.length > 0 ? (
                        <div className="divide-y max-h-80 overflow-y-auto">
                            {results.map((item) => (
                                <button
                                    key={item.id}
                                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left group"
                                    onClick={() => {
                                        onSelect({
                                            id: item.item_id,
                                            name: item.description,
                                            db_source: item.db_source,
                                            price: 0, // Should prompt for price or fetch default
                                            qty: 1
                                        });
                                        setQuery('');
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-lg",
                                            item.db_source === '01' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                        )}>
                                            <Package className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm uppercase group-hover:text-brand transition-colors">
                                                {item.description}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold border",
                                                    item.db_source === '01' 
                                                        ? "border-blue-200 bg-blue-50 text-blue-600" 
                                                        : "border-purple-200 bg-purple-50 text-purple-600"
                                                )}>
                                                    DB {item.db_source === '01' ? 'INTERNA' : 'FISCAL'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Stock: {item.system_stock}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-brand" />
                                </button>
                            ))}
                        </div>
                    ) : !isLoading && (
                        <div className="p-8 text-center text-muted-foreground">
                            No se encontraron productos para "{query}"
                        </div>
                    )}
                </div>
            )}
            
            {/* Click outside to close */}
            {isOpen && <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)} />}
        </div>
    );
}
