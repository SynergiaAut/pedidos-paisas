import React from 'react';

export const DB_STYLES = {
    '01': {
        name: 'Interna',
        badgeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
        chartColor: '#6366F1'
    },
    '02': {
        name: 'Fiscal',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        chartColor: '#10B981'
    },
    'ALL': {
        name: 'General',
        badgeClass: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
        chartColor: '#94A3B8'
    }
};

interface DbBadgeProps {
    db: '01' | '02' | string;
    className?: string;
}

export function DbBadge({ db, className = '' }: DbBadgeProps) {
    const cleanDb = db === '01' || db === '02' ? db : '01';
    const style = DB_STYLES[cleanDb];

    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider inline-flex items-center justify-center ${style.badgeClass} ${className}`}>
            {style.name}
        </span>
    );
}
