import { motion } from 'framer-motion';
import { Star, Heart, Sparkles, AlertTriangle, Moon } from 'lucide-react';

interface RFMBadgeProps {
    segment: string;
    score?: number;
    showScore?: boolean;
}

const segmentConfig: Record<string, { label: string; colorClasses: string; icon: any }> = {
    'CHAMPIONS': {
        label: 'Champions',
        colorClasses: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        icon: Star
    },
    'LOYAL': {
        label: 'Leales',
        colorClasses: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        icon: Heart
    },
    'POTENTIAL': {
        label: 'Potencial',
        colorClasses: 'bg-green-500/10 text-green-400 border-green-500/30',
        icon: Sparkles
    },
    'AT_RISK': {
        label: 'En Riesgo',
        colorClasses: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        icon: AlertTriangle
    },
    'HIBERNATING': {
        label: 'Inactivo',
        colorClasses: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
        icon: Moon
    },
};

export function RFMBadge({ segment, score, showScore = false }: RFMBadgeProps) {
    const config = segmentConfig[segment] || segmentConfig['POTENTIAL'];
    const Icon = config.icon;

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${config.colorClasses}`}
        >
            <Icon className="w-3 h-3" />
            <span>{config.label}</span>
            {showScore && score !== undefined && (
                <span className="ml-1 px-1.5 bg-white/10 rounded text-[9px] font-bold">
                    {score}
                </span>
            )}
        </div>
    );
}
