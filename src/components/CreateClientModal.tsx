"use client";

import * as React from "react";
import { X, Save, Loader2, User, MapPin, Hash, Phone, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Client } from "@/types/order";
import { cn } from "@/lib/utils";

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (client: Client) => void;
    initialName?: string;
}

export function CreateClientModal({ isOpen, onClose, onSuccess, initialName = "" }: CreateClientModalProps) {
    const [loading, setLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        firstName: "",
        lastName: "",
        documentId: "",
        phone: "",
        email: "",
        address: ""
    });

    React.useEffect(() => {
        if (isOpen && initialName) {
            // Try to split the search query into first and last name nicely
            const parts = initialName.split(" ");
            if (parts.length > 1) {
                setFormData(prev => ({
                    ...prev,
                    firstName: parts[0],
                    lastName: parts.slice(1).join(" ")
                }));
            } else {
                setFormData(prev => ({ ...prev, firstName: initialName }));
            }
        }
    }, [isOpen, initialName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const fullName = `${formData.firstName} ${formData.lastName}`.trim();

        const { data, error } = await supabase.from('clients').insert({
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name: fullName,
            document_id: formData.documentId,
            phone: formData.phone,
            email: formData.email,
            address: formData.address,
            total_orders: 0
        }).select().single();

        setLoading(false);

        if (error) {
            console.error(error);
            alert("Error al crear cliente.");
        } else if (data) {
            onSuccess(data);
            onClose();
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
                            className="bg-background border shadow-xl rounded-xl w-full max-w-lg pointer-events-auto overflow-hidden"
                        >
                            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight">Nuevo Cliente</h2>
                                    <p className="text-xs text-muted-foreground">Ingresa los datos del cliente para registrarlo.</p>
                                </div>
                                <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                            <User className="h-3.5 w-3.5" /> Nombres *
                                        </label>
                                        <input
                                            required
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary uppercase placeholder:normal-case"
                                            placeholder="EJ: JUAN"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                            Apellidos *
                                        </label>
                                        <input
                                            required
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary uppercase placeholder:normal-case"
                                            placeholder="EJ: PÉREZ"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                            <Hash className="h-3.5 w-3.5" /> Documento (C.C/NIT)
                                        </label>
                                        <input
                                            name="documentId"
                                            value={formData.documentId}
                                            onChange={handleChange}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono"
                                            placeholder="1234567890"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                            <Phone className="h-3.5 w-3.5" /> Teléfono
                                        </label>
                                        <input
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono"
                                            placeholder="300 000 0000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                        <Mail className="h-3.5 w-3.5" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary uppercase placeholder:normal-case"
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                        <MapPin className="h-3.5 w-3.5" /> Dirección
                                    </label>
                                    <input
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary uppercase placeholder:normal-case"
                                        placeholder="EJ: CALLE 123 # 45 - 67"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                                    >
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Guardar Cliente
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
