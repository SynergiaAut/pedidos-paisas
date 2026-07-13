import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Conteo de Inventario - Pedidos Paisas',
    description: 'Captura móvil de inventario para bodegueros',
};

export default function MobileCountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-brand text-black py-4 px-6 shadow-md flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black tracking-tight uppercase">Granero Los Paisas</h1>
                    <p className="text-[10px] font-semibold opacity-85 uppercase tracking-wider">Módulo Bodega · Conteo Cíclico</p>
                </div>
            </header>
            <main className="flex-1 flex flex-col p-4 max-w-lg w-full mx-auto">
                {children}
            </main>
            <footer className="py-4 text-center text-[10px] text-slate-400 font-medium">
                &copy; {new Date().getFullYear()} Pedidos Paisas · Fast Order
            </footer>
        </div>
    );
}
