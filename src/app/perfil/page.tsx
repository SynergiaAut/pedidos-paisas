"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ACCESS_MODULES, getDefaultAccessForRole, getRoleMeta, normalizeAccessModules, type AccessModule, type UserRole } from "@/lib/user-roles";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckCircle2, IdCard, Mail, ShieldCheck, UserRound } from "lucide-react";

interface ProfileRow {
    id: string;
    full_name: string | null;
    role: UserRole | string | null;
    app_permissions: unknown;
    is_active: boolean | null;
    updated_at: string | null;
}

function formatDate(value: string | null) {
    if (!value) return "Sin registro";
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export default function PerfilPage() {
    const [email, setEmail] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfile() {
            setLoading(true);
            const { data: userData } = await supabase.auth.getUser();
            const user = userData.user;

            if (!user) {
                setLoading(false);
                return;
            }

            setEmail(user.email ?? null);
            const { data } = await supabase
                .from("profiles")
                .select("id, full_name, role, app_permissions, is_active, updated_at")
                .eq("id", user.id)
                .maybeSingle();

            setProfile(data as ProfileRow | null);
            setLoading(false);
        }

        void loadProfile();
    }, []);

    const roleMeta = getRoleMeta(profile?.role);
    const permissions = useMemo(() => {
        const customPermissions = normalizeAccessModules(profile?.app_permissions);
        if (customPermissions.length > 0) return customPermissions;
        return getDefaultAccessForRole(roleMeta.value as UserRole);
    }, [profile?.app_permissions, roleMeta.value]);

    const initials = (profile?.full_name ?? email ?? "FO")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

    return (
        <div className="mx-auto max-w-6xl">
            <section className="flex flex-col gap-5 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-black uppercase text-brand">
                        <UserRound className="h-4 w-4" />
                        Mi perfil
                    </span>
                    <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground">Cuenta operativa</h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                        Consulta tu identidad dentro de Fast Order, rol base y accesos habilitados por modulo.
                    </p>
                </div>
                <Link href="/pedidos" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border px-5 font-black text-foreground hover:border-brand/50 hover:bg-card">
                    <ArrowLeft className="h-5 w-5" />
                    Volver a Pedidos
                </Link>
            </section>

            <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <article className="rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center gap-5">
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-brand/35 bg-brand/15 text-2xl font-black text-brand">
                            {initials || "FO"}
                        </div>
                        <div>
                            <p className="text-2xl font-black text-foreground">{loading ? "Cargando..." : profile?.full_name ?? "Usuario Fast Order"}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{roleMeta.label}</p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <InfoItem icon={Mail} label="Correo" value={email ?? "Sin correo visible"} />
                        <InfoItem icon={IdCard} label="ID usuario" value={profile?.id ?? "Sin perfil vinculado"} />
                        <InfoItem icon={ShieldCheck} label="Estado" value={profile?.is_active === false ? "Inactivo" : "Activo"} tone={profile?.is_active === false ? "danger" : "success"} />
                    </div>
                </article>

                <article className="rounded-lg border border-border bg-card p-6">
                    <p className="text-xs font-black uppercase text-muted-foreground">Accesos habilitados</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {ACCESS_MODULES.map((module) => {
                            const enabled = permissions.includes(module.value as AccessModule);
                            return (
                                <div
                                    key={module.value}
                                    className={`rounded-lg border p-4 ${enabled ? "border-primary/35 bg-primary/10" : "border-border bg-background/45 opacity-60"}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className={`h-5 w-5 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
                                        <p className="font-black text-foreground">{module.label}</p>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-5 text-sm text-muted-foreground">Ultima actualizacion: {formatDate(profile?.updated_at ?? null)}</p>
                </article>
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value, tone = "default" }: { icon: typeof Mail; label: string; value: string; tone?: "default" | "success" | "danger" }) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background/45 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tone === "success" ? "bg-primary/15 text-primary" : tone === "danger" ? "bg-red-500/15 text-red-300" : "bg-blue-500/10 text-blue-200"}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
                <p className="font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}
