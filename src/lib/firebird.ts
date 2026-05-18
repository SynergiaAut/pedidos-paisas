import Firebird from 'node-firebird';

// Rutas confirmadas por el usuario para la nueva arquitectura
const DB_CONFIGS = {
    '01': {
        name: 'GRANESLOSPAISAS 2021',
        path: 'C:\\Millenium Enterprise\\BD\\GRANESLOSPAISAS2021.FDB'
    },
    '02': {
        name: 'PAISASFISCAL 2021',
        path: 'C:\\Millenium Enterprise\\BD\\PAISASFISCAL2021.FDB'
    }
};

const baseOptions = {
    host: process.env.FIREBIRD_HOST || '127.0.0.1',
    port: parseInt(process.env.FIREBIRD_PORT || '13054'), // Usando el puerto del túnel activo
    user: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

// ==========================================
// INTERFACES (Mapeadas de la BD Real)
// ==========================================

export interface MileniumItem {
    ID_ITEM: string | number;
    DESCRIPCION: string;
    CODIGO_BARRA: string | null;
    PRECIO_BASE?: number; 
    COSTO: number;
    FLAG_ACTIVO: string;
    DB_SOURCE?: '01' | '02';
}

export interface MileniumTercero {
    ID_TERCERO: string | number;
    NOMBRE: string;
    DIRECCION: string | null;
    TELEFONO: string | null;
    TELEFONO_CELULAR: string | null;
    CLIENTE: string; // 'SI' o 'NO'
    E_MAIL: string | null;
}

export interface DetallePedido {
    ID_ITEM: number | string;
    CANTIDAD: number;
    VALOR_UNITARIO: number;
    VALOR_TOTAL: number;
}

export class FirebirdService {
    
    /**
     * Obtiene una conexión de Firebird para una base de datos específica
     */
    static getConnection(dbKey: '01' | '02' = '01'): Promise<Firebird.Database> {
        return new Promise((resolve, reject) => {
            const options = {
                ...baseOptions,
                database: DB_CONFIGS[dbKey].path
            };
            Firebird.attach(options, (err, db) => {
                if (err) {
                    console.error(`[Firebird] Error conectando a DB ${dbKey}:`, err.message);
                    reject(err);
                }
                else resolve(db);
            });
        });
    }

    /**
     * Obtiene todos los productos (ITEM) activos de una DB específica
     */
    static async getProductosActivos(dbKey: '01' | '02' = '01'): Promise<MileniumItem[]> {
        const db = await this.getConnection(dbKey);
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    i.ID_ITEM, 
                    i.DESCRIPCION, 
                    i.CODIGO_BARRA, 
                    i.COSTO, 
                    i.FLAG_ACTIVO,
                    g.DESCRIPCION as CATEGORIA
                FROM ITEM i
                LEFT JOIN GRUPO_ITEM g ON i.ID_GRUPO_ITEM = g.ID_GRUPO_ITEM
                WHERE i.FLAG_ACTIVO = 'S' OR i.FLAG_ACTIVO = 'SI'
            `;
            db.query(query, [], (err, result) => {
                db.detach();
                if (err) reject(err);
                else {
                    const mapped = (result as unknown as any[]).map(item => ({
                        ...item, 
                        DB_SOURCE: dbKey,
                        CATEGORIA: item.CATEGORIA || 'Sin Categoría'
                    }));
                    resolve(mapped);
                }
            });
        });
    }

    /**
     * Crea un cliente (TERCERO) en la base de datos especificada
     */
    static async crearTercero(
        dbKey: '01' | '02',
        tipoId: string, 
        documento: string, 
        nombre: string, 
        celular: string = '', 
        email: string = ''
    ): Promise<boolean> {
        const db = await this.getConnection(dbKey);
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO TERCERO (
                    ID_TERCERO, 
                    ID_SUCURSAL_TERCERO, 
                    ID_TIPO_IDENTIFICACION, 
                    ID_DEPTO, 
                    ID_CIUDAD, 
                    ID_TIPO_EMPRESA, 
                    NOMBRE, 
                    NOMBRE_COMERCIAL,
                    TELEFONO_CELULAR, 
                    E_MAIL, 
                    CLIENTE, 
                    FECHA_CREACION
                )
                VALUES (?, 1, ?, '', '', '', ?, ?, ?, ?, 'SI', CURRENT_TIMESTAMP)
            `;
            const docNum = parseFloat(documento) || 0;
            db.query(query, [docNum, tipoId, nombre, nombre, celular, email], (err, result) => {
                db.detach();
                if (err) {
                    console.error(`[Firebird] Error al insertar TERCERO en DB ${dbKey}:`, err.message);
                    reject(err);
                } else resolve(true);
            });
        });
    }

    /**
     * Inyecta una Cabecera de Pedido en una DB específica
     */
    static async crearPedidoHeader(
        dbKey: '01' | '02',
        clienteDoc: string, 
        total: number, 
        idEmpresa: string = '01', 
        idSucursal: string = '01'
    ): Promise<number | null> {
        const db = await this.getConnection(dbKey);
        return new Promise((resolve, reject) => {
            db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
                if (err) {
                    db.detach();
                    return reject(err);
                }
                
                const qConsecutivo = `SELECT COALESCE(MAX(NUMERO), 0) + 1 AS NEXT_NUMERO FROM PEDIDO WHERE ID_EMPRESA = ? AND ID_SUCURSAL = ? AND ID_TIPO_DOC = 'PED'`;
                
                transaction.query(qConsecutivo, [idEmpresa, idSucursal], (err, results) => {
                    if (err) {
                        transaction.rollback();
                        db.detach();
                        return reject(err);
                    }
                    
                    const nextNum = (results[0] as any).NEXT_NUMERO;
                    const idTercero = parseFloat(clienteDoc) || 0;
                    
                    const cabeceraQuery = `
                        INSERT INTO PEDIDO (
                            ID_EMPRESA, ID_SUCURSAL, ID_TIPO_DOC, NUMERO, 
                            ID_TERCERO, ID_SUCURSAL_TERCERO, FECHA, 
                            TOTAL, TOTAL_ITEM, ESTADO, USUARIO
                        ) VALUES (?, ?, 'PED', ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, 'PENDIENTE', 'SISTEMA_WEB')
                    `;
                    
                    transaction.query(cabeceraQuery, [idEmpresa, idSucursal, nextNum, idTercero, total, total], (err, _) => {
                        if (err) {
                            transaction.rollback();
                            db.detach();
                            return reject(err);
                        }
                        
                        transaction.commit(err => {
                            db.detach();
                            if (err) reject(err);
                            else resolve(nextNum);
                        });
                    });
                });
            });
        });
    }

    /**
     * Inyecta los detalles de un pedido en la DB correspondiente
     */
    static async crearPedidoDetalle(
        dbKey: '01' | '02',
        numeroPedido: number,
        detalles: DetallePedido[],
        idEmpresa: string = '01',
        idSucursal: string = '01'
    ): Promise<boolean> {
        const db = await this.getConnection(dbKey);
        return new Promise((resolve, reject) => {
            db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
                if (err) {
                    db.detach();
                    return reject(err);
                }

                try {
                    const query = `
                        INSERT INTO PEDIDO_DET (
                            ID_EMPRESA, ID_SUCURSAL, ID_TIPO_DOC, NUMERO,
                            ID_ITEM, SECUENCIA, CANTIDAD, VALOR_UNITARIO, VALOR_TOTAL
                        ) VALUES (?, ?, 'PED', ?, ?, ?, ?, ?, ?)
                    `;

                    for (let i = 0; i < detalles.length; i++) {
                        const d = detalles[i];
                        await new Promise((res, rej) => {
                            transaction.query(query, [
                                idEmpresa, 
                                idSucursal, 
                                numeroPedido, 
                                d.ID_ITEM, 
                                i + 1, 
                                d.CANTIDAD, 
                                d.VALOR_UNITARIO, 
                                d.VALOR_TOTAL
                            ], (err) => {
                                if (err) rej(err);
                                else res(true);
                            });
                        });
                    }

                    transaction.commit(err => {
                        db.detach();
                        if (err) reject(err);
                        else resolve(true);
                    });
                } catch (error) {
                    transaction.rollback();
                    db.detach();
                    reject(error);
                }
            });
        });
    }
}
