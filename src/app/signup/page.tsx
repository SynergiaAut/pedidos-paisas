"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            setErrorMsg(error.message);
            setIsLoading(false);
        } else {
            toast.success("Cuenta creada exitosamente. ¡Bienvenido!");
            // Auto Login scenario or redirect to login? 
            // Supabase auto-signs in on signup if email confirmation is off.
            // Let's try to push to dashboard, if session exists.

            // Check session
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
                router.refresh();
                router.push("/pedidos");
            } else {
                // Email confirmation might be on
                setErrorMsg("Revisa tu email para confirmar tu cuenta (si aplica), o inicia sesión.");
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-black relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="animated-gradient-bg" />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-transparent to-black/50" />

            <div className="relative z-10 w-full max-w-sm space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-2xl shadow-blue-900/20">
                <div className="flex flex-col space-y-2 text-center">
                    <Link href="/login" className="absolute left-6 top-6 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Crear Cuenta</h1>
                    <p className="text-sm text-zinc-400">Únete al equipo de Pedidos Paisas</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none text-zinc-300" htmlFor="fullname">Nombre Completo</label>
                        <input
                            id="fullname"
                            type="text"
                            placeholder="Ej: Juan Pérez"
                            required
                            className="flex h-10 w-full rounded-md border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none text-zinc-300" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="usuario@fastorder.com"
                            required
                            className="flex h-10 w-full rounded-md border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none text-zinc-300" htmlFor="password">Contraseña</label>
                        <input
                            id="password"
                            type="password"
                            required
                            className="flex h-10 w-full rounded-md border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-red-400 text-sm font-medium">
                            {errorMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-500 h-10 px-4 py-2 shadow-lg shadow-blue-900/20"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Registrarse
                    </button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                    ¿Ya tienes cuenta? <Link href="/login" className="underline hover:text-blue-400 text-zinc-500">Inicia Sesión</Link>
                </div>
            </div>
        </div>
    );
}
