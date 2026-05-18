const Firebird = require('node-firebird');

const options = {
    host: '127.0.0.1',
    port: 13054,
    database: 'C:\\Millenium Enterprise\\BD\\GRANESLOSPAISAS2021.FDB',
    user: 'SYSDBA',      // Default Firebird admin user
    password: 'masterkey', // Default Firebird admin password
    lowercase_keys: false, 
    role: null,            
    pageSize: 4096         
};

console.log("Conectando a Firebird (127.0.0.1:13054)...");

Firebird.attach(options, (err, db) => {
    if (err) {
        console.error("Error al conectar:", err.message);
        process.exit(1);
    }
    
    console.log("¡Conexión exitosa! Ejecutando consultas...");

    // Consultamos la tabla TERCERO (1 registro)
    db.query('SELECT FIRST 1 * FROM TERCERO ORDER BY FECHA_CREACION DESC', (err, terceros) => {
        if (err) {
            console.error("Error al consultar TERCERO:", err.message);
        } else {
            console.log("\n=== REGISTRO RECIENTE DE TERCERO (CLIENTE) ===");
            if (terceros.length > 0) {
                 console.log(JSON.stringify(terceros[0], null, 2));
            } else {
                 console.log("No se encontraron registros en TERCERO.");
            }
        }

        // Consultamos la tabla PEDIDO (1 registro)
        db.query('SELECT FIRST 1 * FROM PEDIDO ORDER BY FECHA_CREACION DESC', (err, pedidos) => {
             if (err) {
                 console.error("Error al consultar PEDIDO:", err.message);
             } else {
                 console.log("\n=== REGISTRO RECIENTE DE PEDIDO ===");
                 if (pedidos.length > 0) {
                      console.log(JSON.stringify(pedidos[0], null, 2));
                 } else {
                      console.log("No se encontraron registros en PEDIDO.");
                 }
             }
             db.detach();
             console.log("\nFinalizado.");
             process.exit(0);
        });
    });
});
