"use client";

import * as React from "react";
import {
    createManagedUser,
    getManagedUsers,
    updateManagedUser,
    type ManagedUserProfile,
} from "@/app/actions/users";
import {
    ACCESS_MODULES,
    getDefaultAccessForRole,
    getRoleMeta,
    USER_ROLES,
    type AccessModule,
    type UserRole,
} from "@/lib/user-roles";
import { cn } from "@/lib/utils";
import {
    Activity,
    Check,
    CheckCircle2,
    KeyRound,
    Loader2,
    Lock,
    Mail,
    Plus,
    RefreshCw,
    Search,
    Shield,
    ShieldOff,
    UserCog,
    Users,
} from "lucide-react";

const roleTone: Record<string, string> = {
    admin: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    pedidos: "border-blue-400/35 bg-blue-500/10 text-blue-200",
    despacho: "border-orange-400/35 bg-orange-500/10 text-orange-200",
    inventario: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
    cuadre: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
    analitica: "border-violet-400/35 bg-violet-500/10 text-violet-200",
    user: "border-slate-400/25 bg-slate-500/10 text-slate-200",
};

const permissionTone: Record<AccessModule, string> = {
    pedidos: "border-blue-400/35 bg-blue-500/10 text-blue-200",
    despacho: "border-orange-400/35 bg-orange-500/10 text-orange-200",
    crm: "border-violet-400/35 bg-violet-500/10 text-violet-200",
    inventario: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
    cuadre: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
    analitica: "border-indigo-400/35 bg-indigo-500/10 text-indigo-200",
    admin: "border-slate-400/35 bg-slate-500/10 text-slate-200",
};

const permissionCheckTone: Record<AccessModule, string> = {
    pedidos: "border-blue-300 bg-blue-300 text-black",
    despacho: "border-orange-300 bg-orange-300 text-black",
    crm: "border-violet-300 bg-violet-300 text-black",
    inventario: "border-cyan-300 bg-cyan-300 text-black",
    cuadre: "border-emerald-300 bg-emerald-300 text-black",
    analitica: "border-indigo-300 bg-indigo-300 text-black",
    admin: "border-slate-300 bg-slate-300 text-black",
};

interface NewUserForm {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    app_permissions: AccessModule[];
}

function formatUpdatedAt(value: string | null) {
    if (!value) return "Sin registro";
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function togglePermission(current: AccessModule[], permission: AccessModule) {
    return current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission];
}

export default function AdminUsersPage() {
    const [users, setUsers] = React.useState<ManagedUserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [savingId, setSavingId] = React.useState<string | null>(null);
    const [creating, setCreating] = React.useState(false);
    const [showCreate, setShowCreate] = React.useState(false);
    const [supportsGranularPermissions, setSupportsGranularPermissions] = React.useState(true);
    const [query, setQuery] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);
    const [newUser, setNewUser] = React.useState<NewUserForm>({
        full_name: "",
        email: "",
        password: "",
        role: "pedidos",
        app_permissions: getDefaultAccessForRole("pedidos"),
    });

    const loadUsers = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await getManagedUsers();

        if (result.success) {
            setUsers(result.data.users);
            setSupportsGranularPermissions(result.data.supportsGranularPermissions);
            if (!result.data.supportsGranularPermissions) {
                setMessage("La base aun no tiene la migracion 030; los accesos se muestran sugeridos, pero no se pueden guardar todavia.");
            }
        } else {
            setError(result.error);
        }

        setLoading(false);
    }, []);

    React.useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const filteredUsers = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return users;

        return users.filter((user) => {
            const role = getRoleMeta(user.role);
            return [user.full_name, user.email, user.id, user.role, role.label, role.description]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle));
        });
    }, [query, users]);

    const activeUsers = users.filter((user) => user.is_active).length;
    const adminUsers = users.filter((user) => user.role === "admin").length;
    const inactiveUsers = users.length - activeUsers;

    const updateUser = async (
        id: string,
        patch: { full_name?: string; role?: UserRole; is_active?: boolean; app_permissions?: AccessModule[] }
    ) => {
        setSavingId(id);
        setError(null);
        setMessage(null);

        const result = await updateManagedUser({ id, ...patch });

        if (result.success) {
            setUsers((current) => current.map((user) => (user.id === id ? result.data : user)));
            setMessage(result.warning ?? "Perfil actualizado.");
        } else {
            setError(result.error);
        }

        setSavingId(null);
    };

    const handleCreateUser = async (event: React.FormEvent) => {
        event.preventDefault();
        setCreating(true);
        setError(null);
        setMessage(null);

        const result = await createManagedUser(newUser);

        if (result.success) {
            setUsers((current) => [result.data, ...current]);
            setMessage(result.warning ?? "Usuario creado y perfil asignado.");
            setNewUser({
                full_name: "",
                email: "",
                password: "",
                role: "pedidos",
                app_permissions: getDefaultAccessForRole("pedidos"),
            });
            setShowCreate(false);
        } else {
            setError(result.error);
        }

        setCreating(false);
    };

    return (
        <main className="min-h-screen bg-background">
            <section className="border-b border-border bg-background/95">
                <div className="container mx-auto max-w-7xl px-4 py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                                <Shield className="h-3.5 w-3.5" />
                                Administracion
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white">Usuarios y perfiles</h1>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                Administra colaboradores, rol operativo y accesos por modulo con una lectura clara para soporte.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setShowCreate((value) => !value)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-black text-black shadow-sm shadow-brand/20 transition hover:bg-brand/90"
                            >
                                <Plus className="h-4 w-4" />
                                Crear usuario
                            </button>
                            <button
                                onClick={() => void loadUsers()}
                                disabled={loading}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-60"
                            >
                                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                                Actualizar
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-4">
                        {[
                            { label: "Usuarios", value: users.length, icon: Users, tone: "text-blue-300 bg-blue-500/10" },
                            { label: "Activos", value: activeUsers, icon: CheckCircle2, tone: "text-emerald-300 bg-emerald-500/10" },
                            { label: "Administradores", value: adminUsers, icon: Shield, tone: "text-amber-200 bg-amber-500/10" },
                            { label: "Inactivos", value: inactiveUsers, icon: ShieldOff, tone: "text-red-200 bg-red-500/10" },
                        ].map((item) => (
                            <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black uppercase text-muted-foreground">{item.label}</p>
                                        <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
                                    </div>
                                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", item.tone)}>
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="container mx-auto max-w-7xl px-4 py-6">
                {showCreate && (
                    <form onSubmit={handleCreateUser} className="mb-5 overflow-hidden rounded-lg border border-brand/25 bg-card">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                                    <UserCog className="h-5 w-5 text-brand" />
                                    Nuevo usuario
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">Crea la cuenta y asigna permisos iniciales.</p>
                            </div>
                        </div>

                        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_0.9fr_0.9fr]">
                            <label className="space-y-1">
                                <span className="text-xs font-black uppercase text-muted-foreground">Nombre</span>
                                <input
                                    value={newUser.full_name}
                                    onChange={(event) => setNewUser((current) => ({ ...current, full_name: event.target.value }))}
                                    required
                                    placeholder="Ej: Milena Salazar"
                                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-brand"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-black uppercase text-muted-foreground">Correo</span>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={newUser.email}
                                        onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                                        required
                                        type="email"
                                        placeholder="usuario@fastorder.com"
                                        className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-brand"
                                    />
                                </div>
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-black uppercase text-muted-foreground">Clave temporal</span>
                                <div className="relative">
                                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={newUser.password}
                                        onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                                        required
                                        minLength={6}
                                        type="password"
                                        placeholder="Minimo 6 caracteres"
                                        className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-brand"
                                    />
                                </div>
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-black uppercase text-muted-foreground">Rol base</span>
                                <select
                                    value={newUser.role}
                                    onChange={(event) => {
                                        const role = event.target.value as UserRole;
                                        setNewUser((current) => ({
                                            ...current,
                                            role,
                                            app_permissions: getDefaultAccessForRole(role),
                                        }));
                                    }}
                                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold outline-none transition [color-scheme:dark] focus:border-brand"
                                >
                                    {USER_ROLES.map((role) => (
                                        <option key={role.value} value={role.value} className="bg-background text-foreground">
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="border-t border-border px-5 py-4">
                            <p className="mb-3 text-xs font-black uppercase text-muted-foreground">Accesos habilitados</p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {ACCESS_MODULES.map((module) => {
                                    const checked = newUser.app_permissions.includes(module.value);
                                    return (
                                        <button
                                            key={module.value}
                                            type="button"
                                            onClick={() =>
                                                setNewUser((current) => ({
                                                    ...current,
                                                    app_permissions: togglePermission(current.app_permissions, module.value),
                                                }))
                                            }
                                            className={cn(
                                                "rounded-lg border p-3 text-left transition",
                                                checked ? permissionTone[module.value] : "border-border bg-background hover:bg-muted/30"
                                            )}
                                        >
                                            <span className="flex items-center gap-2 text-sm font-black text-white">
                                                <span className={cn("flex h-5 w-5 items-center justify-center rounded border", checked ? permissionCheckTone[module.value] : "border-muted-foreground")}>
                                                    {checked && <Check className="h-3.5 w-3.5" />}
                                                </span>
                                                {module.label}
                                            </span>
                                            <span className="mt-1 block text-xs text-muted-foreground">{module.description}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="h-10 rounded-lg border border-border px-4 text-sm font-bold transition hover:bg-muted"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-black text-black transition hover:bg-brand/90 disabled:opacity-60"
                                >
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Guardar usuario
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="mb-5 rounded-lg border border-border bg-card p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_360px] lg:items-center">
                        <div>
                            <h2 className="text-lg font-black text-white">Roles y accesos</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {supportsGranularPermissions
                                    ? "El rol propone un paquete inicial; el checklist ajusta accesos por persona."
                                    : "Pendiente aplicar migracion 030: por ahora se muestran accesos sugeridos segun el rol."}
                            </p>
                        </div>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar usuario, correo o rol..."
                                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-brand"
                            />
                        </div>
                    </div>
                </div>

                {(error || message) && (
                    <div
                        className={cn(
                            "mb-4 rounded-lg border px-4 py-3 text-sm font-semibold",
                            error
                                ? "border-red-500/30 bg-red-500/10 text-red-200"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        )}
                    >
                        {error || message}
                    </div>
                )}

                {loading ? (
                    <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-card">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-border bg-card text-center text-muted-foreground">
                        <Users className="mb-3 h-10 w-10 opacity-50" />
                        <p className="font-semibold">No hay usuarios para ese filtro.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredUsers.map((user) => {
                            const role = getRoleMeta(user.role);
                            const saving = savingId === user.id;

                            return (
                                <article
                                    key={user.id}
                                    className={cn(
                                        "rounded-lg border border-border bg-card p-4 transition hover:border-brand/35 hover:bg-muted/10",
                                        !user.is_active && "opacity-65"
                                    )}
                                >
                                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1.7fr_0.8fr] xl:items-start">
                                        <div className="min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-500/10 text-sm font-black text-blue-200">
                                                    {(user.full_name || user.email || "U").slice(0, 1).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <input
                                                        defaultValue={user.full_name ?? ""}
                                                        onBlur={(event) => {
                                                            const nextName = event.target.value.trim();
                                                            if (nextName !== (user.full_name ?? "")) {
                                                                void updateUser(user.id, { full_name: nextName });
                                                            }
                                                        }}
                                                        className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-base font-black text-white outline-none transition hover:border-border hover:bg-background focus:border-brand focus:bg-background"
                                                        placeholder="Nombre del colaborador"
                                                    />
                                                    <p className="truncate px-2 text-xs text-muted-foreground">{user.email ?? "Sin correo visible"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Rol base</p>
                                            <select
                                                value={role.value}
                                                disabled={saving}
                                                onChange={(event) => {
                                                    const nextRole = event.target.value as UserRole;
                                                    void updateUser(user.id, {
                                                        role: nextRole,
                                                        app_permissions: getDefaultAccessForRole(nextRole),
                                                    });
                                                }}
                                                className={cn("h-10 w-full rounded-lg border px-3 text-sm font-black outline-none transition [color-scheme:dark] focus:border-brand", roleTone[role.value])}
                                            >
                                                {USER_ROLES.map((option) => (
                                                    <option key={option.value} value={option.value} className="bg-background text-foreground">
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{role.description}</p>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Accesos</p>
                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                                {ACCESS_MODULES.map((module) => {
                                                    const checked = user.app_permissions.includes(module.value);
                                                    return (
                                                        <button
                                                            key={module.value}
                                                            onClick={() =>
                                                                void updateUser(user.id, {
                                                                    app_permissions: togglePermission(user.app_permissions, module.value),
                                                                })
                                                            }
                                                            disabled={saving || !supportsGranularPermissions}
                                                            title={module.description}
                                                            className={cn(
                                                                "inline-flex h-9 items-center gap-2 rounded-lg border px-2 text-xs font-black transition disabled:opacity-60",
                                                                checked
                                                                    ? permissionTone[module.value]
                                                                    : "border-border bg-background text-muted-foreground hover:bg-muted/35"
                                                            )}
                                                        >
                                                            <span className={cn("flex h-4 w-4 items-center justify-center rounded border", checked ? permissionCheckTone[module.value] : "border-muted-foreground")}>
                                                                {checked && <Check className="h-3 w-3" />}
                                                            </span>
                                                            {module.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 xl:items-end">
                                            <button
                                                onClick={() => void updateUser(user.id, { is_active: !user.is_active })}
                                                disabled={saving}
                                                className={cn(
                                                    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black transition disabled:opacity-60",
                                                    user.is_active
                                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                                                        : "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                                                )}
                                            >
                                                {user.is_active ? <CheckCircle2 className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                                                {user.is_active ? "Activo" : "Inactivo"}
                                            </button>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {user.role === "admin" ? <Lock className="h-4 w-4 text-amber-200/80" /> : <Activity className="h-4 w-4" />}
                                                <span>{formatUpdatedAt(user.updated_at)}</span>
                                            </div>
                                            {saving && (
                                                <div className="flex items-center gap-2 text-xs font-bold text-brand">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Guardando
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}
