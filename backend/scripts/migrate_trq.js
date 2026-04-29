const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log("Migrating transfer_request_details...");
    
    // First, check if columns exist before dropping to avoid errors
    const [cols] = await db.query('DESCRIBE transfer_request_details');
    const existingFields = cols.map(c => c.Field);

    const toDrop = ['barcode_scan', 'lot_no', 'sno', 'mfg_date', 'exp_date', 'rate', 'amount'];
    const fieldsToDrop = toDrop.filter(f => existingFields.includes(f));

    if (fieldsToDrop.length > 0) {
        const dropSql = `ALTER TABLE transfer_request_details ${fieldsToDrop.map(f => `DROP COLUMN ${f}`).join(', ')}`;
        await db.query(dropSql);
        console.log(`Dropped: ${fieldsToDrop.join(', ')}`);
    }

    if (!existingFields.includes('qty_in_hand')) {
        await db.query('ALTER TABLE transfer_request_details ADD COLUMN qty_in_hand DECIMAL(15,2) DEFAULT 0 AFTER qty');
        console.log('Added qty_in_hand');
    }

    console.log("Migration complete.");
    await db.end();
}
migrate().catch(console.error);
