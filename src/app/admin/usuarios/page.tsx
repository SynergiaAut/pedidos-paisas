"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, UserCog, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfile {
    id: string;
    full_name: string;
    role: string;
    is_active: boolean;
    updated_at: string;
    email?: string;
}

export default function AdminUsersPage() {
    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const fetchUsers = async () => {
        // Get current user's role first
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            router.push('/pedidos');
            return;
        }

        setCurrentUserRole(profile.role);

        // Fetch all users with their auth data
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
        } else {
            // Get emails from auth.users (requires service role or proper RLS)
            // For now, we'll just show profiles
            setUsers(profiles || []);
        }

        setLoading(false);
    };

    React.useEffect(() => {
        fetchUsers();
    }, []);

    const toggleRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            alert('Error updating role: ' + error.message);
        } else {
            fetchUsers(); // Refresh list
        }
    };

    const toggleStatus = async (userId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_active: !currentStatus })
            .eq('id', userId);

        if (error) {
            alert('Error updating status: ' + error.message);
        } else {
            fetchUsers(); // Refresh list
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
        );
    }

    if (currentUserRole !== 'admin') {
        return null;
    }

    return (
        <div className="container mx-auto max-w-6xl py-8 px-4">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8 text-brand" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-muted-foreground mt-1">Administra roles y permisos del sistema</p>
                </div>
                <div className="flex items-center gap-2 text-sm bg-brand/10 border border-brand/20 px-4 py-2 rounded-lg">
                    <Shield className="h-4 w-4 text-brand" />
                    <span className="font-semibold">Panel de Administrador</span>
                </div>
            </div>

            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left p-4 font-semibold text-sm">Usuario</th>
                                <th className="text-left p-4 font-semibold text-sm">Rol</th>
                                <th className="text-left p-4 font-semibold text-sm">Estado</th>
                                <th className="text-left p-4 font-semibold text-sm">Última Actualización</th>
                                <th className="text-center p-4 font-semibold text-sm">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b hover:bg-accent/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.full_name || 'Sin nombre'}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}...</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
                                            user.role === 'admin'
                                                ? "bg-brand/20 text-brand border border-brand/30"
                                                : "bg-blue-500/20 text-blue-600 border border-blue-500/30"
                                        )}>
                                            {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                                            {user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
                                            user.is_active
                                                ? "bg-green-500/20 text-green-600"
                                                : "bg-red-500/20 text-red-600"
                                        )}>
                                            {user.is_active ? '✓ Activo' : '✗ Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-muted-foreground">
                                        {new Date(user.updated_at).toLocaleDateString('es-ES')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => toggleRole(user.id, user.role)}
                                                className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:bg-accent"
                                                title={user.role === 'admin' ? 'Degradar a Usuario' : 'Promover a Admin'}
                                            >
                                                {user.role === 'admin' ? '↓ Usuario' : '↑ Admin'}
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(user.id, user.is_active)}
                                                className={cn(
                                                    "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                                                    user.is_active
                                                        ? "hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                                        : "hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                                                )}
                                                title={user.is_active ? 'Desactivar cuenta' : 'Activar cuenta'}
                                            >
                                                {user.is_active ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {users.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No hay usuarios registrados
                    </div>
                )}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-muted/30 border text-sm">
                <p className="font-semibold mb-2">ℹ️ Información:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Admin</strong>: Acceso total al sistema, incluyendo este panel.</li>
                    <li><strong>Usuario</strong>: Acceso a pedidos y operaciones básicas.</li>
                    <li><strong>Desactivar</strong>: El usuario no podrá iniciar sesión ni acceder al sistema.</li>
                </ul>
            </div>
        </div>
    );
}
