const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function testQuery() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    const location_id = 2, fiscal_year_id = 1, fromDate = '2025-06-30T19:00:00.000Z', toDate = '2026-03-29';
    const table = 'purchases', detailsTable = 'purchase_details', fkCol = 'purchase_id';

    try {
        let sql = `SELECT h.*, d.lot_no, d.sno, d.mfg_date, d.exp_date, d.qty, d.qty_sold, d.rate, d.amount, m.name AS maker_name, c.name AS category_name, pw.power `;
        sql += `, s.name AS supplier_name FROM ${table} h JOIN ${detailsTable} d ON h.id = d.${fkCol} LEFT JOIN suppliers s ON h.supplier_id = s.id `;
        sql += ` JOIN makers m ON d.maker_id = m.id JOIN categories c ON d.category_id = c.id LEFT JOIN powers pw ON d.power_id = pw.id WHERE 1=1 `;
        const params = [];
        if (location_id) { sql += ' AND h.location_id = ?'; params.push(location_id); }
        if (fiscal_year_id) { sql += ' AND h.fiscal_year_id = ?'; params.push(fiscal_year_id); }
        if (fromDate) { sql += ' AND h.trans_date >= ?'; params.push(fromDate); }
        if (toDate) { sql += ' AND h.trans_date <= ?'; params.push(toDate); }

        console.log('Query:', sql);
        const [rows] = await connection.query(sql, params);
        console.log('Success:', rows.length, 'rows');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await connection.end();
    }
}

testQuery();
