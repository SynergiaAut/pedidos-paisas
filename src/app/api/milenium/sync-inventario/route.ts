import { NextRequest, NextResponse } from 'next/server';
import { runInventorySync } from '@/lib/inventory-sync';

/**
 * POST /api/milenium/sync-inventario
 * Body opcional: { "db": "01" | "02" | "all" }  (default: "all")
 * Header requerido: x-sync-secret == process.env.SYNC_SECRET
 *
 * Punto de entrada para cron/manual (cURL). La UI usa la server action
 * triggerInventorySync. Núcleo compartido: src/lib/inventory-sync.ts.
 */

// La consulta al ERP puede tardar 30s+ por base (túnel SSH).
export const maxDuration = 300;

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

    const body = await req.json().catch(() => ({}));
    const summary = await runInventorySync(body?.db ?? 'all');

    return NextResponse.json(summary, {
        status: summary.status === 'error' ? 502 : 200,
    });
}
