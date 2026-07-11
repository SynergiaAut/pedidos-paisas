import { NextRequest, NextResponse } from 'next/server';
import { getFlexCrm, DbSource } from '@/lib/flex-crm';

/**
 * GET /api/milenium/clientes?db=01|02   (default: 01 - los clientes viven en GRANES)
 */
export async function GET(req: NextRequest) {
    const dbParam = req.nextUrl.searchParams.get('db') ?? '01';
    const db: DbSource = dbParam === '02' ? '02' : '01';

    try {
        console.log(`[FastOrder] Clientes Flex CRM, base ${db}...`);
        const customers = await getFlexCrm(db).getAllCustomers();

        return NextResponse.json({
            status: 'success',
            db_source: db,
            count: customers.length,
            data: customers,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error al obtener clientes de Flex CRM:', message);
        return NextResponse.json(
            { status: 'error', message: 'Error consultando ERP', details: message },
            { status: 500 }
        );
    }
}
