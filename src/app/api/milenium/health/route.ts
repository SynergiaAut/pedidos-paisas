import { NextResponse } from 'next/server';
import { healthAll } from '@/lib/flex-crm';

/**
 * GET /api/milenium/health
 * Verifica login contra la API Flex CRM para AMBAS bases (01 GRANES, 02 FISCAL).
 * 200 = ambas OK - 207 = una OK - 503 = ninguna responde.
 */
export async function GET() {
    console.log('[FastOrder/Health] Verificando conexion Flex CRM en ambas bases...');
    const results = await healthAll();

    const okCount = results.filter((r) => r.ok).length;
    const status = okCount === 2 ? 200 : okCount === 1 ? 207 : 503;

    return NextResponse.json(
        {
            status: okCount === 2 ? 'ok' : okCount === 1 ? 'degraded' : 'error',
            service: 'flex-crm',
            databases: results,
        },
        { status }
    );
}
