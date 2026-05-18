import { NextResponse } from 'next/server';

const BASE_URL = process.env.FLEX_CRM_URL || 'https://me.services.ibla.co';
const CRM_EMAIL = process.env.FLEX_CRM_EMAIL || '';
const CRM_CLAVE = process.env.FLEX_CRM_CLAVE || '';

export async function GET() {
    const startTime = Date.now();
    
    try {
        console.log("[FastOrder/Health] Verificando conexión con Flex CRM (Millenium)...");
        
        // El healthcheck más real es hacer un login y verificar que responde
        const res = await fetch(`${BASE_URL}/crm/empresa/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: CRM_EMAIL, clave: CRM_CLAVE }),
        });

        const data = await res.json();
        const elapsed = Date.now() - startTime;

        if (!res.ok || !data.ok) {
            return NextResponse.json(
                { status: 'error', service: 'flex-crm', message: 'Login fallido', details: data.message },
                { status: 503 }
            );
        }

        // Decodificar expiración del token
        const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
        const expiresAt = new Date(payload.exp * 1000).toISOString();

        console.log(`✅ [FastOrder/Health] Flex CRM OK en ${elapsed}ms`);
        
        return NextResponse.json({
            status: 'ok',
            service: 'flex-crm',
            message: 'Conexión con Millenium Enterprise verificada correctamente',
            latency_ms: elapsed,
            empresa: data.usuario?.razon_social,
            nit: data.usuario?.nit,
            token_expires_at: expiresAt,
        });
        
    } catch (error: any) {
        return NextResponse.json(
            { status: 'error', service: 'flex-crm', message: error.message },
            { status: 503 }
        );
    }
}
