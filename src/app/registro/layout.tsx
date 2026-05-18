import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Registro - Pedidos Paisas",
    description: "Registro de clientes",
};

export default function RegistroLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-brand p-6 text-center">
                    <h1 className="text-2xl font-black text-black tracking-tight uppercase">Granero Los Paisas</h1>
                    <p className="text-black/80 text-sm font-medium mt-1">Registro de Clientes</p>
                </div>
                <main className="p-6">
                    {children}
                </main>
            </div>
            <footer className="mt-8 text-center text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} Pedidos Paisas
            </footer>
        </div>
    );
}
