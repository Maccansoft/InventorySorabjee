const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log("Migrating transfer_details...");
    const [cols] = await db.query('DESCRIBE transfer_details');
    const fields = cols.map(c => c.Field);

    if (!fields.includes('barcode')) {
        await db.query('ALTER TABLE transfer_details ADD COLUMN barcode VARCHAR(100) AFTER power_id');
        console.log("Added barcode column.");
    }

    // Add indexes for fast lookup
    try {
        await db.query('CREATE INDEX idx_transfer_barcode ON transfer_details(barcode)');
        console.log("Added barcode index.");
    } catch (e) { console.log("Barcode index likely already exists."); }

    try {
        await db.query('CREATE INDEX idx_transfer_lot_no ON transfer_details(lot_no)');
        console.log("Added lot_no index.");
    } catch (e) { console.log("LotNo index likely already exists."); }

    console.log("Migration complete.");
    await db.end();
}
migrate().catch(console.error);
