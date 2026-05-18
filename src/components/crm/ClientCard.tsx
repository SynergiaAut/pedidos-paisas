import { Client } from '@/types/crm';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, DollarSign, ShoppingBag, Calendar, TrendingUp } from 'lucide-react';
import { RFMBadge } from './RFMBadge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ClientCardProps {
    client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Nunca';
        return new Intl.DateTimeFormat('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(dateString));
    };

    // Determinar color del borde izquierdo basado en RFM
    let borderColor = "border-gray-600";
    if (client.rfm_segment === 'CHAMPIONS') borderColor = "border-purple-500";
    if (client.rfm_segment === 'LOYAL') borderColor = "border-blue-500";
    if (client.rfm_segment === 'POTENTIAL') borderColor = "border-green-600";
    if (client.rfm_segment === 'AT_RISK') borderColor = "border-orange-500";

    return (
        <Link href={`/crm/${client.id}`}>
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
                className={cn(
                    "group relative rounded-xl border bg-card shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand/50 hover:bg-accent/5 cursor-pointer"
                )}
            >
                {/* Borde izquierdo de color - igual que pedidos */}
                <div className={cn("hidden md:block w-2 h-full absolute left-0 top-0 bottom-0 rounded-l-xl", borderColor.replace('border', 'bg'))} />

                {/* Content */}
                <div className="p-5 pl-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-brand transition-colors">
                                {client.full_name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                    Desde {formatDate(client.created_at)}
                                </span>
                            </div>
                        </div>
                        {client.rfm_segment && (
                            <RFMBadge segment={client.rfm_segment} score={client.rfm_score} />
                        )}
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1.5 mb-4">
                        {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{client.phone}</span>
                            </div>
                        )}
                        {client.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="w-3.5 h-3.5" />
                                <span className="truncate">{client.email}</span>
                            </div>
                        )}
                        {client.address && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{client.address}</span>
                            </div>
                        )}
                    </div>

                    {/* Metrics - Grid 2x2 */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                        <div>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">
                                <ShoppingBag className="w-3 h-3" />
                                Pedidos
                            </div>
                            <p className="text-lg font-bold text-foreground">{client.total_orders}</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-green-500 uppercase mb-0.5">
                                <DollarSign className="w-3 h-3" />
                                LTV (Total)
                            </div>
                            <p className="text-lg font-bold text-green-400">
                                {formatCurrency(client.lifetime_value || 0)}
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 uppercase mb-0.5" title="Valor Promedio de Pedido">
                                <TrendingUp className="w-3 h-3" />
                                Ticket Prom.
                            </div>
                            <p className="text-lg font-bold text-blue-400">
                                {formatCurrency(client.average_order_value || 0)}
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">
                                <Calendar className="w-3 h-3" />
                                Último
                            </div>
                            <p className="text-xs font-medium text-foreground mt-1">
                                {formatDate(client.last_order_date)}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}
