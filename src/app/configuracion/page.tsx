"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Check, MonitorCog, Moon, Settings, ShieldCheck } from "lucide-react";

interface Preferences {
    denseMode: boolean;
    soundAlerts: boolean;
    confirmActions: boolean;
}

const defaultPreferences: Preferences = {
    denseMode: false,
    soundAlerts: true,
    confirmActions: true,
};

export default function ConfiguracionPage() {
    const [preferences, setPreferences] = useState<Preferences>(() => {
        if (typeof window === "undefined") return defaultPreferences;
        const raw = window.localStorage.getItem("fastorder.preferences");
        if (!raw) return defaultPreferences;

        try {
            return { ...defaultPreferences, ...JSON.parse(raw) };
        } catch {
            return defaultPreferences;
        }
    });
    const [saved, setSaved] = useState(false);

    function updatePreference(key: keyof Preferences) {
        const next = { ...preferences, [key]: !preferences[key] };
        setPreferences(next);
        window.localStorage.setItem("fastorder.preferences", JSON.stringify(next));
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
    }

    return (
        <div className="mx-auto max-w-6xl">
            <section className="flex flex-col gap-5 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-black uppercase text-brand">
                        <Settings className="h-4 w-4" />
                        Preferencias
                    </span>
                    <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground">Configuracion</h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                        Ajustes personales de experiencia. Los cambios se guardan localmente en este equipo.
                    </p>
                </div>
                <Link href="/pedidos" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border px-5 font-black text-foreground hover:border-brand/50 hover:bg-card">
                    <ArrowLeft className="h-5 w-5" />
                    Volver a Pedidos
                </Link>
            </section>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <article className="rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xl font-black text-foreground">Experiencia de operacion</p>
                            <p className="mt-1 text-sm text-muted-foreground">Preferencias pensadas para el uso diario en mostrador y despacho.</p>
                        </div>
                        {saved && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                                <Check className="h-4 w-4" />
                                Guardado
                            </span>
                        )}
                    </div>

                    <div className="mt-6 space-y-3">
                        <PreferenceToggle
                            icon={MonitorCog}
                            title="Vista compacta"
                            description="Reduce aire visual en listados para revisar mas registros por pantalla."
                            active={preferences.denseMode}
                            onClick={() => updatePreference("denseMode")}
                        />
                        <PreferenceToggle
                            icon={Bell}
                            title="Alertas sonoras"
                            description="Reserva senales de sonido para eventos operativos importantes."
                            active={preferences.soundAlerts}
                            onClick={() => updatePreference("soundAlerts")}
                        />
                        <PreferenceToggle
                            icon={ShieldCheck}
                            title="Confirmar acciones sensibles"
                            description="Mantiene una barrera adicional antes de cierres, cambios de estado o acciones criticas."
                            active={preferences.confirmActions}
                            onClick={() => updatePreference("confirmActions")}
                        />
                    </div>
                </article>

                <article className="rounded-lg border border-border bg-card p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-200">
                        <Moon className="h-6 w-6" />
                    </div>
                    <p className="mt-5 text-xl font-black text-foreground">Tema Fast Order</p>
                    <p className="mt-2 text-muted-foreground">
                        La plataforma opera en modo oscuro por diseno: mejora contraste, reduce fatiga visual y conserva la personalidad visual del sistema.
                    </p>
                    <div className="mt-6 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
                        Los permisos y usuarios se administran desde el modulo Administracion.
                    </div>
                </article>
            </div>
        </div>
    );
}

function PreferenceToggle({
    icon: Icon,
    title,
    description,
    active,
    onClick,
}: {
    icon: typeof MonitorCog;
    title: string;
    description: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-background/45 p-4 text-left transition hover:border-brand/40 hover:bg-background/70"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-500/10 text-blue-200">
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="font-black text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <span className={`relative h-7 w-12 rounded-full border transition ${active ? "border-primary/40 bg-primary/30" : "border-border bg-muted/40"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-foreground transition ${active ? "left-6" : "left-1"}`} />
            </span>
        </button>
    );
}
