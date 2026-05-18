'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, DollarSign, ShoppingBag, TrendingUp, Clock, Package } from 'lucide-react';
import Link from 'next/link';
import { Client } from '@/types/crm';
import { Order } from '@/types/order';
import { getClientMetrics, getClientOrderHistory } from '@/app/actions/crm';
import { RFMBadge } from '@/components/crm/RFMBadge';
import { CRMIcon } from '@/components/icons/CRMIcon';
import { cn } from '@/lib/utils';

export default function ClientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.id as string;

    const [client, setClient] = useState<Client | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [ordersTotal, setOrdersTotal] = useState(0);

    useEffect(() => {
        loadClientData();
    }, [clientId]);

    async function loadClientData() {
        try {
            setLoading(true);
            const [clientData, ordersData] = await Promise.all([
                getClientMetrics(clientId),
                getClientOrderHistory(clientId, 1, 20)
            ]);
            setClient(clientData);
            setOrders(ordersData.orders);
            setOrdersTotal(ordersData.total);
        } catch (error) {
            console.error('Error loading client:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Intl.DateTimeFormat('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-4">Cliente no encontrado</h2>
                    <Link href="/crm" className="text-brand hover:underline">
                        ← Volver al CRM
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b pb-4 pt-4 shadow-sm">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/crm"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <CRMIcon className="w-6 h-6" />
                                {client.full_name}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                Cliente desde {formatDate(client.created_at)}
                            </p>
                        </div>
                        {client.rfm_segment && (
                            <RFMBadge segment={client.rfm_segment} score={client.rfm_score} showScore />
                        )}
                    </div>
                </div>
            </div>

            <div className="container mx-auto max-w-6xl py-6 px-4 space-y-6">
                {/* Client Info & Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Contact Info Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-2 rounded-xl border bg-card p-6 shadow-sm"
                    >
                        <h3 className="text-lg font-bold text-foreground mb-4">Información de Contacto</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {client.phone && (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Teléfono</p>
                                        <p className="text-sm font-medium text-foreground">{client.phone}</p>
                                    </div>
                                </div>
                            )}
                            {client.email && (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="text-sm font-medium text-foreground truncate">{client.email}</p>
                                    </div>
                                </div>
                            )}
                            {client.address && (
                                <div className="flex items-center gap-3 md:col-span-2">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">Dirección</p>
                                        <p className="text-sm font-medium text-foreground">{client.address}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Quick Stats */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-3"
                    >
                        <div className="rounded-xl border bg-green-950/20 border-green-900/30 p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-green-400 text-xs font-semibold uppercase mb-2">
                                <DollarSign className="w-4 h-4" />
                                Valor Total
                            </div>
                            <p className="text-2xl font-bold text-green-400">
                                {formatCurrency(client.lifetime_value || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Promedio: {formatCurrency(client.average_order_value || 0)}
                            </p>
                        </div>

                        <div className="rounded-xl border bg-blue-950/20 border-blue-900/30 p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase mb-2">
                                <ShoppingBag className="w-4 h-4" />
                                Total Pedidos
                            </div>
                            <p className="text-2xl font-bold text-blue-400">{client.total_orders}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Último: {formatDate(client.last_order_date)}
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Orders History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl border bg-card shadow-sm"
                >
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Historial de Pedidos ({ordersTotal})
                        </h3>
                    </div>

                    {orders.length === 0 ? (
                        <div className="p-12 text-center">
                            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Aún no hay pedidos registrados</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-6 py-3">ID</th>
                                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-6 py-3">Fecha</th>
                                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-6 py-3">Estado</th>
                                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase px-6 py-3">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {orders.map((order) => {
                                        let statusColor = "bg-slate-500";
                                        if (order.status === 'TOMADO') statusColor = "bg-blue-600";
                                        if (order.status === 'DESPACHO') statusColor = "bg-orange-500";
                                        if (order.status === 'ENTREGADO') statusColor = "bg-green-600";

                                        return (
                                            <tr key={order.id} className="hover:bg-accent/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-mono font-bold text-foreground bg-muted/50 px-2 py-1 rounded border">
                                                        {order.public_id}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-sm text-foreground">
                                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                        {formatDate(order.created_at)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded-full text-white", statusColor)}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-bold text-green-400">
                                                        {formatCurrency(Number(order.total_value) || 0)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
