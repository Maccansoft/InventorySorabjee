const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncInventoryToLedger } = require('../utils/inventorySync');

// ─────────────────────────────────────────────
// CONFIGURATIONS
// ─────────────────────────────────────────────

const txConfigs = [
    { type: 'PURCHASE', path: 'purchases', table: 'purchases', detailsTable: 'purchase_details', fkCol: 'purchase_id', prefix: 'PUR', ledgerSync: true },
    { type: 'PURCHASE_RETURN', path: 'purchase-returns', table: 'purchase_returns', detailsTable: 'purchase_return_details', fkCol: 'purchase_return_id', prefix: 'PRT', ledgerSync: true },
    { type: 'SALES_INVOICE', path: 'sales', table: 'sales', detailsTable: 'sales_details', fkCol: 'sale_id', prefix: 'SLE', ledgerSync: true },
    { type: 'SALES_RETURN', path: 'sales-returns', table: 'sales_returns', detailsTable: 'sales_return_details', fkCol: 'sales_return_id', prefix: 'SRT', ledgerSync: true },
    { type: 'TRANSFER', path: 'transfers', table: 'transfers', detailsTable: 'transfer_details', fkCol: 'transfer_id', prefix: 'TRN', ledgerSync: false },
    { type: 'TRANSFER_REQUEST', path: 'transfer-requests', table: 'transfer_requests', detailsTable: 'transfer_request_details', fkCol: 'request_id', prefix: 'TRQ', ledgerSync: false },
    { type: 'STOCK_OPENING', path: 'opening-balances', table: 'stock_opening_balances', prefix: 'OB', ledgerSync: false, manual: true },
];

// ─────────────────────────────────────────────
// BARCODE LOOKUP SYSTEM (EXCLUSIVE SETUP MAPPING)
// ─────────────────────────────────────────────


// ── GET /api/inventory/next-no ─────────────────────
router.get('/next-no', async (req, res) => {
    try {
        const { type, location_id, fiscal_year_id } = req.query;
        if (!type || !location_id || !fiscal_year_id) {
            return res.status(400).json({ error: 'Type, Location, and Fiscal Year are required' });
        }

        const config = txConfigs.find(c => c.type === type);
        if (!config) return res.status(400).json({ error: 'Invalid transaction type' });

        const conn = await db.getConnection();
        const txIdData = await genTransNo(conn, config.table, config.prefix, location_id, fiscal_year_id);
        conn.release();

        res.json({ trans_no: txIdData.trans_no });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function genTransNo(conn, table, prefix, location_id, fiscal_year_id) {
    const [[fy]] = await conn.query('SELECT label FROM fiscal_years WHERE id = ?', [fiscal_year_id]);
    const fyLabel = fy ? fy.label : new Date().getFullYear();

    const [[loc]] = await conn.query('SELECT code FROM locations WHERE id = ?', [location_id]);
    const locCode = (loc && loc.code && loc.code !== 'XX') ? loc.code.toUpperCase() : 'HO';

    const [[{ maxSeq }]] = await conn.query(
        `SELECT MAX(sequence_no) AS maxSeq FROM ${table} WHERE location_id = ? AND fiscal_year_id = ?`,
        [location_id, fiscal_year_id]
    );
    const nextSeq = (maxSeq || 0) + 1;
    const nextNumStr = String(nextSeq).padStart(4, '0');
    
    // Return both the ID and the raw sequence pieces for insertion
    return {
        trans_no: `${prefix}/${locCode}/${fyLabel}/${nextNumStr}`,
        sequence_no: nextSeq,
        location_code: locCode,
        fiscal_year_label: fyLabel,
        transaction_type: prefix
    };
}

async function insertDetails(conn, table, fkCol, fkVal, details) {
    if (!details || details.length === 0) return;

    if (table === 'transfer_request_details') {
        const sql = `INSERT INTO ${table} 
            (${fkCol}, maker_id, category_id, power_id, stock_received, qty) 
            VALUES ?`;
        const values = details.map(d => [
            fkVal, d.maker_id, d.category_id, d.power_id || null,
            d.stock_received || 0, d.qty || 0
        ]);
        return await conn.query(sql, [values]);
    }

    if (table === 'transfer_details') {
        const sql = `INSERT INTO ${table} 
            (${fkCol}, maker_id, category_id, power_id, stock_required, stock_req, barcode, lot_no, sno, mfg_date, exp_date, qty, qty_in_hand, rate, amount) 
            VALUES ?`;
        const values = details.map(d => [
            fkVal, d.maker_id, d.category_id, d.power_id || null,
            d.stock_required || 0, d.reqTransNo || null, d.barcode || null, d.lot_no || null, d.sno || null, d.mfg_date || null, d.exp_date || null,
            d.qty || 0, d.qty_in_hand || 0, d.rate || 0, d.amount || 0
        ]);
        return await conn.query(sql, [values]);
    }

    const sql = `INSERT INTO ${table} 
        (${fkCol}, maker_id, category_id, power_id, lot_no, sno, mfg_date, exp_date, qty, qty_in_hand, rate, p_rate, amount) 
        VALUES ?`;

    const values = details.map(d => [
        fkVal, d.maker_id, d.category_id, d.power_id || null,
        d.lot_no || null, d.sno || null, d.mfg_date || null, d.exp_date || null,
        d.qty || 0, d.qty_in_hand || 0, d.rate || 0, d.p_rate || '', d.amount || 0
    ]);

    await conn.query(sql, [values]);
}

// ─────────────────────────────────────────────
// BARCODE & LOOKUPS
// ─────────────────────────────────────────────

router.get('/barcodes', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM barcode_master ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/barcodes', async (req, res) => {
    try {
        const { barcode, lot_no, sno, exp_date, mfg_date } = req.body;
        if (!barcode || (!lot_no && !sno)) return res.status(400).json({ error: 'barcode and (lot_no or sno) are required' });
        await db.query('INSERT INTO barcode_master (barcode, lot_no, sno, exp_date, mfg_date) VALUES (?, ?, ?, ?, ?)', [barcode.trim(), lot_no ? lot_no.trim() : null, sno ? sno.trim() : null, exp_date || null, mfg_date || null]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Barcode already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.get('/barcode-setup', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, m.name as maker_name 
            FROM barcode_format_setup s
            JOIN makers m ON s.maker_id = m.id
            ORDER BY s.created_at DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/lookup-lot/:lot_no', async (req, res) => {
    try {
        const { lot_no } = req.params;
        const { sno, type } = req.query;
        
        const [rows] = await db.query(`
            SELECT maker_id, category_id, power_id, qty, rate, p_rate, exp_date, mfg_date FROM (
                -- 1. Sales Details (Highest priority if SNo matches and it's a return)
                SELECT d.maker_id, d.category_id, d.power_id, d.qty, d.rate, d.p_rate, d.exp_date, d.mfg_date, h.trans_date, h.id, 1 as priority
                FROM sales_details d 
                JOIN sales h ON d.sale_id = h.id 
                WHERE d.lot_no = ? ${sno ? 'AND d.sno = ?' : ''}
                
                UNION ALL
                
                -- 2. Purchase Details
                SELECT d.maker_id, d.category_id, d.power_id, d.qty, d.rate, d.p_rate, d.exp_date, d.mfg_date, h.trans_date, h.id, 2 as priority
                FROM purchase_details d 
                JOIN purchases h ON d.purchase_id = h.id 
                WHERE d.lot_no = ?
                
                UNION ALL
                
                -- 3. Opening Balance
                SELECT maker_id, category_id, power_id, qty, rate, '' as p_rate, exp_date, mfg_date, '1900-01-01' as trans_date, id, 3 as priority
                FROM stock_opening_balances 
                WHERE lot_no = ?
            ) as t
            ORDER BY priority ASC, trans_date DESC, id DESC 
            LIMIT 1
        `, sno ? [lot_no, sno, lot_no, lot_no] : [lot_no, lot_no, lot_no]);
        
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Lot not found' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/barcode-setup', async (req, res) => {
    try {
        const { format_type, maker_id, sample_barcode, lot_no, sno, exp_date, mfg_years_less, is_active } = req.body;
        if (!maker_id || !sample_barcode) return res.status(400).json({ error: 'Maker and Sample Barcode are required' });
        
        await db.query(`
            INSERT INTO barcode_format_setup 
            (format_type, maker_id, sample_barcode, lot_no, sno, exp_date, mfg_years_less, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            (format_type || '').trim(),
            maker_id,
            (sample_barcode || '').trim(),
            (lot_no || '').trim(),
            (sno || '').trim(),
            exp_date || null,
            mfg_years_less || 3,
            is_active === undefined ? 1 : is_active
        ]);
        res.json({ success: true });
    } catch (err) {
        console.error("[BarcodeSetup] Save Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/barcode-setup/:id', async (req, res) => {
    try {
        const { format_type, maker_id, sample_barcode, lot_no, sno, exp_date, mfg_years_less, is_active } = req.body;
        await db.query(`
            UPDATE barcode_format_setup 
            SET format_type=?, maker_id=?, sample_barcode=?, lot_no=?, sno=?, exp_date=?, mfg_years_less=?, is_active=?
            WHERE id=?
        `, [
            (format_type || '').trim(), maker_id, (sample_barcode || '').trim(), (lot_no || '').trim(), (sno || '').trim(),
            exp_date || null, mfg_years_less || 3, is_active, req.params.id
        ]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/barcode-setup/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM barcode_format_setup WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/barcode-lookup', async (req, res) => {
    try {
        const { barcode, maker } = req.query;
        if (!barcode) return res.json({ found: false });
        const trimmed = barcode.trim();
        const cleanVal = trimmed.replace(/[^a-zA-Z0-9]/g, '');
        
        console.log(`[BarcodeLookup] Scanning: "${trimmed}" | Maker Filter: "${maker || 'ALL'}"`);

        // Get all active setups for this maker (match by Name or ID)
        let sql = `
            SELECT s.*, m.name as maker_name 
            FROM barcode_format_setup s
            JOIN makers m ON s.maker_id = m.id
            WHERE s.is_active = 1
        `;
        const params = [];
        if (maker) { 
            sql += " AND (TRIM(UPPER(m.name)) = TRIM(UPPER(?)) OR s.maker_id = ?)"; 
            params.push(maker, maker); 
        }
        const [setups] = await db.query(sql, params);

        for (const s of setups) {
            const cleanSample = s.sample_barcode.replace(/[^a-zA-Z0-9]/g, '');

            // 1. Check for Match: Either same length or scanned is a subset
            if (cleanVal.length === cleanSample.length || cleanSample.includes(cleanVal) || cleanVal.includes(cleanSample)) {

                // --- STRUCTURAL MAPPING LOGIC ---
                // Find where the Lot No and SNo were in the sample
                const lotPos = cleanSample.indexOf(s.lot_no);
                const snoPos = cleanSample.indexOf(s.sno);

                // Identify target data from scanned barcode using sample's indices
                let foundLot = s.lot_no; // fallback to sample if mapping fails
                let foundSno = s.sno;
                let foundExp = s.exp_date;
                let usedMapping = false;

                if (lotPos !== -1 && cleanVal.length >= (lotPos + s.lot_no.length)) {
                    foundLot = cleanVal.substring(lotPos, lotPos + s.lot_no.length);
                    usedMapping = true;
                }
                if (snoPos !== -1 && cleanVal.length >= (snoPos + s.sno.length)) {
                    foundSno = cleanVal.substring(snoPos, snoPos + s.sno.length);
                    usedMapping = true;
                }

                // Handle Expiry Date Extraction (Look for YYMMDD or DDMMYY pattern)
                const expDateObj = new Date(s.exp_date);
                if (!isNaN(expDateObj.getTime())) {
                    const yy = String(expDateObj.getFullYear()).slice(-2);
                    const mm = String(expDateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(expDateObj.getDate()).padStart(2, '0');

                    const patterns = [`${yy}${mm}${dd}`, `${dd}${mm}${yy}`];
                    for (const p of patterns) {
                        const expPos = cleanSample.indexOf(p);
                        if (expPos !== -1 && cleanVal.length >= (expPos + 6)) {
                            const rawExp = cleanVal.substring(expPos, expPos + 6);
                            let eY, eM, eD;

                            // Fix for IRIS: Correctly identify date parts based on which pattern matched
                            if (s.maker_name.toUpperCase() === 'IRIS') {
                                if (p === `${dd}${mm}${yy}`) {
                                    // Pattern was DDMMYY
                                    eD = rawExp.substring(0, 2);
                                    eM = rawExp.substring(2, 4);
                                    eY = rawExp.substring(4, 6);
                                } else {
                                    // Pattern was YYMMDD
                                    eY = rawExp.substring(0, 2);
                                    eM = rawExp.substring(2, 4);
                                    eD = rawExp.substring(4, 6);
                                }
                            } else {
                                // Default legacy logic for other makers to avoid regression
                                eY = rawExp.substring(0, 2);
                                eM = rawExp.substring(2, 4);
                                eD = rawExp.substring(4, 6);
                            }

                            const fullY = parseInt(eY) > 50 ? `19${eY}` : `20${eY}`;
                            foundExp = `${fullY}-${eM}-${eD}`;
                            break;
                        }
                    }
                }

                const mfgDate = new Date(foundExp);
                if (!isNaN(mfgDate.getTime())) mfgDate.setFullYear(mfgDate.getFullYear() - s.mfg_years_less);

                console.log(`[BarcodeLookup] Matched Structure of Setup ID: ${s.id} | Lot: ${foundLot} | Sno: ${foundSno}`);

                return res.json({
                    found: true, source: 'structural_setup',
                    lot_no: foundLot,
                    sno: foundSno,
                    exp_date: foundExp instanceof Date ? foundExp.toISOString().split('T')[0] : foundExp,
                    mfg_date: mfgDate instanceof Date && !isNaN(mfgDate.getTime()) ? mfgDate.toISOString().split('T')[0] : '',
                    maker: s.maker_name
                });
            }
        }

        res.json({ found: false });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sales-lookup', async (req, res) => {
    try {
        const { lot_no, exp_date, customer_id } = req.query;
        if (!lot_no || !exp_date || !customer_id) return res.json({ found: false });

        const [soldRows] = await db.query(`
            SELECT sd.maker_id, sd.category_id, sd.power_id, sd.rate, sd.mfg_date,
                   m.name as maker_name, c.name as category_name, p.power as power_label,
                   SUM(sd.qty) as total_sold
            FROM sales_details sd
            JOIN sales s ON sd.sale_id = s.id
            JOIN makers m ON sd.maker_id = m.id
            JOIN categories c ON sd.category_id = c.id
            LEFT JOIN powers p ON sd.power_id = p.id
            WHERE sd.lot_no = ? AND sd.exp_date = ? AND s.customer_id = ?
            GROUP BY sd.maker_id, sd.category_id, sd.power_id, sd.rate, sd.mfg_date
            ORDER BY s.trans_date DESC LIMIT 1
        `, [lot_no.trim(), exp_date, customer_id]);

        if (soldRows.length === 0) return res.json({ found: false });

        const mainData = soldRows[0];
        const [returnRows] = await db.query(`
            SELECT SUM(rd.qty) as total_returned FROM sales_return_details rd
            JOIN sales_returns r ON rd.sales_return_id = r.id
            WHERE rd.lot_no = ? AND rd.exp_date = ? AND r.customer_id = ? AND rd.maker_id = ? AND rd.category_id = ? AND (rd.power_id = ? OR (rd.power_id IS NULL AND ? IS NULL))
        `, [lot_no.trim(), exp_date, customer_id, mainData.maker_id, mainData.category_id, mainData.power_id, mainData.power_id]);

        const totalSold = parseFloat(mainData.total_sold || 0);
        const totalReturned = parseFloat(returnRows[0]?.total_returned || 0);

        res.json({
            found: true,
            data: { ...mainData, lot_no: lot_no.trim(), exp_date, qty: totalSold - totalReturned, original_qty_sold: totalSold, total_returned: totalReturned }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// MASTERS CRUD
// ─────────────────────────────────────────────

router.get('/makers', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM makers ORDER BY name');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/makers', async (req, res) => {
    try {
        const { name } = req.body;
        const [r] = await db.query('INSERT INTO makers (name) VALUES (?)', [name]);
        res.json({ id: r.insertId, name });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Maker already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.put('/makers/:id', async (req, res) => {
    try {
        const { name } = req.body;
        await db.query('UPDATE makers SET name=? WHERE id=?', [name, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Maker already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.delete('/makers/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM makers WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/categories', async (req, res) => {
    try {
        const { maker_id } = req.query;
        let sql = 'SELECT c.*, m.name as maker_name FROM categories c JOIN makers m ON c.maker_id = m.id';
        const params = [];
        if (maker_id) { sql += ' WHERE c.maker_id = ?'; params.push(maker_id); }
        sql += ' ORDER BY c.name';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', async (req, res) => {
    try {
        const { name, maker_id, description, rate } = req.body;
        const [r] = await db.query('INSERT INTO categories (name, maker_id, rate, description) VALUES (?, ?, ?, ?)', [name, maker_id, rate || 0, description || null]);
        res.json({ id: r.insertId, name, maker_id, description, rate });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const { name, maker_id, description, rate } = req.body;
        await db.query('UPDATE categories SET name=?, maker_id=?, rate=?, description=? WHERE id=?', [name, maker_id, rate || 0, description || null, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM categories WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/get-category-rate/:id', async (req, res) => {
    try {
        const [[row]] = await db.query('SELECT rate FROM categories WHERE id = ?', [req.params.id]);
        res.json({ rate: row ? row.rate : 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/powers', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM powers ORDER BY power');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/powers', async (req, res) => {
    try {
        const { power } = req.body;
        const [r] = await db.query('INSERT INTO powers (power) VALUES (?)', [power]);
        res.json({ id: r.insertId, power });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Power rating already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.put('/powers/:id', async (req, res) => {
    try {
        const { power } = req.body;
        await db.query('UPDATE powers SET power=? WHERE id=?', [power, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Power rating already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.delete('/powers/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM powers WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/powers/import', async (req, res) => {
    try {
        const { powers } = req.body;
        if (!powers || !powers.length) return res.status(400).json({ error: 'No powers provided' });

        let inserted = 0;
        let skipped = 0;

        for (const p of powers) {
            try {
                await db.query('INSERT INTO powers (power) VALUES (?)', [p.power.toUpperCase()]);
                inserted++;
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') skipped++;
                else throw err;
            }
        }
        res.json({ inserted, skipped });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/suppliers', async (req, res) => {
    try {
        const { location_id: userLocId, role, is_head_office } = req.user;
        let location_id = req.query.location_id;
        
        let sql = 'SELECT * FROM suppliers';
        let params = [];

        if (role !== 'SUPER_ADMIN' || !is_head_office) {
            sql += ' WHERE location_id = ?';
            params.push(userLocId);
        } else if (location_id && location_id !== 'ALL') {
            sql += ' WHERE location_id = ?';
            params.push(location_id);
        }

        sql += ' ORDER BY name';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/suppliers', async (req, res) => {
    try {
        const { name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id } = req.body;
        const [r] = await db.query(
            'INSERT INTO suppliers (name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id]
        );
        const supplierId = r.insertId;

        // Auto-create account
        await autoCreateSupplierAccount(name, location_id);

        res.json({ id: supplierId, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/suppliers/:id', async (req, res) => {
    try {
        const { name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id } = req.body;
        
        // Fetch old name before update for account sync
        const [[oldSup]] = await db.query('SELECT name FROM suppliers WHERE id = ?', [req.params.id]);

        await db.query(
            'UPDATE suppliers SET name=?, contact_person=?, mobile=?, phone=?, fax=?, email=?, address=?, ntn=?, gst=?, location_id=? WHERE id=?',
            [name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id, req.params.id]
        );

        if (oldSup) {
            await autoUpdateAccountName(oldSup.name, name, 'ACCOUNT PAYABLES', location_id);
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/suppliers/:id', async (req, res) => {
    try {
        // Fetch details before deletion for account sync
        const [[supplier]] = await db.query('SELECT name, location_id FROM suppliers WHERE id = ?', [req.params.id]);
        
        await db.query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
        
        if (supplier) {
            await autoDeleteAccount(supplier.name, 'ACCOUNT PAYABLES', supplier.location_id);
        }
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/suppliers/import', async (req, res) => {
    try {
        const { suppliers } = req.body;
        if (!suppliers || !suppliers.length) return res.status(400).json({ error: 'No suppliers provided' });

        for (const s of suppliers) {
            await db.query(
                'INSERT INTO suppliers (name, contact_person, mobile, phone, email, address, ntn, gst, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [s.name.toUpperCase(), s.contact_person.toUpperCase(), s.mobile, s.phone, s.email, s.address, s.ntn, s.gst, s.location_id]
            );
            // Auto-create account for each imported supplier
            await autoCreateSupplierAccount(s.name, s.location_id);
        }
        res.json({ success: true, count: suppliers.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/customers', async (req, res) => {
    try {
        const { location_id: userLocId, role, is_head_office } = req.user;
        let location_id = req.query.location_id;
        
        let sql = 'SELECT * FROM customers';
        let params = [];

        if (role !== 'SUPER_ADMIN' || !is_head_office) {
            sql += ' WHERE location_id = ?';
            params.push(userLocId);
        } else if (location_id && location_id !== 'ALL') {
            sql += ' WHERE location_id = ?';
            params.push(location_id);
        }

        sql += ' ORDER BY name';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🎯 Helper: Automatically create a child account for a customer under ACCOUNT RECEIVABLES
async function autoCreateCustomerAccount(name, location_id) {
    try {
        const customerName = (name || '').toUpperCase().trim();
        if (!customerName) return;

        // 1. Find the ACCOUNT RECEIVABLES parent account dynamically
        const [[receivablesParent]] = await db.query(
            "SELECT id, account_code, account_type, level FROM chart_of_accounts WHERE account_name = 'ACCOUNT RECEIVABLES' LIMIT 1"
        );

        if (!receivablesParent) {
            console.warn('[AutoAccountCreation] "ACCOUNT RECEIVABLES" parent account not found in Chart of Accounts.');
            return;
        }

        const parentId = receivablesParent.id;

        // 2. Check for duplicate account in this location context
        const [[existingAcc]] = await db.query(
            'SELECT id FROM chart_of_accounts WHERE account_name = ? AND parent_id = ? AND location_id = ?',
            [customerName, parentId, location_id]
        );

        if (existingAcc) return; // Skip if already exists

        // 3. Generate Next Account Code (Pattern: ParentCode-Sequence)
        const [[{ maxSeq }]] = await db.query(
            "SELECT MAX(CAST(SUBSTRING_INDEX(account_code, '-', -1) AS UNSIGNED)) as maxSeq FROM chart_of_accounts WHERE parent_id = ?",
            [parentId]
        );
        const nextSeq = (maxSeq || 0) + 1;
        const nextCode = `${receivablesParent.account_code}-${nextSeq}`;

        // 4. Insert the new child account
        await db.query(
            `INSERT INTO chart_of_accounts 
            (account_code, account_name, parent_id, account_type, level, is_main, is_active, statement_type, location_id) 
            VALUES (?, ?, ?, ?, ?, 0, 1, 'BALANCE_SHEET', ?)`,
            [nextCode, customerName, parentId, receivablesParent.account_type, receivablesParent.level + 1, location_id]
        );
    } catch (err) {
        console.error('[AutoAccountCreation] Error for:', name, err.message);
    }
}

// 🎯 Helper: Automatically create a child account for a supplier under ACCOUNT PAYABLES
async function autoCreateSupplierAccount(name, location_id) {
    try {
        const supplierName = (name || '').toUpperCase().trim();
        if (!supplierName) return;

        // 1. Find the ACCOUNT PAYABLES parent account dynamically
        const [[payablesParent]] = await db.query(
            "SELECT id, account_code, account_type, level FROM chart_of_accounts WHERE account_name = 'ACCOUNT PAYABLES' LIMIT 1"
        );

        if (!payablesParent) {
            console.warn('[AutoAccountCreation] "ACCOUNT PAYABLES" parent account not found in Chart of Accounts.');
            return;
        }

        const parentId = payablesParent.id;

        // 2. Check for duplicate account in this location context
        const [[existingAcc]] = await db.query(
            'SELECT id FROM chart_of_accounts WHERE account_name = ? AND parent_id = ? AND location_id = ?',
            [supplierName, parentId, location_id]
        );

        if (existingAcc) return; // Skip if already exists

        // 3. Generate Next Account Code (Pattern: ParentCode-Sequence)
        const [[{ maxSeq }]] = await db.query(
            "SELECT MAX(CAST(SUBSTRING_INDEX(account_code, '-', -1) AS UNSIGNED)) as maxSeq FROM chart_of_accounts WHERE parent_id = ?",
            [parentId]
        );
        const nextSeq = (maxSeq || 0) + 1;
        const nextCode = `${payablesParent.account_code}-${nextSeq}`;

        // 4. Insert the new child account
        await db.query(
            `INSERT INTO chart_of_accounts 
            (account_code, account_name, parent_id, account_type, level, is_main, is_active, statement_type, location_id) 
            VALUES (?, ?, ?, ?, ?, 0, 1, 'BALANCE_SHEET', ?)`,
            [nextCode, supplierName, parentId, payablesParent.account_type, payablesParent.level + 1, location_id]
        );
    } catch (err) {
        console.error('[AutoAccountCreation] Error for supplier:', name, err.message);
    }
}

// 🎯 Helper: Automatically delete a child account if it has no dependencies
async function autoDeleteAccount(name, parentName, location_id) {
    try {
        const accountName = (name || '').toUpperCase().trim();
        if (!accountName) return;

        // 1. Find parent and account
        const [[parent]] = await db.query("SELECT id FROM chart_of_accounts WHERE account_name = ? LIMIT 1", [parentName]);
        if (!parent) return;

        const [[account]] = await db.query(
            "SELECT id FROM chart_of_accounts WHERE account_name = ? AND parent_id = ? AND location_id = ?",
            [accountName, parent.id, location_id]
        );

        if (!account) return;

        // 2. Dependency Safety Check
        const [[{ vCount }]] = await db.query("SELECT COUNT(*) as vCount FROM voucher_entries WHERE account_id = ?", [account.id]);
        const [[{ jCount }]] = await db.query("SELECT COUNT(*) as jCount FROM journal_entry_details WHERE account_id = ?", [account.id]);
        const [[{ oCount }]] = await db.query("SELECT COUNT(*) as oCount FROM opening_balances WHERE account_id = ?", [account.id]);

        if (vCount > 0 || jCount > 0 || oCount > 0) {
            console.warn(`[AutoDeleteAccount] Skipping deletion of account "${accountName}" as it has existing transactions/balances.`);
            return;
        }

        // 3. Safe to delete
        await db.query("DELETE FROM chart_of_accounts WHERE id = ?", [account.id]);
    } catch (err) {
        console.error(`[AutoDeleteAccount] Error for ${name}:`, err.message);
    }
}

// 🎯 Helper: Automatically update (rename) an account name if it matches old name
async function autoUpdateAccountName(oldName, newName, parentName, location_id) {
    try {
        const oldAccName = (oldName || '').toUpperCase().trim();
        const newAccName = (newName || '').toUpperCase().trim();

        if (!oldAccName || !newAccName || oldAccName === newAccName) return;

        // 1. Find parent
        const [[parent]] = await db.query("SELECT id FROM chart_of_accounts WHERE account_name = ? LIMIT 1", [parentName]);
        if (!parent) return;

        // 2. Check for duplicate of the NEW name in same location context
        const [[duplicate]] = await db.query(
            "SELECT id FROM chart_of_accounts WHERE account_name = ? AND parent_id = ? AND location_id = ?",
            [newAccName, parent.id, location_id]
        );
        if (duplicate) {
            console.warn(`[AutoUpdateAccount] Rename skipped: Target name "${newAccName}" already exists under ${parentName}.`);
            return;
        }

        // 3. Perform the rename
        await db.query(
            "UPDATE chart_of_accounts SET account_name = ? WHERE account_name = ? AND parent_id = ? AND location_id = ?",
            [newAccName, oldAccName, parent.id, location_id]
        );
    } catch (err) {
        console.error(`[AutoUpdateAccount] Error updating ${oldName} to ${newName}:`, err.message);
    }
}

router.post('/customers', async (req, res) => {
    try {
        const { name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id } = req.body;
        const [r] = await db.query(
            'INSERT INTO customers (name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id]
        );
        const customerId = r.insertId;

        // Auto-create account
        await autoCreateCustomerAccount(name, location_id);

        res.json({ id: customerId, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/customers/:id', async (req, res) => {
    try {
        const { name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id } = req.body;

        // Fetch old name before update for account sync
        const [[oldCust]] = await db.query('SELECT name FROM customers WHERE id = ?', [req.params.id]);

        await db.query(
            'UPDATE customers SET name=?, contact_person=?, mobile=?, phone=?, fax=?, email=?, address=?, ntn=?, gst=?, location_id=? WHERE id=?',
            [name, contact_person, mobile, phone, fax, email, address, ntn, gst, location_id, req.params.id]
        );

        if (oldCust) {
            await autoUpdateAccountName(oldCust.name, name, 'ACCOUNT RECEIVABLES', location_id);
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/customers/:id', async (req, res) => {
    try {
        // Fetch details before deletion for account sync
        const [[customer]] = await db.query('SELECT name, location_id FROM customers WHERE id = ?', [req.params.id]);

        await db.query('DELETE FROM customers WHERE id=?', [req.params.id]);

        if (customer) {
            await autoDeleteAccount(customer.name, 'ACCOUNT RECEIVABLES', customer.location_id);
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/customers/import', async (req, res) => {
    try {
        const { customers } = req.body;
        if (!customers || !customers.length) return res.status(400).json({ error: 'No customers provided' });

        for (const c of customers) {
            await db.query(
                'INSERT INTO customers (name, contact_person, mobile, phone, email, address, ntn, gst, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [c.name.toUpperCase(), c.contact_person.toUpperCase(), c.mobile, c.phone, c.email, c.address, c.ntn, c.gst, c.location_id]
            );
            // Auto-create account for each imported customer
            await autoCreateCustomerAccount(c.name, c.location_id);
        }
        res.json({ success: true, count: customers.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sales-invoice-rates', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT a_rate, b_rate FROM sales_invoice_rates ORDER BY a_rate ASC');
        const a_rates = [...new Set(rows.map(r => r.a_rate))];
        const b_rates = [...new Set(rows.map(r => r.b_rate))];
        res.json({ a_rates, b_rates });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// TRANSACTION GENERATOR
// ─────────────────────────────────────────────

const createTxEndPoints = (config) => {
    const { path, table, detailsTable, fkCol, prefix, ledgerSync, manual } = config;
    if (manual) return;

    router.post(`/${path}`, async (req, res) => {
        const { trans_date, fiscal_year_id, user_id, location_id, details, total_amount } = req.body;
        if (!trans_date || !fiscal_year_id || !location_id || !details) {
            return res.status(400).json({ error: 'Missing required transaction fields' });
        }

        // Check if fiscal year is closed
        const [[fy]] = await db.query('SELECT is_closed FROM fiscal_years WHERE id=?', [fiscal_year_id]);
        if (fy && fy.is_closed) {
            return res.status(403).json({ error: 'Cannot add transactions to a closed fiscal year' });
        }

        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            // --- GLOBAL UNIQUENESS CHECK (Type-Specific) ---
            if (table === 'purchases' || table === 'stock_opening_balances') {
                for (const d of details) {
                    if (d.lot_no && d.sno && d.sno !== '0' && d.sno !== '') {
                        let conflict = null;
                        if (table === 'purchases') {
                            [[conflict]] = await conn.query(
                                `SELECT h.trans_no FROM purchase_details d JOIN purchases h ON d.purchase_id = h.id WHERE d.lot_no = ? AND d.sno = ?`,
                                [d.lot_no, d.sno]
                            );
                        } else {
                            [[conflict]] = await conn.query(
                                `SELECT trans_no FROM stock_opening_balances WHERE lot_no = ? AND sno = ?`,
                                [d.lot_no, d.sno]
                            );
                        }

                        if (conflict) {
                            throw new Error(`Serial Number Conflict: Lot #${d.lot_no} / SNo #${d.sno} already exists in transaction ${conflict.trans_no}.`);
                        }
                    }
                }
            }

            const txIdData = await genTransNo(conn, table, prefix, location_id, fiscal_year_id);
            const { trans_no, sequence_no, location_code, fiscal_year_label, transaction_type } = txIdData;

            const fields = ['trans_no', 'trans_date', 'fiscal_year_id', 'user_id', 'location_id', 'sequence_no', 'location_code', 'fiscal_year_label', 'transaction_type'];
            const vals = [trans_no, trans_date, fiscal_year_id, user_id, location_id, sequence_no, location_code, fiscal_year_label, transaction_type];
            if (table !== 'transfer_requests') { fields.push('total_amount'); vals.push(total_amount); }

            if (req.body.supplier_id && table.includes('purchase')) { fields.push('supplier_id'); vals.push(req.body.supplier_id); }
            if (req.body.customer_id && table.includes('sale')) { 
                // Server-side validation: Ensure customer belongs to the transaction location
                const [[cust]] = await conn.query('SELECT location_id FROM customers WHERE id = ?', [req.body.customer_id]);
                if (!cust || parseInt(cust.location_id) !== parseInt(location_id)) {
                    throw new Error('Selected customer is not authorized for this location.');
                }
                fields.push('customer_id'); vals.push(req.body.customer_id); 
            }
            if (req.body.from_location_id && table === 'transfers') { fields.push('from_location_id'); vals.push(req.body.from_location_id); }
            if (req.body.to_location_id && (table === 'transfers' || table === 'transfer_requests')) { fields.push('to_location_id'); vals.push(req.body.to_location_id); }
            if (req.body.transfer_request_id && table === 'transfers') { fields.push('transfer_request_id'); vals.push(req.body.transfer_request_id); }

            const [r] = await conn.query(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, vals);
            const headerId = r.insertId;

            await insertDetails(conn, detailsTable, fkCol, headerId, details);

            if (ledgerSync) {
                await syncInventoryToLedger(conn, {
                    tx_id: headerId, trans_no, trans_date,
                    party_id: req.body.supplier_id || req.body.customer_id,
                    total_amount, location_id, fiscal_year_id, type: config.type, headerTable: table
                });
            }

            if (config.type === 'TRANSFER') {
                const syncMap = new Map();
                (details || []).forEach(d => {
                    if (d.reqTransNo) {
                        const key = `${d.reqTransNo}|${d.maker_id}|${d.category_id}|${d.power_id || ''}`;
                        syncMap.set(key, (syncMap.get(key) || 0) + parseFloat(d.qty || 0));
                    }
                });

                if (syncMap.size > 0) {
                    const uniqueRequests = new Set();
                    for (const [compositeKey, totalQty] of syncMap.entries()) {
                        const [transNo, mId, cId, pId] = compositeKey.split('|');
                        uniqueRequests.add(transNo);

                        // 1. Update Transfer Request Details (STOCK RECEIVED = Total Qty Transferred)
                        await conn.query(`
                            UPDATE transfer_request_details d
                            JOIN transfer_requests h ON d.request_id = h.id
                            SET d.stock_received = ?
                            WHERE h.trans_no = ? 
                              AND d.maker_id = ? 
                              AND d.category_id = ? 
                              AND (d.power_id = ? OR (d.power_id IS NULL AND ? = ''))
                        `, [totalQty, transNo, mId, cId, pId, pId]);
                    }

                    // 2. Update Transfer Request Header (Status & Notification Seen)
                    if (uniqueRequests.size > 0) {
                        await conn.query(`
                            UPDATE transfer_requests 
                            SET status = 'TRANSFERRED', notification_seen = 1 
                            WHERE trans_no IN (?)
                        `, [Array.from(uniqueRequests)]);
                    }
                } else if (req.body.transfer_request_id) {
                    const trqIds = String(req.body.transfer_request_id).split(',').map(id => id.trim()).filter(id => id);
                    if (trqIds.length > 0) {
                        await conn.query('UPDATE transfer_requests SET status = "TRANSFERRED", notification_seen = 1 WHERE id IN (?)', [trqIds]);
                    }
                }
            }
            await conn.commit();
            res.json({ success: true, id: headerId, trans_no });
        } catch (err) {
            if (conn) await conn.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });

    router.get(`/${path}`, async (req, res) => {
        try {
            const { fiscal_year_id, fromDate, toDate, all_locations } = req.query;
            let location_id = req.query.location_id;
            const { location_id: userLocId, role, is_head_office } = req.user;

            // Enforce location-based restrictions
            if (role !== 'SUPER_ADMIN' || !is_head_office) {
                location_id = userLocId;
            } else if (all_locations === 'true') {
                location_id = null; // Head office super admin can view all
            }

            let cols = 'h.*, m.name AS maker_name, c.name AS category_name, pw.power, d.qty ';
            if (detailsTable === 'transfer_details') {
                cols += ', d.stock_required, d.stock_req, d.qty_in_hand ';
            } else if (detailsTable === 'transfer_request_details') {
                cols += ', d.stock_received ';
            }
            if (table !== 'transfer_requests') {
                cols += ', d.lot_no, d.sno, d.mfg_date, d.exp_date, d.rate, d.amount ';
            }

            let sql = `SELECT ${cols} `;

            if (table.includes('purchase')) sql += `, s.name AS supplier_name FROM ${table} h JOIN ${detailsTable} d ON h.id = d.${fkCol} LEFT JOIN suppliers s ON h.supplier_id = s.id `;
            else if (table.includes('sale')) sql += `, s.name AS customer_name FROM ${table} h JOIN ${detailsTable} d ON h.id = d.${fkCol} LEFT JOIN customers s ON h.customer_id = s.id `;
            else if (table === 'transfers') sql += `, fl.name AS from_location_name, tl.name AS to_location_name FROM ${table} h JOIN ${detailsTable} d ON h.id = d.${fkCol} LEFT JOIN locations fl ON h.from_location_id = fl.id LEFT JOIN locations tl ON h.to_location_id = tl.id `;
            else if (table === 'transfer_requests') sql += `, tl.name AS to_location_name FROM ${table} h JOIN ${detailsTable} d ON h.id = d.${fkCol} LEFT JOIN locations tl ON h.to_location_id = tl.id `;
            else sql += ` FROM ${table} h JOIN ${detailsTable} d ON h.id = d.${fkCol} `;

            sql += ` JOIN makers m ON d.maker_id = m.id JOIN categories c ON d.category_id = c.id LEFT JOIN powers pw ON d.power_id = pw.id WHERE 1=1 `;
            const params = [];
            if (location_id) { sql += ' AND h.location_id = ?'; params.push(location_id); }
            if (fiscal_year_id) { sql += ' AND h.fiscal_year_id = ?'; params.push(fiscal_year_id); }
            if (fromDate) { sql += ' AND h.trans_date >= ?'; params.push(fromDate); }
            if (toDate) { sql += ' AND h.trans_date <= ?'; params.push(toDate); }

            sql += ' ORDER BY h.id DESC, d.id ASC';
            const [rows] = await db.query(sql, params);
            res.json(rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get(`/${path}/:id`, async (req, res) => {
        try {
            const [headers] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
            if (!headers[0]) return res.status(404).json({ error: 'Transaction not found' });
            const [details] = await db.query(`SELECT * FROM ${detailsTable} WHERE ${fkCol} = ?`, [req.params.id]);
            res.json({ ...headers[0], details });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete(`/${path}/:id`, async (req, res) => {
        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();
            const [[h]] = await conn.query(`SELECT id ${ledgerSync ? ', voucher_id' : ''} ${table === 'transfers' ? ', transfer_request_id' : ''} FROM ${table} WHERE id = ?`, [req.params.id]);

            if (ledgerSync && h?.voucher_id) {
                await conn.query(`UPDATE ${table} SET voucher_id = NULL WHERE id = ?`, [req.params.id]);
                await conn.query('DELETE FROM vouchers WHERE id = ?', [h.voucher_id]);
            }
            if (table === 'transfers' && h?.transfer_request_id) {
                await conn.query('UPDATE transfer_requests SET status = "PENDING" WHERE id = ?', [h.transfer_request_id]);
            }

            await conn.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
            await conn.commit();
            res.json({ success: true });
        } catch (err) {
            if (conn) await conn.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });

    // --- Bulk Delete Transactions ---
    router.post(`/${path}/bulk-delete`, async (req, res) => {
        const { ids } = req.body;
        if (!ids || !ids.length) return res.json({ success: true });
        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();
            for (const id of ids) {
                const [[h]] = await conn.query(`SELECT id ${ledgerSync ? ', voucher_id' : ''} ${table === 'transfers' ? ', transfer_request_id' : ''} FROM ${table} WHERE id = ?`, [id]);
                if (ledgerSync && h?.voucher_id) {
                    await conn.query(`UPDATE ${table} SET voucher_id = NULL WHERE id = ?`, [id]);
                    await conn.query('DELETE FROM vouchers WHERE id = ?', [h.voucher_id]);
                }
                if (table === 'transfers' && h?.transfer_request_id) {
                    await conn.query('UPDATE transfer_requests SET status = "PENDING" WHERE id = ?', [h.transfer_request_id]);
                }
                await conn.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
            }
            await conn.commit();
            res.json({ success: true });
        } catch (err) {
            if (conn) await conn.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });

    // --- Surgical Detail Delete ---
    router.delete(`/${path}/details/:detailId`, async (req, res) => {
        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();
            const [[det]] = await conn.query(`SELECT * FROM ${detailsTable} WHERE id = ?`, [req.params.detailId]);
            if (!det) return res.status(404).json({ error: 'Detail not found' });
            const [[h]] = await conn.query(`SELECT * FROM ${table} WHERE id = ?`, [det[fkCol]]);
            if (!h) throw new Error('Header not found');

            await conn.query(`DELETE FROM ${detailsTable} WHERE id = ?`, [req.params.detailId]);
            const [[{ count }]] = await conn.query(`SELECT COUNT(*) as cnt FROM ${detailsTable} WHERE ${fkCol} = ?`, [h.id]);

            if (count === 0) {
                const [[head]] = await conn.query(`SELECT id ${ledgerSync ? ', voucher_id' : ''} ${table === 'transfers' ? ', transfer_request_id' : ''} FROM ${table} WHERE id = ?`, [h.id]);
                if (ledgerSync && head?.voucher_id) {
                    await conn.query(`UPDATE ${table} SET voucher_id = NULL WHERE id = ?`, [h.id]);
                    await conn.query('DELETE FROM vouchers WHERE id = ?', [head.voucher_id]);
                }
                if (head?.transfer_request_id) {
                    await conn.query('UPDATE transfer_requests SET status = "PENDING" WHERE id = ?', [head.transfer_request_id]);
                }
                await conn.query(`DELETE FROM ${table} WHERE id = ?`, [h.id]);
            } else {
                const [[newTotals]] = await conn.query(`SELECT SUM(qty) as tQty, SUM(amount) as tAmt FROM ${detailsTable} WHERE ${fkCol} = ?`, [h.id]);
                await conn.query(`UPDATE ${table} SET total_qty = ?, total_amount = ? WHERE id = ?`, [newTotals.tQty || 0, newTotals.tAmt || 0, h.id]);
                if (ledgerSync) {
                    await syncInventoryToLedger(conn, {
                        tx_id: h.id, trans_no: h.trans_no, trans_date: h.trans_date,
                        party_id: h.supplier_id || h.customer_id,
                        total_amount: newTotals.tAmt || 0, location_id: h.location_id,
                        fiscal_year_id: h.fiscal_year_id, type: config.type, headerTable: table
                    });
                }
            }
            await conn.commit();
            res.json({ success: true, deletedHeader: count === 0 });
        } catch (err) {
            if (conn) await conn.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });

    router.put(`/${path}/:id`, async (req, res) => {
        const { trans_date, total_amount, details } = req.body;
        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            const fields = ['trans_date'];
            const vals = [trans_date];
            if (table !== 'transfer_requests') { fields.push('total_amount'); vals.push(total_amount); }
            if (req.body.supplier_id && table.includes('purchase')) { fields.push('supplier_id'); vals.push(req.body.supplier_id); }
            if (req.body.customer_id && table.includes('sale')) { fields.push('customer_id'); vals.push(req.body.customer_id); }
            if (req.body.from_location_id && table === 'transfers') { fields.push('from_location_id'); vals.push(req.body.from_location_id); }
            if (req.body.to_location_id && (table === 'transfers' || table === 'transfer_requests')) { fields.push('to_location_id'); vals.push(req.body.to_location_id); }

            const setSql = fields.map(f => `${f}=?`).join(',');
            await conn.query(`UPDATE ${table} SET ${setSql} WHERE id=?`, [...vals, req.params.id]);

            const [[h]] = await conn.query(`SELECT trans_no, location_id, fiscal_year_id FROM ${table} WHERE id = ?`, [req.params.id]);
            if (!h) throw new Error('Header not found');

            await conn.query(`DELETE FROM ${detailsTable} WHERE ${fkCol} = ?`, [req.params.id]);
            await insertDetails(conn, detailsTable, fkCol, req.params.id, details);

            if (ledgerSync) {
                await syncInventoryToLedger(conn, {
                    tx_id: req.params.id,
                    trans_no: h.trans_no,
                    trans_date,
                    party_id: req.body.supplier_id || req.body.customer_id,
                    total_amount,
                    location_id: h.location_id,
                    fiscal_year_id: h.fiscal_year_id,
                    type: config.type,
                    headerTable: table
                });
            }
            await conn.commit();
            res.json({ success: true });
        } catch (err) {
            if (conn) await conn.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });
};


// ── PROFESSIONAL SALES INVOICE PRINTING ──
router.get('/sales/print/:id', async (req, res) => {
    try {
        const [headers] = await db.query(`
            SELECT s.*, c.name as customer_name, c.address as customer_address, c.mobile as customer_mobile
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id 
            WHERE s.id = ?
        `, [req.params.id]);

        if (!headers[0]) return res.status(404).json({ error: 'Invoice not found' });

        const [details] = await db.query(`
            SELECT 
                d.*, 
                m.name as maker_name, 
                cat.name as category_name, 
                cat.description as category_description,
                p.power,
                SUM(d.qty) OVER(PARTITION BY d.maker_id, d.category_id, d.power_id) as group_total_qty,
                SUM(d.amount) OVER(PARTITION BY d.maker_id, d.category_id, d.power_id) as group_total_amount
            FROM sales_details d
            JOIN makers m ON d.maker_id = m.id
            JOIN categories cat ON d.category_id = cat.id
            LEFT JOIN powers p ON d.power_id = p.id
            WHERE d.sale_id = ?
            ORDER BY d.id ASC
        `, [req.params.id]);

        res.json({ ...headers[0], details });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BULK SALES INVOICE PRINTING ──
router.get('/sales/print-bulk', async (req, res) => {
    try {
        const { ids, fromNo, toNo, transNos, location_id, fiscal_year_id } = req.query;
        let idList = [];

        if (ids) {
            idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        } else if (transNos) {
            const nos = transNos.split(',').map(n => n.trim()).filter(n => n);
            if (nos.length > 0) {
                const [rows] = await db.query(
                    `SELECT id FROM sales WHERE trans_no IN (?)`,
                    [nos]
                );
                idList = rows.map(r => r.id);
            }
        } else if (fromNo && toNo) {
            const [rows] = await db.query(
                `SELECT id FROM sales 
                 WHERE location_id = ? AND fiscal_year_id = ? 
                 AND trans_no BETWEEN ? AND ?
                 ORDER BY trans_no ASC`,
                [location_id, fiscal_year_id, fromNo.trim(), toNo.trim()]
            );
            idList = rows.map(r => r.id);
        }

        if (idList.length === 0) return res.status(404).json({ error: 'No invoices found for the given selection.' });

        const [headers] = await db.query(`
            SELECT s.*, c.name as customer_name, c.address as customer_address, c.mobile as customer_mobile
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id 
            WHERE s.id IN (?)
            ORDER BY s.trans_no ASC
        `, [idList]);

        const [details] = await db.query(`
            SELECT 
                d.*, 
                m.name as maker_name, 
                cat.name as category_name, 
                cat.description as category_description,
                p.power,
                SUM(d.qty) OVER(PARTITION BY d.sale_id, d.maker_id, d.category_id, d.power_id) as group_total_qty,
                SUM(d.amount) OVER(PARTITION BY d.sale_id, d.maker_id, d.category_id, d.power_id) as group_total_amount
            FROM sales_details d
            JOIN makers m ON d.maker_id = m.id
            JOIN categories cat ON d.category_id = cat.id
            LEFT JOIN powers p ON d.power_id = p.id
            WHERE d.sale_id IN (?)
            ORDER BY d.sale_id, d.id ASC
        `, [idList]);

        const detailsBySaleId = details.reduce((acc, d) => {
            if (!acc[d.sale_id]) acc[d.sale_id] = [];
            acc[d.sale_id].push(d);
            return acc;
        }, {});

        const result = headers.map(h => ({
            ...h,
            details: detailsBySaleId[h.id] || []
        }));

        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

txConfigs.forEach(createTxEndPoints);


// OPENING BALANCES (Specific logic)
router.get('/opening-balances', async (req, res) => {
    try {
        const { fiscal_year_id, all_locations } = req.query;
        let location_id = req.query.location_id;
        const { location_id: userLocId, role, is_head_office } = req.user;

        // Enforce location-based restrictions
        if (role !== 'SUPER_ADMIN' || !is_head_office) {
            location_id = userLocId;
        } else if (all_locations === 'true') {
            location_id = null;
        }

        let sql = `SELECT ob.*, m.name as maker_name, c.name as category_name, p.power FROM stock_opening_balances ob JOIN makers m ON ob.maker_id = m.id JOIN categories c ON ob.category_id = c.id LEFT JOIN powers p ON ob.power_id = p.id WHERE 1=1 `;
        const params = [];
        if (location_id) { sql += ' AND ob.location_id = ?'; params.push(location_id); }
        if (fiscal_year_id) { sql += ' AND ob.fiscal_year_id = ?'; params.push(fiscal_year_id); }
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/opening-balances', async (req, res) => {
    let conn;
    try {
        const { details, trans_date } = req.body;
        let { location_id, fiscal_year_id } = req.body;
        const { location_id: userLocId, role, is_head_office } = req.user;

        // Force location restriction
        if (role !== 'SUPER_ADMIN' || !is_head_office) {
            location_id = userLocId;
        }

        if (!details || !details.length) return res.status(400).json({ error: 'No details provided' });

        conn = await db.getConnection();
        await conn.beginTransaction();

        // --- GLOBAL UNIQUENESS CHECK (Only Opening) ---
        for (const d of details) {
            if (d.lot_no && d.sno && d.sno !== '0' && d.sno !== '') {
                const [[oExists]] = await conn.query(
                    `SELECT trans_no FROM stock_opening_balances WHERE lot_no = ? AND sno = ?`,
                    [d.lot_no, d.sno]
                );
                if (oExists) {
                    await conn.rollback();
                    return res.status(400).json({ error: `Serial Number Conflict: Lot #${d.lot_no} / SNo #${d.sno} already exists in ${oExists.trans_no}.` });
                }
            }
        }

        // Check if fiscal year is closed
        const [[fy]] = await conn.query('SELECT is_closed FROM fiscal_years WHERE id = ?', [fiscal_year_id]);
        if (!fy || fy.is_closed) {
            await conn.rollback();
            return res.status(403).json({ error: 'This fiscal year is closed or invalid.' });
        }

        const txIdData = await genTransNo(conn, 'stock_opening_balances', 'OB', location_id, fiscal_year_id);
        const { trans_no, sequence_no, location_code, fiscal_year_label, transaction_type } = txIdData;

        for (const d of details) {
            
            await conn.query(`INSERT INTO stock_opening_balances 
                (trans_no, trans_date, maker_id, category_id, power_id, lot_no, sno, qty, rate, amount, location_id, fiscal_year_id, mfg_date, exp_date, sequence_no, location_code, fiscal_year_label, transaction_type) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
                [
                    trans_no, 
                    trans_date || d.trans_date || new Date().toISOString().split('T')[0], 
                    d.maker_id, d.category_id, d.power_id || null, 
                    d.lot_no || null, d.sno || null, d.qty, d.rate, d.amount, 
                    location_id, fiscal_year_id, d.mfg_date || null, d.exp_date || null,
                    sequence_no, location_code, fiscal_year_label, transaction_type
                ]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Helper to parse various date formats from CSV to YYYY-MM-DD
function parseCSVDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'N/A') return null;
    
    // Handle DD-MMM-YYYY (e.g., 01-MAY-2026)
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const day = parts[0];
            const monthStr = parts[1].toUpperCase();
            const year = parts[2];
            const months = {
                'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
                'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
            };
            const month = months[monthStr];
            if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
        }
    }

    // Handle DD/MM/YYYY
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Check if it's YYYY/MM/DD or DD/MM/YYYY
            if (parts[0].length === 4) return dateStr.replace(/\//g, '-');
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }

    // Fallback to JS Date
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (e) {}

    return null;
}

router.post('/opening-balances/import', async (req, res) => {
    let conn;
    try {
        const { rows, fiscal_year_id, location_id } = req.body;
        if (!rows || !rows.length) return res.status(400).json({ error: 'No data provided' });

        conn = await db.getConnection();
        await conn.beginTransaction();

        // 1. Fetch Masters for mapping
        const [makers] = await conn.query('SELECT id, name FROM makers');
        const [categories] = await conn.query('SELECT id, name FROM categories');
        const [powers] = await conn.query('SELECT id, power FROM powers');

        const makerMap = Object.fromEntries(makers.map(m => [m.name.toLowerCase().trim(), m.id]));
        const categoryMap = Object.fromEntries(categories.map(c => [c.name.toLowerCase().trim(), c.id]));
        const powerMap = Object.fromEntries(powers.map(p => [p.power.toLowerCase().trim(), p.id]));

        let successCount = 0;
        let failedCount = 0;
        const errors = [];
        const transMapping = new Map();

        // 2. Process rows
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const originalTransNo = row.trans_no || row.Transaction;
            
            try {
                // Mapping names to IDs
                const makerName = String(row.maker || row.Maker || '').toLowerCase().trim();
                const categoryName = String(row.category || row.Category || '').toLowerCase().trim();
                const powerLabel = String(row.power || row.Power || '').toLowerCase().trim();
                
                const maker_id = makerMap[makerName];
                const category_id = categoryMap[categoryName];
                const power_id = powerMap[powerLabel] || null;

                if (!maker_id || !category_id) {
                    throw new Error(`Invalid Maker (${row.Maker || row.maker}) or Category (${row.Category || row.category})`);
                }

                // Numbers
                const qty = parseFloat(String(row.qty || row.Qty || 0).replace(/,/g, ''));
                const rate = parseFloat(String(row.rate || row.Rate || 0).replace(/,/g, ''));
                const amount = parseFloat(String(row.amount || row.Amount || row.total || row.Total || (qty * rate)).replace(/,/g, ''));

                // Lot/SNo
                const lot_no = row.lot || row.lot_no || row['Lot No'] || null;
                const sno = row.sno || row.SNO || row.SNo || null;

                // Duplicate Check (Lot/SNo)
                if (lot_no && sno && sno !== '0' && sno !== '') {
                    const [[conflict]] = await conn.query(
                        `SELECT trans_no FROM stock_opening_balances WHERE lot_no = ? AND sno = ?`,
                        [lot_no, sno]
                    );
                    if (conflict) {
                        throw new Error(`Conflict: Lot #${lot_no} / SNo #${sno} already exists in ${conflict.trans_no}`);
                    }
                }

                // Determine trans_no
                let finalTransNo = '';
                let seqData = null;

                if (originalTransNo && originalTransNo !== '-' && transMapping.has(originalTransNo)) {
                    const mapped = transMapping.get(originalTransNo);
                    finalTransNo = mapped.trans_no;
                    seqData = mapped;
                } else {
                    if (originalTransNo && originalTransNo !== '-') {
                        const [[exists]] = await conn.query('SELECT trans_no FROM stock_opening_balances WHERE trans_no = ? LIMIT 1', [originalTransNo]);
                        if (exists) throw new Error(`Transaction ${originalTransNo} already exists.`);
                    }
                    
                    const txIdData = await genTransNo(conn, 'stock_opening_balances', 'OB', location_id, fiscal_year_id);
                    finalTransNo = txIdData.trans_no;
                    seqData = txIdData;
                    if (originalTransNo && originalTransNo !== '-') {
                        transMapping.set(originalTransNo, txIdData);
                    }
                }

                // Dates
                const transDate = parseCSVDate(row.date || row.Date) || new Date().toISOString().split('T')[0];
                const mfgDate = parseCSVDate(row.mfg_date || row['Mfg Date']);
                const expDate = parseCSVDate(row.exp_date || row['Exp Date']);

                // Insert
                await conn.query(`INSERT INTO stock_opening_balances 
                    (trans_no, trans_date, maker_id, category_id, power_id, lot_no, sno, qty, rate, amount, location_id, fiscal_year_id, mfg_date, exp_date, sequence_no, location_code, fiscal_year_label, transaction_type) 
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
                    [
                        finalTransNo, transDate, maker_id, category_id, power_id, 
                        lot_no, sno, qty, rate, amount, 
                        location_id, fiscal_year_id, mfgDate, expDate,
                        seqData.sequence_no, seqData.location_code, seqData.fiscal_year_label, seqData.transaction_type
                    ]
                );

                successCount++;
            } catch (err) {
                failedCount++;
                errors.push({ row: i + 1, error: err.message });
            }
        }

        await conn.commit();
        res.json({
            success: true,
            total: rows.length,
            imported: successCount,
            failed: failedCount,
            errors: errors
        });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/opening-balances/:id', async (req, res) => {
    try {
        const [[first]] = await db.query('SELECT trans_no FROM stock_opening_balances WHERE id = ?', [req.params.id]);
        if (!first) return res.status(404).json({ error: 'Record not found' });
        
        const [rows] = await db.query('SELECT * FROM stock_opening_balances WHERE trans_no = ?', [first.trans_no]);
        // Return the first row as header and all rows as details
        res.json({ ...rows[0], details: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/opening-balances/:id', async (req, res) => {
    let conn;
    try {
        const { details, trans_date, trans_no: bodyTransNo } = req.body;
        if (!details || !details.length) return res.status(400).json({ error: 'No details provided' });

        conn = await db.getConnection();
        await conn.beginTransaction();

        // 1. Get original trans metadata — first try by id, fall back to trans_no from body
        //    (Row IDs change after every edit because we delete+re-insert, so the id may be stale)
        let [[orig]] = await conn.query('SELECT trans_no, sequence_no, location_id, fiscal_year_id, location_code, fiscal_year_label, transaction_type FROM stock_opening_balances WHERE id = ?', [req.params.id]);
        if (!orig && bodyTransNo) {
            [[orig]] = await conn.query('SELECT trans_no, sequence_no, location_id, fiscal_year_id, location_code, fiscal_year_label, transaction_type FROM stock_opening_balances WHERE trans_no = ? LIMIT 1', [bodyTransNo]);
        }
        if (!orig) {
            await conn.rollback();
            return res.status(404).json({ error: 'Original record not found' });
        }

        // 2. Delete entire existing group
        await conn.query('DELETE FROM stock_opening_balances WHERE trans_no = ?', [orig.trans_no]);

        // 3. Re-insert new details preserving the trans_no
        for (const d of details) {
            await conn.query(`INSERT INTO stock_opening_balances 
                (trans_no, trans_date, maker_id, category_id, power_id, lot_no, sno, qty, rate, amount, location_id, fiscal_year_id, mfg_date, exp_date, sequence_no, location_code, fiscal_year_label, transaction_type) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
                [
                    orig.trans_no, 
                    trans_date || d.trans_date || new Date().toISOString().split('T')[0], 
                    d.maker_id, d.category_id, d.power_id || null, 
                    d.lot_no || null, d.sno || null, d.qty, d.rate, d.amount, 
                    orig.location_id, orig.fiscal_year_id, d.mfg_date || null, d.exp_date || null,
                    orig.sequence_no, orig.location_code, orig.fiscal_year_label, orig.transaction_type
                ]
            );
        }

        await conn.commit();
        res.json({ success: true, trans_no: orig.trans_no });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

router.delete('/opening-balances/:id', async (req, res) => {
    try {
        const [[first]] = await db.query('SELECT trans_no FROM stock_opening_balances WHERE id = ?', [req.params.id]);
        if (first) {
            await db.query('DELETE FROM stock_opening_balances WHERE trans_no = ?', [first.trans_no]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/opening-balances/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !ids.length) return res.json({ success: true });
        await db.query('DELETE FROM stock_opening_balances WHERE id IN (?)', [ids]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stock-balance', async (req, res) => {
    try {
        const { maker_id, category_id, power_id, location_id, fiscal_year_id } = req.query;
        let sql = `
            SELECT SUM(qty) as balance 
            FROM (
                SELECT qty FROM stock_opening_balances WHERE maker_id=? AND category_id=? AND power_id=? AND location_id=? AND fiscal_year_id=?
                UNION ALL
                SELECT d.qty FROM purchase_details d JOIN purchases h ON d.purchase_id=h.id WHERE d.maker_id=? AND d.category_id=? AND d.power_id=? AND h.location_id=? AND h.fiscal_year_id=?
                UNION ALL
                SELECT -d.qty FROM purchase_return_details d JOIN purchase_returns h ON d.purchase_return_id=h.id WHERE d.maker_id=? AND d.category_id=? AND d.power_id=? AND h.location_id=? AND h.fiscal_year_id=?
                UNION ALL
                SELECT -d.qty FROM transfer_details d JOIN transfers h ON d.transfer_id=h.id WHERE d.maker_id=? AND d.category_id=? AND d.power_id=? AND h.from_location_id=? AND h.fiscal_year_id=?
                UNION ALL
                SELECT d.qty FROM transfer_details d JOIN transfers h ON d.transfer_id=h.id WHERE d.maker_id=? AND d.category_id=? AND d.power_id=? AND h.to_location_id=? AND h.fiscal_year_id=?
                UNION ALL
                SELECT -d.qty FROM sales_details d JOIN sales h ON d.sale_id=h.id WHERE d.maker_id=? AND d.category_id=? AND d.power_id=? AND h.location_id=? AND h.fiscal_year_id=?
                UNION ALL
                SELECT d.qty FROM sales_return_details d JOIN sales_returns h ON d.sales_return_id=h.id WHERE d.maker_id=? AND d.category_id=? AND d.power_id=? AND h.location_id=? AND h.fiscal_year_id=?
            ) as t
        `;
        const p = [maker_id, category_id, power_id, location_id, fiscal_year_id];
        const params = [...p, ...p, ...p, ...p, ...p, ...p, ...p];
        const [[{ balance }]] = await db.query(sql, params);
        res.json({ balance: balance || 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// REPORTS
router.get('/stock-report', async (req, res) => {
    try {
        const { location_id, maker_id, category_id, power_id, fiscal_year_id } = req.query;

        let sql = `
            SELECT
                m.id   AS maker_id,    m.name AS maker_name,
                c.id   AS category_id, c.name AS category_name,
                p.id   AS power_id,    p.power,
                SUM(opening_qty) AS opening_qty,
                SUM(purchase_qty) AS purchase_qty,
                SUM(purchase_return_qty) AS purchase_return_qty,
                SUM(transfer_qty) AS transfer_qty,
                SUM(sales_qty) AS sales_qty,
                SUM(sales_return_qty) AS sales_return_qty,
                SUM(qty) AS balance_qty
            FROM (
                -- Opening Balance (+)
                SELECT maker_id, category_id, power_id, qty AS opening_qty, 0 AS purchase_qty, 0 AS purchase_return_qty, 0 AS transfer_qty, 0 AS sales_qty, 0 AS sales_return_qty, qty, location_id
                FROM stock_opening_balances
                WHERE fiscal_year_id = ?
                ${location_id ? ' AND location_id = ?' : ''}
                ${maker_id ? ' AND maker_id = ?' : ''}
                ${category_id ? ' AND category_id = ?' : ''}
                ${power_id ? ' AND power_id = ?' : ''}

                UNION ALL

                -- Purchases (+)
                SELECT d.maker_id, d.category_id, d.power_id, 0 AS opening_qty, d.qty AS purchase_qty, 0 AS purchase_return_qty, 0 AS transfer_qty, 0 AS sales_qty, 0 AS sales_return_qty, d.qty, h.location_id
                FROM purchase_details d
                JOIN purchases h ON d.purchase_id = h.id
                WHERE h.fiscal_year_id = ?
                ${location_id ? ' AND h.location_id = ?' : ''}
                ${maker_id ? ' AND d.maker_id = ?' : ''}
                ${category_id ? ' AND d.category_id = ?' : ''}
                ${power_id ? ' AND d.power_id = ?' : ''}

                UNION ALL

                -- Purchase Returns (-)
                SELECT d.maker_id, d.category_id, d.power_id, 0 AS opening_qty, 0 AS purchase_qty, d.qty AS purchase_return_qty, 0 AS transfer_qty, 0 AS sales_qty, 0 AS sales_return_qty, -d.qty, h.location_id
                FROM purchase_return_details d
                JOIN purchase_returns h ON d.purchase_return_id = h.id
                WHERE h.fiscal_year_id = ?
                ${location_id ? ' AND h.location_id = ?' : ''}
                ${maker_id ? ' AND d.maker_id = ?' : ''}
                ${category_id ? ' AND d.category_id = ?' : ''}
                ${power_id ? ' AND d.power_id = ?' : ''}

                UNION ALL

                -- Transfers Out (-)
                SELECT d.maker_id, d.category_id, d.power_id, 0 AS opening_qty, 0 AS purchase_qty, 0 AS purchase_return_qty, -d.qty AS transfer_qty, 0 AS sales_qty, 0 AS sales_return_qty, -d.qty, h.from_location_id AS location_id
                FROM transfer_details d
                JOIN transfers h ON d.transfer_id = h.id
                WHERE h.fiscal_year_id = ?
                ${location_id ? ' AND h.from_location_id = ?' : ''}
                ${maker_id ? ' AND d.maker_id = ?' : ''}
                ${category_id ? ' AND d.category_id = ?' : ''}
                ${power_id ? ' AND d.power_id = ?' : ''}

                UNION ALL

                -- Transfers In (+)
                SELECT d.maker_id, d.category_id, d.power_id, 0 AS opening_qty, 0 AS purchase_qty, 0 AS purchase_return_qty, d.qty AS transfer_qty, 0 AS sales_qty, 0 AS sales_return_qty, d.qty, h.to_location_id AS location_id
                FROM transfer_details d
                JOIN transfers h ON d.transfer_id = h.id
                WHERE h.fiscal_year_id = ?
                ${location_id ? ' AND h.to_location_id = ?' : ''}
                ${maker_id ? ' AND d.maker_id = ?' : ''}
                ${category_id ? ' AND d.category_id = ?' : ''}
                ${power_id ? ' AND d.power_id = ?' : ''}

                UNION ALL

                -- Sales (-)
                SELECT d.maker_id, d.category_id, d.power_id, 0 AS opening_qty, 0 AS purchase_qty, 0 AS purchase_return_qty, 0 AS transfer_qty, d.qty AS sales_qty, 0 AS sales_return_qty, -d.qty, h.location_id
                FROM sales_details d
                JOIN sales h ON d.sale_id = h.id
                WHERE h.fiscal_year_id = ?
                ${location_id ? ' AND h.location_id = ?' : ''}
                ${maker_id ? ' AND d.maker_id = ?' : ''}
                ${category_id ? ' AND d.category_id = ?' : ''}
                ${power_id ? ' AND d.power_id = ?' : ''}

                UNION ALL

                -- Sales Returns (+)
                SELECT d.maker_id, d.category_id, d.power_id, 0 AS opening_qty, 0 AS purchase_qty, 0 AS purchase_return_qty, 0 AS transfer_qty, 0 AS sales_qty, d.qty AS sales_return_qty, d.qty, h.location_id
                FROM sales_return_details d
                JOIN sales_returns h ON d.sales_return_id = h.id
                WHERE h.fiscal_year_id = ?
                ${location_id ? ' AND h.location_id = ?' : ''}
                ${maker_id ? ' AND d.maker_id = ?' : ''}
                ${category_id ? ' AND d.category_id = ?' : ''}
                ${power_id ? ' AND d.power_id = ?' : ''}
            ) AS stock_data
            JOIN makers     m ON stock_data.maker_id    = m.id
            JOIN categories c ON stock_data.category_id = c.id
            LEFT JOIN powers p ON stock_data.power_id   = p.id
            GROUP BY m.id, c.id, p.id
        `;

        const subQueryParams = [fiscal_year_id];
        if (location_id) subQueryParams.push(location_id);
        if (maker_id) subQueryParams.push(maker_id);
        if (category_id) subQueryParams.push(category_id);
        if (power_id) subQueryParams.push(power_id);

        const params = [
            ...subQueryParams, // stock_opening_balances
            ...subQueryParams, // purchases
            ...subQueryParams, // purchase_returns
            ...subQueryParams, // transfers out
            ...subQueryParams, // transfers in
            ...subQueryParams, // sales
            ...subQueryParams  // sales_returns
        ];

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── Transfer Notifications Endpoints ──
router.get('/pending-transfer-requests', async (req, res) => {
    try {
        const { location_id } = req.query;
        if (!location_id) return res.status(400).json({ error: 'Location ID required' });

        const sql = `
            SELECT h.*, l.name as from_location_name,
                   d.maker_id, d.category_id, d.power_id, d.qty, d.stock_received,
                   m.name as maker_name, c.name as category_name, p.power
            FROM transfer_requests h
            JOIN transfer_request_details d ON h.id = d.request_id
            JOIN locations l ON h.location_id = l.id
            JOIN makers m ON d.maker_id = m.id
            JOIN categories c ON d.category_id = c.id
            LEFT JOIN powers p ON d.power_id = p.id
            WHERE h.to_location_id = ? AND h.status = 'PENDING' AND h.notification_seen = 0
            ORDER BY h.id DESC
        `;
        const [rows] = await db.query(sql, [location_id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/acknowledge-transfer-request/:id', async (req, res) => {
    try {
        await db.query(`UPDATE transfer_requests SET status = 'TRANSFERRED', notification_seen = 1 WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helper to check for duplicate Lot/SNo globally (Type-Specific)
router.get('/check-duplicate-item', async (req, res) => {
    try {
        const { lot_no, sno, type } = req.query;
        if (!lot_no || !sno || sno === '0' || sno === '') {
            return res.json({ exists: false });
        }

        let conflict = null;

        if (type === 'PURCHASE') {
             // Check Purchases Only
            [[conflict]] = await db.query(
                `SELECT h.trans_no FROM purchase_details d 
                 JOIN purchases h ON d.purchase_id = h.id 
                 WHERE d.lot_no = ? AND d.sno = ?`, 
                [lot_no, sno]
            );
        } else if (type === 'STOCK_OPENING') {
            // Check Stock Opening Only
            [[conflict]] = await db.query(
                `SELECT trans_no FROM stock_opening_balances 
                 WHERE lot_no = ? AND sno = ?`, 
                [lot_no, sno]
            );
        }

        if (conflict) {
            return res.json({ 
                exists: true, 
                trans_no: conflict.trans_no 
            });
        }

        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
