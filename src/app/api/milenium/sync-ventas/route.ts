import { NextRequest, NextResponse } from 'next/server';
import { runSalesSync } from '@/lib/sales-sync';

export const maxDuration = 300; // Permitir hasta 5 minutos (túnel SSH)

/**
 * POST /api/milenium/sync-ventas
 * Body opcional: { "db": "01" | "02" | "all", "fi": "YYYY-MM-DD", "ff": "YYYY-MM-DD" }
 * Header requerido: x-sync-secret == process.env.SYNC_SECRET
 *
 * Punto de entrada para sincronización incremental e histórica de ventas.
 */
export async function POST(req: NextRequest) {
    const secret = process.env.SYNC_SECRET;
    if (!secret) {
        return NextResponse.json(
            { status: 'error', message: 'SYNC_SECRET no configurado en el servidor' },
            { status: 500 }
        );
    }
    
    if (req.headers.get('x-sync-secret') !== secret) {
        return NextResponse.json({ status: 'error', message: 'No autorizado' }, { status: 401 });
    }
    
    try {
        const body = await req.json().catch(() => ({}));
        
        let startDate: Date | undefined;
        let endDate: Date | undefined;
        
        if (body.fi) {
            startDate = new Date(`${body.fi}T00:00:00`);
            if (isNaN(startDate.getTime())) {
                return NextResponse.json({ status: 'error', message: 'Fecha inicial (fi) inválida' }, { status: 400 });
            }
        }
        
        if (body.ff) {
            endDate = new Date(`${body.ff}T23:59:59`);
            if (isNaN(endDate.getTime())) {
                return NextResponse.json({ status: 'error', message: 'Fecha final (ff) inválida' }, { status: 400 });
            }
        }
        
        const summary = await runSalesSync(body.db ?? 'all', startDate, endDate);
        
        return NextResponse.json(summary, {
            status: summary.status === 'error' ? 502 : 200
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ status: 'error', message }, { status: 500 });
    }
}
