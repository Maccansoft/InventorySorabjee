const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const tables = [
        'purchase_details',
        'purchase_return_details',
        'sales_details',
        'sales_return_details'
    ];

    for (const table of tables) {
        console.log(`Checking ${table}...`);
        const [cols] = await db.query(`DESCRIBE ${table}`);
        const existing = cols.map(c => c.Field);
        
        if (!existing.includes('qty_in_hand')) {
            await db.query(`ALTER TABLE ${table} ADD COLUMN qty_in_hand DECIMAL(15,2) DEFAULT 0 AFTER qty`);
            console.log(`Added qty_in_hand to ${table}`);
        } else {
            console.log(`qty_in_hand already exists in ${table}`);
        }
    }

    console.log("Migration complete.");
    await db.end();
}
migrate().catch(console.error);
