const Firebird = require('node-firebird');

const options = {
    host: process.env.FIREBIRD_HOST || 'host.docker.internal',
    port: parseInt(process.env.FIREBIRD_PORT || '3050'),
    database: process.env.FIREBIRD_DATABASE || 'C:\\Millenium Enterprise\\BD\\GRANESLOSPAISAS2021.FDB',
    user: process.env.FIREBIRD_USER || 'SYSDBA',     
    password: process.env.FIREBIRD_PASSWORD || 'masterkey', 
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

console.log("Iniciando escaneo de columnas vitales en Milenium...");

Firebird.attach(options, (err, db) => {
    if (err) {
        console.error("❌ Error de conexión:", err.message);
        process.exit(1);
    }

    const queries = [
        { name: 'ITEM', sql: 'SELECT FIRST 1 * FROM ITEM' },
        { name: 'INVENTARIO', sql: 'SELECT FIRST 1 * FROM INVENTARIO' },
        { name: 'TERCERO', sql: 'SELECT FIRST 1 * FROM TERCERO' },
        { name: 'PRECIO_ITEM', sql: 'SELECT FIRST 1 * FROM PRECIO_ITEM' },
        { name: 'PEDIDO', sql: 'SELECT FIRST 1 * FROM PEDIDO' },
        { name: 'PEDIDO_DET', sql: 'SELECT FIRST 1 * FROM PEDIDO_DET' }
    ];

    let currentIndex = 0;

    function executeNextQuery() {
        if (currentIndex >= queries.length) {
            db.detach();
            console.log("\n🚀 Análisis completado.");
            process.exit(0);
        }

        const q = queries[currentIndex];
        db.query(q.sql, [], (err, result) => {
            if (err) {
                console.error(`\n❌ Error al consultar la tabla ${q.name}:`, err.message);
            } else if (result && result.length > 0) {
                console.log(`\n✅ Columnas de la tabla [${q.name}]:`);
                console.log(Object.keys(result[0]).join(', '));
            } else {
                console.log(`\n⚠️ La tabla [${q.name}] está vacía. No se pueden deducir las columnas.`);
            }

            currentIndex++;
            executeNextQuery();
        });
    }

    executeNextQuery();
});
