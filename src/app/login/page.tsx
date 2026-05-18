"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message);
            setIsLoading(false);
        } else {
            router.refresh();
            router.push("/pedidos");
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-black relative overflow-hidden">
            {/* CSS Animated Background */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="animated-gradient-bg" />
            </div>
            <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-transparent to-black/50" />

            <div className="relative z-10 w-full max-w-sm space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-2xl shadow-blue-900/20">
                <div className="flex flex-col space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Bienvenido</h1>
                    <p className="text-sm text-zinc-400">Ingresa tus credenciales para continuar</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none text-zinc-300" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="admin@fastorder.com"
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
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                        Ingresar
                    </button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                    <div className="text-center text-sm text-muted-foreground">
                        ¿No tienes cuenta? <Link href="/signup" className="underline hover:text-blue-400 text-zinc-500">Regístrate</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
