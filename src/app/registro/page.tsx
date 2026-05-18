'use client';

import * as React from "react";
import { useFormStatus } from "react-dom";
import { registerClient } from "./actions";
import { Check, Loader2, Smartphone, User, MapPin, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className={cn(
                "w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black/90 transition-all active:scale-95 text-lg flex items-center justify-center gap-2",
                pending && "opacity-70 cursor-not-allowed"
            )}
        >
            {pending ? <Loader2 className="animate-spin" /> : "Registrarme"}
        </button>
    );
}

export default function RegistroPage() {
    const [state, setState] = React.useState<{ success: boolean; message: string } | null>(null);

    async function handleSubmit(formData: FormData) {
        const result = await registerClient(formData);
        setState(result);
    }

    if (state?.success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10 space-y-6"
            >
                <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">¡Bienvenido!</h2>
                <p className="text-slate-600">
                    Tu registro ha sido exitoso.<br />Ya haces parte de nuestra familia.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-brand font-bold underline mt-8 block"
                >
                    Volver al inicio
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">¡Hola! 👋</h2>
                <p className="text-slate-500 text-sm">Completa tus datos para agilizar tus pedidos y recibir promociones.</p>
            </div>

            <form action={handleSubmit} className="space-y-4">
                {state?.message && !state.success && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium border border-red-100">
                        {state.message}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="relative">
                        <Smartphone className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                        <input
                            name="phone"
                            type="tel"
                            required
                            placeholder="Celular (300...)"
                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-lg font-medium text-slate-900"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                            <input
                                name="firstName"
                                required
                                placeholder="Nombre"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-slate-900"
                            />
                        </div>
                        <input
                            name="lastName"
                            required
                            placeholder="Apellido"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-slate-900"
                        />
                    </div>

                    <div className="relative">
                        <CreditCard className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                        <input
                            name="documentId"
                            placeholder="Cédula (Opcional)"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-slate-900"
                        />
                    </div>

                    <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                        <input
                            name="address"
                            placeholder="Dirección Princip (Opcional)"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-slate-900"
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <SubmitButton />
                    <p className="text-center text-xs text-slate-400 mt-4">
                        Al registrarte aceptas nuestra política de tratamiento de datos.
                    </p>
                </div>
            </form>
        </motion.div>
    );
}
