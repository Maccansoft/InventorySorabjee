const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await db.query('DESCRIBE transfer_requests');
    console.log("HEADER:", JSON.stringify(rows));
    
    // Check all tables in DB just in case
    const [tables] = await db.query('SHOW TABLES');
    console.log("TABLES:", JSON.stringify(tables));
    
    await db.end();
}
check().catch(console.error);
