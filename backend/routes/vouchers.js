const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/vouchers  ─────────────────────────────────────────────────────
// Query params: ?type=RECEIPT&mode=CASH&fromDate=...&toDate=...&location_id=...&fiscal_year_id=...&all_locations=true
router.get('/', async (req, res) => {
    try {
        let sql = 'SELECT * FROM vouchers WHERE 1=1';
        const params = [];

        if (req.query.type) {
            sql += ' AND voucher_type = ?';
            params.push(req.query.type.toUpperCase());
        }
        if (req.query.mode && req.query.mode !== 'ALL') {
            sql += ' AND paid_by = ?';
            params.push(req.query.mode.toUpperCase());
        }
        if (req.query.fromDate && req.query.toDate) {
            sql += ' AND date BETWEEN ? AND ?';
            params.push(req.query.fromDate, req.query.toDate);
        }
        const { fiscal_year_id, all_locations } = req.query;
        let location_id = req.query.location_id;
        const { location_id: userLocId, role, is_head_office } = req.user;

        // Enforce location-based restrictions
        if (role !== 'SUPER_ADMIN' || !is_head_office) {
            location_id = userLocId;
        } else if (all_locations === 'true') {
            location_id = null;
        }
        
        if (location_id) {
            sql += ' AND location_id = ?';
            params.push(location_id);
        }
        if (fiscal_year_id) {
            sql += ' AND fiscal_year_id = ?';
            params.push(fiscal_year_id);
        }

        sql += ' ORDER BY id DESC';
        const [vouchers] = await db.query(sql, params);
        res.json(vouchers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/vouchers/next-no  ────────────────────────────────────────────
router.get('/next-no', async (req, res) => {
    try {
        const voucherType = (req.query.type || 'RECEIPT').toUpperCase();
        const location_id = req.query.location_id;
        const fiscal_year_id = req.query.fiscal_year_id;
        const typeCode = voucherType === 'PAYMENT' ? 'PV'
            : voucherType === 'RECEIPT' ? 'RV' : 'JV';

        const [[{ maxSeq }]] = await db.query(
            'SELECT MAX(sequence_no) as maxSeq FROM vouchers WHERE voucher_type = ? AND location_id = ? AND fiscal_year_id = ?',
            [voucherType, location_id, fiscal_year_id]
        );
        const nextSeq = (maxSeq || 0) + 1;

        let locCode = 'HO';
        if (location_id) {
            const [[loc]] = await db.query('SELECT code FROM locations WHERE id = ?', [location_id]);
            if (loc?.code && loc.code !== 'XX') locCode = loc.code.toUpperCase();
        }

        const [[fy]] = await db.query('SELECT label FROM fiscal_years WHERE id = ?', [fiscal_year_id]);
        const fyLabel = fy ? fy.label : new Date().getFullYear();

        res.json({ 
            voucher_no: `${typeCode}/${locCode}/${fyLabel}/${String(nextSeq).padStart(4, '0')}`,
            sequence_no: nextSeq 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/vouchers/:id  — with full entries + account details ──────────
router.get('/:id', async (req, res) => {
    try {
        const [[voucher]] = await db.query(
            'SELECT * FROM vouchers WHERE id = ?', [req.params.id]
        );
        if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

        const [entries] = await db.query(`
            SELECT ve.*, coa.account_code, coa.account_name, coa.account_type
            FROM voucher_entries ve
            JOIN chart_of_accounts coa ON ve.account_id = coa.id
            WHERE ve.voucher_id = ?
            ORDER BY ve.id
        `, [req.params.id]);

        res.json({ ...voucher, entries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── POST /api/vouchers  — create ──────────────────────────────────────────
router.post('/', async (req, res) => {
    const {
        voucher_type, date, description,
        cheque_no, cheque_date, bank_name,
        paid_by, total_amount, entries,
        location_id, fiscal_year_id
    } = req.body;

    if (!entries || entries.length === 0) return res.status(400).json({ error: 'At least one entry is required' });

    // Check if fiscal year is closed
    if (fiscal_year_id) {
        const [[fy]] = await db.query('SELECT is_closed FROM fiscal_years WHERE id=?', [fiscal_year_id]);
        if (fy && fy.is_closed) {
            return res.status(403).json({ error: 'Cannot add transactions to a closed fiscal year' });
        }
    }

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // 1. Generate Voucher Number (Standardized)
        const typeCode = (voucher_type === 'PAYMENT') ? 'PV' : (voucher_type === 'RECEIPT') ? 'RV' : 'JV';
        const [[{ maxSeq }]] = await conn.query(
            'SELECT MAX(sequence_no) as maxSeq FROM vouchers WHERE voucher_type = ? AND location_id = ? AND fiscal_year_id = ?',
            [voucher_type, location_id, fiscal_year_id]
        );
        const nextSeq = (maxSeq || 0) + 1;

        let locCode = 'HO';
        if (location_id) {
            const [[loc]] = await conn.query('SELECT code FROM locations WHERE id = ?', [location_id]);
            if (loc?.code && loc.code !== 'XX') locCode = loc.code.toUpperCase();
        }

        const [[fy]] = await conn.query('SELECT label FROM fiscal_years WHERE id = ?', [fiscal_year_id]);
        const fyLabel = fy ? fy.label : new Date().getFullYear();
        const voucher_no = `${typeCode}/${locCode}/${fyLabel}/${String(nextSeq).padStart(4, '0')}`;

        // 2. Insert Voucher Header
        const [vRes] = await conn.query(
            `INSERT INTO vouchers
             (voucher_no, voucher_type, date, description, cheque_no, cheque_date, bank_name, paid_by, total_amount, location_id, fiscal_year_id, sequence_no, transaction_type, location_code, fiscal_year_label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [voucher_no, voucher_type, date, description, cheque_no || null, cheque_date || null, bank_name || null, paid_by, total_amount, location_id || null, fiscal_year_id || null, nextSeq, typeCode, locCode, fyLabel]
        );

        const voucherId = vRes.insertId;

        // 3. Bulk Insert Entries
        const entryValues = entries.map(e => [
            voucherId, e.account_id, e.dr_amount || 0, e.cr_amount || 0, e.description || description
        ]);
        await conn.query(
            `INSERT INTO voucher_entries (voucher_id, account_id, dr_amount, cr_amount, description) VALUES ?`,
            [entryValues]
        );

        await conn.commit();
        res.json({ success: true, id: voucherId, voucher_no });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ── PUT /api/vouchers/:id  — edit header + replace entries ────────────────
router.put('/:id', async (req, res) => {
    const {
        date, description,
        cheque_no, cheque_date, bank_name,
        paid_by, total_amount, entries,
        fiscal_year_id
    } = req.body;

    // Check if fiscal year is closed
    if (fiscal_year_id) {
        const [[fy]] = await db.query('SELECT is_closed FROM fiscal_years WHERE id=?', [fiscal_year_id]);
        if (fy && fy.is_closed) {
            return res.status(403).json({ error: 'Cannot edit transactions in a closed fiscal year' });
        }
    }

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        await conn.query(
            `UPDATE vouchers
             SET date=?, description=?, cheque_no=?, cheque_date=?, bank_name=?, paid_by=?, total_amount=?
             WHERE id=?`,
            [date, description, cheque_no || null, cheque_date || null, bank_name || null, paid_by || 'CASH', total_amount, req.params.id]
        );

        // Replace all entries using bulk delete/insert
        await conn.query('DELETE FROM voucher_entries WHERE voucher_id = ?', [req.params.id]);
        if (entries?.length > 0) {
            const entryValues = entries.map(e => [
                req.params.id, e.account_id, e.dr_amount || 0, e.cr_amount || 0, e.description || description
            ]);
            await conn.query(
                `INSERT INTO voucher_entries (voucher_id, account_id, dr_amount, cr_amount, description) VALUES ?`,
                [entryValues]
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

// ── DELETE /api/vouchers/:id  ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [[voucher]] = await conn.query('SELECT fiscal_year_id FROM vouchers WHERE id=?', [req.params.id]);
        if (voucher?.fiscal_year_id) {
            const [[fy]] = await conn.query('SELECT is_closed FROM fiscal_years WHERE id=?', [voucher.fiscal_year_id]);
            if (fy?.is_closed) {
                await conn.rollback();
                return res.status(403).json({ error: 'Cannot delete transactions from a closed fiscal year' });
            }
        }

        // Deleting from vouchers will cascade to voucher_entries
        await conn.query('DELETE FROM vouchers WHERE id = ?', [req.params.id]);

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});


module.exports = router;
