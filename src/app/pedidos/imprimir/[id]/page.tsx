'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Order } from '@/types/order';
import { DbBadge } from '@/components/ui/DbBadge';

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
                        <h1 className="text-sm font-bold uppercase mb-0.5">{process.env.NEXT_PUBLIC_EMPRESA_NOMBRE || 'DEPOSITO DE GRANOS Y LICORES LOS PAISAS SAS'}</h1>
                        <p className="text-[10px]">NIT: {process.env.NEXT_PUBLIC_EMPRESA_NIT || '901.107.512-4'}</p>
                        <p className="text-[10px]">{process.env.NEXT_PUBLIC_EMPRESA_DIRECCION || 'Palmira, Valle del Cauca'}</p>
                        <p className="text-[10px] mt-1">{new Date(order.created_at).toLocaleString()}</p>
                    </div>

                    <div className="border-b border-dashed border-black my-2"></div>

                    {/* Order Info */}
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between items-center">
                            <span className="font-bold">ORDEN:</span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm">{order.public_id}</span>
                                {(order as any).db_source && <DbBadge db={(order as any).db_source} />}
                            </div>
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
                        {order.invoices_data && Array.isArray(order.invoices_data) && order.invoices_data.length > 0 && (
                            <div className="border-t border-dashed border-black/35 pt-1 mt-1 space-y-0.5 text-[10px]">
                                <span className="font-bold">Facturas Relacionadas:</span>
                                {order.invoices_data.map((inv: { code: string; value: string }, idx: number) => (
                                    <div key={idx} className="flex justify-between font-mono">
                                        <span>{inv.code}</span>
                                        <span>{formatMoney(Number(inv.value))}</span>
                                    </div>
                                ))}
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

                        {/* Observaciones del vendedor (se elimina el prefijo [ENTREGA EN: ...]) */}
                        {(() => {
                            const obs = order.observations?.replace(/\[ENTREGA EN: .*?\]\s*/, '').trim();
                            return obs ? (
                                <p><span className="font-bold">Observaciones:</span> {obs}</p>
                            ) : null;
                        })()}
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
                                {order.products.map((p: { qty: number; name: string; price: number; total?: number; type?: string }, i: number) => (
                                    <div key={i} className="flex">
                                        <span className="w-8">{p.qty}</span>
                                        <div className="flex-1">
                                            <span>{p.name}</span>
                                            {p.type && (
                                                <DbBadge db={p.type} className="ml-1 text-[8px] px-1 py-0" />
                                            )}
                                        </div>
                                        <span className="w-16 text-right">{formatMoney(p.total ?? (p.price * p.qty))}</span>
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

                    {/* Observations (clean free-text observations, both DOMICILIO and TIENDA) */}
                    {(() => {
                        const cleanObs = (order.observations || '').replace(/\[ENTREGA EN:.*?\]/g, '').trim();
                        if (!cleanObs) return null;
                        return (
                            <div className="mt-3 text-[10px] italic border p-1.5 rounded border-black/20 font-mono">
                                <span className="font-bold">Observaciones:</span><br />
                                {cleanObs}
                            </div>
                        );
                    })()}

                    {/* Footer */}
                    <div className="text-center mt-6 mb-8 text-[10px]">
                        <p>¡Gracias por su compra!</p>
                        <p className="mt-1">Sistema desarrollado por<br />Synerg-IA Automation</p>
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
