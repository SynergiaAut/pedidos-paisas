const Firebird = require('node-firebird');
const path = require('path');

// Configuration for Firebird (Running on Windows Host)
// Important: host.docker.internal allows the container to talk to the Host's Firebird Service
const options = {
    host: 'host.docker.internal',
    port: 3050,
    database: 'C:\\Apps\\pedidos-paisas\\BK Paisas\\copia\\GRANESLOSPAISAS2021.FDB',
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

console.log('---------------------------------------------------');
console.log(' Attempting connection to Host Firebird Service');
console.log(' Host:', options.host);
console.log(' Port:', options.port);
console.log(' Database Path (On Host):', options.database);
console.log('---------------------------------------------------');

Firebird.attach(options, function (err, db) {
    if (err) {
        console.error('Connection Error:', err);
        return;
    }

    console.log('Connected to Database!');

    // Query to list all user tables
    const sql = `
        SELECT RDB$RELATION_NAME 
        FROM RDB$RELATIONS 
        WHERE RDB$SYSTEM_FLAG = 0 
        AND RDB$VIEW_BLR IS NULL
        ORDER BY RDB$RELATION_NAME
    `;

    db.query(sql, function (err, result) {
        if (err) {
            console.error('Query Error:', err);
            db.detach();
            return;
        }

        console.log('Tables found:', result.length);
        result.forEach(row => {
            console.log('-', row.RDB$RELATION_NAME.trim());
        });

        // If 'CLIENTES' or 'TERCEROS' exists, try to get columns
        const clientTable = result.find(r =>
            r.RDB$RELATION_NAME.trim() === 'CLIENTES' ||
            r.RDB$RELATION_NAME.trim() === 'TERCEROS' ||
            r.RDB$RELATION_NAME.trim() === 'MAESTRO_CLIENTES'
        );

        if (clientTable) {
            const tableName = clientTable.RDB$RELATION_NAME.trim();
            console.log(`\nAnalyzing table: ${tableName}...`);

            // Query to get columns for the client table
            const colSql = `
                SELECT RDB$FIELD_NAME, RDB$FIELD_SOURCE
                FROM RDB$RELATION_FIELDS
                WHERE RDB$RELATION_NAME = '${tableName}'
                ORDER BY RDB$FIELD_POSITION
            `;

            db.query(colSql, function (err, cols) {
                if (err) console.error('Error fetching columns:', err);
                else {
                    console.log('Columns:');
                    cols.forEach(c => console.log('  ', c.RDB$FIELD_NAME.trim()));
                }
                db.detach();
            });
        } else {
            console.log('\nNo obvious "CLIENTES" table found to analyze automatically.');
            db.detach();
        }
    });
});
