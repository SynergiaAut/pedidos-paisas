"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Shield, Package, Plus, Users } from "lucide-react";

export function MainNav() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, full_name')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setUserRole(profile.role);
                    setUserName(profile.full_name);
                }
            }
        };

        fetchUserProfile();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const routes = [
        {
            href: "/pedidos",
            label: "Pedidos",
            icon: Package,
            active: pathname === "/pedidos",
        },
        {
            href: "/pedidos/nuevo-api",
            label: "Nueva Orden",
            icon: Plus,
            active: pathname === "/pedidos/nuevo-api",
        },
    ];

    // Add admin route if user is admin
    if (userRole === 'admin') {
        routes.push({
            href: "/admin/usuarios",
            label: "Usuarios",
            icon: Users,
            active: pathname === "/admin/usuarios",
        });
    }

    return (
        <div className="border-b bg-gradient-to-r from-background via-background to-background/95 backdrop-blur-sm shadow-sm sticky top-0 z-50">
            <div className="flex h-14 items-center px-6 container mx-auto max-w-7xl">
                {/* Logo */}
                <Link href="/pedidos" className="flex items-center gap-3 mr-8 group" title="Ir al Inicio">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center font-black text-black shadow-md group-hover:shadow-lg transition-shadow">
                        FO
                    </div>
                </Link>

                {/* Navigation Links */}
                <nav className="flex items-center gap-1 flex-1">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                                route.active
                                    ? "bg-brand/15 text-brand border border-brand/20 shadow-sm"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            <route.icon className="h-4 w-4" />
                            <span className="hidden md:inline">{route.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* User Section */}
                {userName && (
                    <div className="flex items-center gap-3 ml-auto pl-4 border-l">
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-sm font-semibold leading-tight">{userName}</span>
                            {userRole && (
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider leading-tight",
                                    userRole === 'admin' ? "text-brand" : "text-muted-foreground"
                                )}>
                                    {userRole === 'admin' && <Shield className="h-2.5 w-2.5 inline mr-0.5" />}
                                    {userRole}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 border border-input bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 h-9 px-3 shadow-sm"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden xl:inline">Salir</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
