import { NextRequest, NextResponse } from 'next/server';
import { getFlexCrm, getAllProductsUnified, DbSource } from '@/lib/flex-crm';

/**
 * GET /api/milenium/productos?db=all|01|02   (default: all)
 * Productos del ERP etiquetados con db_source.
 * Con db=all es tolerante a fallos parciales: si una base falla,
 * retorna la otra + el detalle en `errors`.
 */
export async function GET(req: NextRequest) {
    const db = req.nextUrl.searchParams.get('db') ?? 'all';

    try {
        if (db === '01' || db === '02') {
            console.log(`[FastOrder] Productos Flex CRM, base ${db}...`);
            const products = await getFlexCrm(db as DbSource).getAllProducts();
            return NextResponse.json({
                status: 'success',
                count: products.length,
                data: products.map((p) => ({ ...p, db_source: db })),
            });
        }

        console.log('[FastOrder] Productos Flex CRM, ambas bases...');
        const { products, errors } = await getAllProductsUnified();
        return NextResponse.json(
            {
                status: errors.length === 0 ? 'success' : products.length > 0 ? 'partial' : 'error',
                count: products.length,
                counts_by_db: {
                    '01': products.filter((p) => p.db_source === '01').length,
                    '02': products.filter((p) => p.db_source === '02').length,
                },
                errors,
                data: products,
            },
            { status: products.length > 0 ? 200 : 502 }
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error al obtener productos de Flex CRM:', message);
        return NextResponse.json(
            { status: 'error', message: 'Error consultando ERP', details: message },
            { status: 500 }
        );
    }
}
