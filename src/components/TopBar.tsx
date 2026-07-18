"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, useRef } from "react";
import {
    LogOut,
    Shield,
    Plus,
    LayoutGrid,
    User,
    Package,
    BarChart3,
    Users,
    Settings,
    History,
    Archive,
    Store,
    ChevronDown,
    Truck,
    ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TopBar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userInitials, setUserInitials] = useState<string>("U");

    // Dropdown states
    const [isAppsOpen, setIsAppsOpen] = useState(false);
    const [isUserOpen, setIsUserOpen] = useState(false);

    // Click outside references
    const appsRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);

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
                    // Generate initials
                    const nameParts = profile.full_name?.split(' ') || [];
                    if (nameParts.length >= 2) {
                        setUserInitials(`${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase());
                    } else if (nameParts.length === 1) {
                        setUserInitials(nameParts[0][0].toUpperCase());
                    }
                }
            }
        };

        fetchUserProfile();

        // Close dropdowns on click outside
        const handleClickOutside = (event: MouseEvent) => {
            if (appsRef.current && !appsRef.current.contains(event.target as Node)) {
                setIsAppsOpen(false);
            }
            if (userRef.current && !userRef.current.contains(event.target as Node)) {
                setIsUserOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    // Navigation Modules (The Grid)
    const modules = [
        {
            title: "Pedidos",
            description: "Gestión diaria",
            href: "/pedidos",
            icon: Package,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            title: "CRM",
            description: "Clientes & Fidelización",
            href: "/crm",
            icon: Users,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
        },
        {
            title: "Analytics",
            description: "Reportes & KPIs",
            href: "/analytics",
            icon: BarChart3,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
        },
        {
            title: "Cuadre",
            description: "Cierre diario",
            href: "/cuadre",
            icon: ClipboardList,
            color: "text-amber-500",
            bgColor: "bg-amber-500/10",
        },
        {
            title: "Historial",
            description: "Búsqueda avanzada",
            href: "/pedidos/historial", // Future
            icon: History,
            color: "text-orange-500",
            bgColor: "bg-orange-500/10",
            disabled: true,
        },
        {
            title: "Caja",
            description: "Movimientos",
            href: "/caja", // Future
            icon: Store,
            color: "text-indigo-500",
            bgColor: "bg-indigo-500/10",
            disabled: true,
        },
        {
            title: "Inventario",
            description: "Productos & Control",
            href: "/inventario",
            icon: Archive,
            color: "text-cyan-500",
            bgColor: "bg-cyan-500/10",
        },
    ];

    if (userRole === 'admin') {
        modules.push({
            title: "Admin",
            description: "Configuración",
            href: "/admin/usuarios",
            icon: Shield,
            color: "text-red-500",
            bgColor: "bg-red-500/10",
        });
    }

    return (
        <header className="border-b bg-background/95 backdrop-blur-sm shadow-sm sticky top-0 z-50 h-16">
            <div className="flex h-full items-center px-6 container mx-auto max-w-7xl justify-between">
                {/* 1. Left: Brand */}
                <Link href="/pedidos" className="flex items-center gap-3 group" title="Ir al Inicio">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center font-black text-black shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
                        FO
                    </div>
                    <span className="hidden md:block font-bold text-lg tracking-tight">Fast Order</span>
                </Link>

                {/* 2. Center: Context (Breadcrumbs Placeholders for now) */}
                <div className="hidden md:flex items-center text-sm text-muted-foreground">
                    {/* Could be dynamic breadcrumbs later */}
                </div>

                {/* 3. Right: Actions */}
                <div className="flex items-center gap-3">
                    {/* Primary Action */}
                    <Link
                        href="/pedidos/nuevo-api"
                        className={cn(
                            "hidden sm:flex items-center gap-2 bg-brand text-black font-bold px-4 py-2 rounded-full text-sm hover:bg-brand/90 transition-transform active:scale-95 shadow-sm shadow-brand/20",
                            pathname === '/pedidos/nuevo-api' && "ring-2 ring-offset-2 ring-brand"
                        )}
                    >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Nueva Orden</span>
                    </Link>

                    <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>

                    {/* Apps Grid Menu */}
                    <div className="relative" ref={appsRef}>
                        <button
                            onClick={() => setIsAppsOpen(!isAppsOpen)}
                            className={cn(
                                "p-2 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors",
                                isAppsOpen && "bg-accent text-accent-foreground"
                            )}
                            title="Aplicaciones"
                        >
                            <LayoutGrid className="w-5 h-5 text-muted-foreground" />
                        </button>

                        <AnimatePresence>
                            {isAppsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-80 rounded-xl border bg-popover p-4 shadow-xl z-50"
                                >
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-2">Módulos</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {modules.map((module) => (
                                            <Link
                                                key={module.title}
                                                href={module.disabled ? '#' : module.href}
                                                onClick={() => !module.disabled && setIsAppsOpen(false)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-3 rounded-lg hover:bg-muted/50 transition-colors gap-2 text-center group",
                                                    module.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                                )}
                                            >
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", module.bgColor)}>
                                                    <module.icon className={cn("w-5 h-5", module.color)} />
                                                </div>
                                                <span className="text-xs font-medium">{module.title}</span>
                                            </Link>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t text-center">
                                        <Link href="/configuracion" className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                                            <Settings className="w-3 h-3" /> Configuración Global
                                        </Link>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* User Menu */}
                    <div className="relative ml-1" ref={userRef}>
                        <button
                            onClick={() => setIsUserOpen(!isUserOpen)}
                            className="flex items-center gap-2 group p-1 -mr-2 rounded-full hover:bg-muted/50 pr-3 transition-colors"
                        >
                            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-background group-hover:ring-brand/50 transition-all">
                                {userInitials}
                            </div>
                            <div className="hidden lg:flex flex-col items-start text-xs">
                                <span className="font-semibold text-foreground max-w-[100px] truncate">{userName}</span>
                                <span className="text-muted-foreground capitalize">{userRole}</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground hidden lg:block" />
                        </button>

                        <AnimatePresence>
                            {isUserOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-56 rounded-xl border bg-popover p-2 shadow-xl z-50 divide-y divide-border/50"
                                >
                                    <div className="px-2 py-1.5 pb-2">
                                        <p className="text-sm font-semibold">{userName}</p>
                                        <p className="text-xs text-muted-foreground truncate">{userRole || 'Usuario'}</p>
                                    </div>
                                    <div className="py-1">
                                        <Link href="/perfil" className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted/50 transition-colors">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            Mi Perfil
                                        </Link>
                                        <Link href="/configuracion" className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted/50 transition-colors">
                                            <Settings className="w-4 h-4 text-muted-foreground" />
                                            Preferencias
                                        </Link>
                                    </div>
                                    <div className="pt-1">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-red-500 hover:bg-red-500/10 transition-colors font-medium"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
