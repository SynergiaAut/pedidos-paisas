import { FirebirdService } from '../lib/firebird';
// En un sistema real, importaríamos cliente de Supabase aquí para replicar inventario
// import { supabase } from '../lib/supabase';

/**
 * Milenium Polling Worker
 * Encargado de monitorizar la BD física local buscando facturas recién impresas
 * de forma no intrusiva usando Alta Frecuencia de Polling (1.5s).
 */
export class MileniumPollingWorker {
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private pollIntervalMs: number = 1500; // 1.5 Segundos
    private lastCheckedTimestamp: Date;

    constructor() {
        // Asumimos que arrancamos monitorizando desde el preciso instante en que el worker sube.
        this.lastCheckedTimestamp = new Date();
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[Worker] Milenium Polling Iniciado. Intervalo:', this.pollIntervalMs, 'ms');
        
        this.intervalId = setInterval(() => this.pollLoop(), this.pollIntervalMs);
    }

    public stop() {
        this.isRunning = false;
        if (this.intervalId) clearInterval(this.intervalId);
        console.log('[Worker] Milenium Polling Detenido.');
    }

    private async pollLoop() {
        try {
            const db = await FirebirdService.getConnection();
            
            // Consultamos facturas nuevas creadas después de nuestra últimaTimestamp.
            // Para prevenir desface horario, a futuro se puede guardar Last_ID.
            // Aqui usamos la notación Firebird.
            const query = `
                SELECT ID_FACTURA, TIPO_DOC, NUMERO, FECHA_CREACION, CLIENTE, TOTAL
                FROM FACTURA 
                WHERE FECHA_CREACION > ?
                ORDER BY FECHA_CREACION ASC
            `;
            
            db.query(query, [this.lastCheckedTimestamp], (err, nuevasFacturas) => {
                db.detach();
                if (err) {
                    console.error('[Worker] Error consultando facturas en BD:', err.message);
                    return;
                }

                if (nuevasFacturas && nuevasFacturas.length > 0) {
                    // Actualizar nuestro timestamp para no repetir facturas
                    const lastInvoice = nuevasFacturas[nuevasFacturas.length - 1] as any;
                    if (lastInvoice.FECHA_CREACION) {
                        this.lastCheckedTimestamp = new Date(lastInvoice.FECHA_CREACION);
                    }

                    console.log(`[Worker] ¡Alerta! Detectadas ${nuevasFacturas.length} nuevas facturas locales.`);
                    this.procesarFacturasDetectadas(nuevasFacturas);
                }
            });
        } catch (error: any) {
            console.error('[Worker] Fallo de conexión Polling:', error.message);
        }
    }

    /**
     * Procesa cada factura y viaja a recuperar su detalle para descontar.
     */
    private async procesarFacturasDetectadas(facturasLocales: any[]) {
        for (const factura of facturasLocales) {
            console.log(`\tProcesando Factura ${factura.TIPO_DOC}-${factura.NUMERO} del cliente ${factura.CLIENTE}...`);
            // Acá en el futuro dispararemos una consulta a FACTURA_DET y luego
            // se restará de Supabase (syncInventario()).
        }
    }
}

// Permitir arranque standalone si se ejecuta directo vía ts-node
if (require.main === module) {
    const worker = new MileniumPollingWorker();
    worker.start();
    
    // Capturar Crtl+C
    process.on('SIGINT', () => {
        worker.stop();
        process.exit();
    });
}
