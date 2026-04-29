const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    const tables = [
        'purchase_details',
        'purchase_return_details',
        'transfer_details',
        'transfer_request_details',
        'sales_details',
        'sales_return_details',
        'stock_opening_details'
    ];

    try {
        for (const table of tables) {
            console.log(`Checking table: ${table}`);
            const [cols] = await connection.query(`DESCRIBE ${table}`);
            const colNames = cols.map(c => c.Field);

            if (!colNames.includes('lot_no')) {
                console.log(`Adding lot_no to ${table}`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN lot_no VARCHAR(100)`);
            }
            if (!colNames.includes('sno')) {
                console.log(`Adding sno to ${table}`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN sno VARCHAR(100) DEFAULT '0'`);
            }
            if (!colNames.includes('exp_date')) {
                console.log(`Adding exp_date to ${table}`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN exp_date DATE`);
            }
            if (!colNames.includes('mfg_date')) {
                console.log(`Adding mfg_date to ${table}`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN mfg_date DATE`);
            }

            // Add power_id if missing (essential for stock tracking)
            if (!colNames.includes('power_id')) {
                console.log(`Adding power_id to ${table}`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN power_id INT NULL`);
            }
        }
        console.log("Migration complete!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    } finally {
        await connection.end();
    }
}

migrate();
