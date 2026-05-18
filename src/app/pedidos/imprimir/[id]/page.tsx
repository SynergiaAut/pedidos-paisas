'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Order } from '@/types/order';

export default function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchOrder = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    clients (
                        full_name,
                        phone,
                        address
                    ),
                    delivery_drivers (
                        full_name
                    )
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error("Error fetching order:", error);
            } else {
                setOrder(data);
            }
            setLoading(false);
        };

        fetchOrder();
    }, [id]);

    useEffect(() => {
        if (!loading && order) {
            // Auto-print after a short delay to ensure rendering
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, order]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-black" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-white gap-4">
                <p className="text-black font-mono">Pedido no encontrado</p>
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded font-mono text-sm"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver
                </button>
            </div>
        );
    }

    // Helper for formatting currency
    const formatMoney = (val: number) => `$${Number(val).toLocaleString()}`;

    return (
        <div className="min-h-screen bg-neutral-100 p-4 print:p-0 print:bg-white flex justify-center">

            {/* Screen Controls (Hidden when printing) */}
            <div className="fixed top-4 left-4 print:hidden flex gap-2">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 shadow-sm rounded text-sm hover:bg-gray-50 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-3 py-2 bg-black text-white shadow-sm rounded text-sm hover:bg-neutral-800 transition-colors"
                >
                    <Printer className="w-4 h-4" /> Imprimir
                </button>
            </div>

            {/* Ticket Container - Max 80mm width approx */}
            <div className="w-[80mm] bg-white text-black font-mono text-[12px] leading-tight print:w-full print:absolute print:top-0 print:left-0">
                <div className="p-2">

                    {/* Header */}
                    <div className="text-center mb-3">
                        <h1 className="text-lg font-bold uppercase mb-1">Granero Los Paisas</h1>
                        <p className="text-[10px]">NIT: 123.456.789-0</p>
                        <p className="text-[10px]">Calle Principal #10-20</p>
                        <p className="text-[10px] mt-1">{new Date(order.created_at).toLocaleString()}</p>
                    </div>

                    <div className="border-b border-dashed border-black my-2"></div>

                    {/* Order Info */}
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span className="font-bold">ORDEN:</span>
                            <span className="font-bold text-sm">{order.public_id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Estado:</span>
                            <span>{order.status}</span>
                        </div>
                        {order.delivery_type && (
                            <div className="flex justify-between">
                                <span>Tipo:</span>
                                <span>{order.delivery_type}</span>
                            </div>
                        )}
                        {order.delivery_drivers && (
                            <div className="flex justify-between">
                                <span>Domiciliario:</span>
                                <span>{order.delivery_drivers.full_name.split(' ')[0]}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-b border-dashed border-black my-2"></div>

                    {/* Client Info */}
                    <div className="space-y-1 mb-2">
                        <p><span className="font-bold">Cliente:</span> {order.client_name}</p>
                        {order.clients?.phone && <p><span>Tel:</span> {order.clients.phone}</p>}

                        {/* Address Logic: Prefer Delivery Address in Obs, fallback to Client Address */}
                        {(order.delivery_type === 'DOMICILIO') && (
                            <p>
                                <span className="font-bold">Dirección:</span><br />
                                <span className="uppercase">
                                    {order.observations?.includes('[ENTREGA EN:')
                                        ? order.observations.match(/\[ENTREGA EN: (.*?)\]/)?.[1]
                                        : order.clients?.address || 'N/A'}
                                </span>
                            </p>
                        )}
                    </div>

                    <div className="border-b border-dashed border-black my-2"></div>

                    {/* Products */}
                    <div className="mb-2">
                        <div className="flex font-bold border-b border-black pb-1 mb-1">
                            <span className="w-8">Cant</span>
                            <span className="flex-1">Producto</span>
                            <span className="w-16 text-right">Total</span>
                        </div>
                        {order.products && Array.isArray(order.products) && order.products.length > 0 ? (
                            <div className="space-y-1">
                                {order.products.map((p: any, i: number) => (
                                    <div key={i} className="flex">
                                        <span className="w-8">{p.qty}</span>
                                        <div className="flex-1">
                                            <span>{p.name}</span>
                                            {/* Show unit price if needed, simplified for ticket */}
                                        </div>
                                        <span className="w-16 text-right">{formatMoney(p.price * p.qty)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center italic text-xs">Sin detalle de productos</p>
                        )}
                    </div>

                    <div className="border-b border-dashed border-black my-2"></div>

                    {/* Totals */}
                    <div className="flex justify-between items-center text-lg font-bold mt-2">
                        <span>TOTAL</span>
                        <span>{formatMoney(order.total_value)}</span>
                    </div>

                    {/* Observations (if not address) */}
                    {order.observations && !order.observations.startsWith('[ENTREGA EN:') && (
                        <div className="mt-3 text-[10px] italic border p-1 rounded border-black/20">
                            Nota: {order.observations}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center mt-6 mb-8 text-[10px]">
                        <p>¡Gracias por su compra!</p>
                        <p className="mt-1">Sistema desarrollado por<br />AntiGravity</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; }
                }
            `}</style>
        </div>
    );
}
