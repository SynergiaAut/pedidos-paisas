"use client";

import { createClient } from "@/utils/supabase/client";
import { DottedSurface } from "@/components/ui/dotted-surface";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
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
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.10),rgba(15,23,42,0.18)_30%,transparent_62%)]" />
            <DottedSurface
                className="pointer-events-none absolute inset-0 z-0"
                dotColor="#9fb8d8"
                accentColor="#f6a400"
            />

            <section
                className={`relative z-10 flex w-full max-w-5xl flex-col items-center transition-all duration-500 ${
                    showLogin ? "pointer-events-none -translate-y-6 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"
                }`}
            >
                <div className="relative flex min-h-[620px] w-full items-center justify-center">
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="relative flex flex-col items-center">
                            <div className="relative h-24 w-80 sm:h-28 sm:w-[28rem]">
                                <Image
                                    src="/brand/fastorder-logo-horizontal-ui.png"
                                    alt="Fast Order"
                                    fill
                                    priority
                                    sizes="448px"
                                    className="object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLogin(true)}
                                className="group mt-5 inline-flex items-center gap-3 border-b border-brand/35 pb-1 text-[11px] font-black uppercase tracking-[0.32em] text-brand/90 transition hover:border-brand hover:text-brand active:scale-95"
                            >
                                Iniciar sesion
                                <span className="h-px w-6 bg-brand/50 transition group-hover:w-10 group-hover:bg-brand" />
                            </button>
                        </div>
                        <p className="mt-8 max-w-xl text-balance text-center text-sm font-semibold text-slate-200 sm:text-base">
                            Pedidos, inventario, despacho y cuadre diario.
                        </p>
                    </div>
                </div>
            </section>

            <div
                className={`absolute inset-0 z-20 flex items-center justify-center p-4 transition-all duration-500 ${
                    showLogin ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"
                }`}
            >
                <div className="relative w-full max-w-md rounded-2xl p-px shadow-2xl shadow-black/80">
                    <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(15,23,42,0.28)_44%,rgba(2,8,23,0.58))] opacity-95" />
                    <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.045),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(30,64,175,0.055),transparent_42%)]" />
                    <div className="relative space-y-7 rounded-2xl border border-blue-300/10 bg-[#020713]/72 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.028)] backdrop-blur-2xl">
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setShowLogin(false)}
                                className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:text-brand"
                            >
                                Volver
                            </button>
                            <span className="h-px w-16 bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
                        </div>

                        <div className="flex flex-col items-center space-y-4 text-center">
                            <div className="relative h-20 w-64">
                                <Image
                                    src="/brand/fastorder-logo-horizontal-ui.png"
                                    alt="Fast Order"
                                    fill
                                    priority
                                    sizes="256px"
                                    className="object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                                />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-white">Bienvenido</h1>
                                <p className="mt-1 text-sm text-slate-400">Accede a tu mesa de operacion</p>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400" htmlFor="email">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="admin@fastorder.com"
                                    required
                                    className="flex h-12 w-full rounded-xl border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-white placeholder:text-muted-foreground outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] focus:border-brand/65 focus:bg-muted/30 focus:shadow-[0_0_0_3px_rgba(246,164,0,0.08),inset_0_1px_0_rgba(255,255,255,0.045)] disabled:cursor-not-allowed disabled:opacity-50"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400" htmlFor="password">
                                    Contrasena
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    className="flex h-12 w-full rounded-xl border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-white placeholder:text-muted-foreground outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] focus:border-brand/65 focus:bg-muted/30 focus:shadow-[0_0_0_3px_rgba(246,164,0,0.08),inset_0_1px_0_rgba(255,255,255,0.045)] disabled:cursor-not-allowed disabled:opacity-50"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {errorMsg && (
                                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand/45 bg-brand px-4 py-2 text-sm font-black text-black shadow-[0_14px_34px_rgba(246,164,0,0.12)] transition hover:bg-brand/90 hover:shadow-[0_16px_42px_rgba(246,164,0,0.20)] disabled:pointer-events-none disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                Ingresar
                            </button>
                        </form>

                        <div className="text-center text-sm text-slate-500">
                            No tienes cuenta?{" "}
                            <Link href="/signup" className="font-black text-brand transition hover:text-brand/80">
                                Registrate
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
