const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function checkAndAddColumns() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    const tables = [
        'purchase_details',
        'sales_details',
        'transfer_details',
        'opening_balances',
        'purchase_return_details',
        'sales_return_details'
    ];

    const columns = [
        { name: 'lot_no', type: 'VARCHAR(100)' },
        { name: 'sno', type: 'VARCHAR(100) DEFAULT "0"' },
        { name: 'exp_date', type: 'DATE' },
        { name: 'mfg_date', type: 'DATE' }
    ];

    for (const table of tables) {
        console.log(`Checking table: ${table}`);
        const [existingColumns] = await connection.query(`DESCRIBE ${table}`);
        const colNames = existingColumns.map(c => c.Field);

        for (const col of columns) {
            if (!colNames.includes(col.name)) {
                console.log(`  Adding column ${col.name} to ${table}`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
            }
        }
    }

    console.log('All tables verified.');
    await connection.end();
}

checkAndAddColumns().catch(console.error);
