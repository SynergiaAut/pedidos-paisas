import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, DollarSign, Mail, MapPin, Phone, ShoppingBag, TrendingUp } from "lucide-react";
import { Client } from "@/types/crm";
import { cn } from "@/lib/utils";
import { RFMBadge } from "./RFMBadge";

interface ClientCardProps {
    client: Client;
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(value || 0);
}

function formatDate(dateString?: string) {
    if (!dateString) return "Sin registro";
    return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(dateString));
}

const segmentAccent: Record<string, string> = {
    CHAMPIONS: "bg-violet-400",
    LOYAL: "bg-blue-400",
    POTENTIAL: "bg-emerald-400",
    AT_RISK: "bg-orange-400",
    HIBERNATING: "bg-slate-500",
};

export function ClientCard({ client }: ClientCardProps) {
    const accent = segmentAccent[client.rfm_segment ?? ""] ?? "bg-brand";

    return (
        <Link href={`/crm/${client.id}`}>
            <motion.article
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="group relative overflow-hidden rounded-lg border border-border bg-card transition hover:border-brand/45 hover:bg-muted/15"
            >
                <div className={cn("absolute left-0 top-0 h-full w-1", accent)} />

                <div className="p-4 pl-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-base font-black tracking-tight text-white transition group-hover:text-brand">
                                {client.full_name}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">Desde {formatDate(client.created_at)}</p>
                        </div>
                        {client.rfm_segment && <RFMBadge segment={client.rfm_segment} score={client.rfm_score} />}
                    </div>

                    <div className="mt-4 space-y-2">
                        {client.phone && (
                            <p className="flex items-center gap-2 text-sm text-slate-300">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate">{client.phone}</span>
                            </p>
                        )}
                        {client.email && (
                            <p className="flex items-center gap-2 text-sm text-slate-300">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate">{client.email}</span>
                            </p>
                        )}
                        {client.address && (
                            <p className="flex items-center gap-2 text-sm text-slate-300">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate">{client.address}</span>
                            </p>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                        <div className="rounded-md border border-border bg-background/45 p-3">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground">
                                <ShoppingBag className="h-3 w-3" />
                                Pedidos
                            </p>
                            <p className="mt-1 text-lg font-black text-white">{client.total_orders}</p>
                        </div>
                        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300">
                                <DollarSign className="h-3 w-3" />
                                LTV
                            </p>
                            <p className="mt-1 truncate text-lg font-black text-emerald-300">{formatCurrency(client.lifetime_value)}</p>
                        </div>
                        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase text-blue-300">
                                <TrendingUp className="h-3 w-3" />
                                Ticket
                            </p>
                            <p className="mt-1 truncate text-sm font-black text-blue-200">{formatCurrency(client.average_order_value)}</p>
                        </div>
                        <div className="rounded-md border border-border bg-background/45 p-3">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Ultimo
                            </p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-200">{formatDate(client.last_order_date)}</p>
                        </div>
                    </div>
                </div>
            </motion.article>
        </Link>
    );
}
