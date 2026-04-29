const db = require('../db');

async function migrate() {
    console.log("🚀 Starting Standardized Transaction ID Migration...");

    const tables = [
        { name: 'stock_opening_balances', type: 'OPN', idCol: 'trans_no' },
        { name: 'purchases', type: 'PUR', idCol: 'trans_no' },
        { name: 'purchase_returns', type: 'PRT', idCol: 'trans_no' },
        { name: 'sales', type: 'SI', idCol: 'trans_no' },
        { name: 'sales_returns', type: 'SRT', idCol: 'trans_no' },
        { name: 'transfers', type: 'TRN', idCol: 'trans_no' },
        { name: 'transfer_requests', type: 'TRQ', idCol: 'trans_no' },
        { name: 'vouchers', type: 'VOUCHER', idCol: 'voucher_no' } // Special handling for PV/RV/JV
    ];

    try {
        const conn = await db.getConnection();

        for (const tbl of tables) {
            console.log(`\n📦 Migrating table: ${tbl.name}...`);
            
            // Get all records ordered by date and ID
            const [records] = await conn.query(`SELECT * FROM ${tbl.name} ORDER BY trans_date ASC, id ASC`);
            if (records.length === 0 && tbl.name !== 'vouchers') {
                console.log(`  - No records found in ${tbl.name}. Skipping.`);
                continue;
            }

            // Group by location and fiscal year to reset sequence
            const sequences = {}; // Key: locId_fyId

            for (const r of records || []) {
                const locId = r.location_id || 1;
                const fyId = r.fiscal_year_id || 1;
                const seqKey = `${locId}_${fyId}`;
                
                if (!sequences[seqKey]) sequences[seqKey] = 0;
                sequences[seqKey]++;

                const seq = sequences[seqKey];
                const seqStr = String(seq).padStart(4, '0');

                // Get labels
                const [[fy]] = await conn.query('SELECT label FROM fiscal_years WHERE id = ?', [fyId]);
                const fyLabel = fy ? fy.label : '2025-2026';

                const [[loc]] = await conn.query('SELECT code FROM locations WHERE id = ?', [locId]);
                const locCode = (loc && loc.code && loc.code !== 'XX') ? loc.code.toUpperCase() : 'HO';

                let finalType = tbl.type;
                if (tbl.name === 'vouchers') {
                    finalType = r.voucher_type === 'PAYMENT' ? 'PV' : (r.voucher_type === 'RECEIPT' ? 'RV' : 'JV');
                }

                const newId = `${finalType}/${locCode}/${fyLabel}/${seqStr}`;

                await conn.query(`
                    UPDATE ${tbl.name} SET 
                        ${tbl.idCol} = ?,
                        sequence_no = ?,
                        transaction_type = ?,
                        location_code = ?,
                        fiscal_year_label = ?
                    WHERE id = ?
                `, [newId, seq, finalType, locCode, fyLabel, r.id]);
            }
            console.log(`  - Successfully updated ${records.length} records in ${tbl.name}.`);
        }

        console.log("\n✅ Migration Completed Successfully!");
        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("\n❌ Migration Failed:", err.message);
        process.exit(1);
    }
}

migrate();
