const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/fiscal-years  ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const [fys] = await db.query('SELECT * FROM fiscal_years ORDER BY start_date DESC');
        res.json(fys);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/fiscal-years  — open a new fiscal year ─────────────────────
router.post('/', async (req, res) => {
    const { label, start_date, end_date } = req.body;
    try {
        // Validate format: start must be Jul 1, end must be Jun 30
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (start.getMonth() !== 6 || start.getDate() !== 1) {
            return res.status(400).json({ error: 'Fiscal year must start on 01 July' });
        }
        if (end.getMonth() !== 5 || end.getDate() !== 30) {
            return res.status(400).json({ error: 'Fiscal year must end on 30 June' });
        }
        // Check no other active fiscal year overlaps
        const [existing] = await db.query(
            'SELECT id FROM fiscal_years WHERE is_closed = FALSE AND id != -1'
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Please close the current active fiscal year before opening a new one' });
        }

        const [result] = await db.query(
            'INSERT INTO fiscal_years (label, start_date, end_date, is_active, is_closed) VALUES (?, ?, ?, TRUE, FALSE)',
            [label, start_date, end_date]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Fiscal year label already exists' });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/fiscal-years/:id/close  — finalize & carry forward ──────────
router.post('/:id/close', async (req, res) => {
    const fyId = req.params.id;
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // 1. Get current fiscal year and prepare next one
        const [[fy]] = await conn.query('SELECT * FROM fiscal_years WHERE id=?', [fyId]);
        if (!fy) return res.status(404).json({ error: 'Fiscal year not found' });
        if (fy.is_closed) return res.status(400).json({ error: 'Fiscal year is already closed' });

        const nextStartY = new Date(fy.end_date).getFullYear();
        const nextLabel = `${nextStartY}-${nextStartY + 1}`;
        let [[nextFY]] = await conn.query('SELECT * FROM fiscal_years WHERE label=?', [nextLabel]);
        if (!nextFY) {
            const [newFY] = await conn.query(
                'INSERT INTO fiscal_years (label, start_date, end_date, is_active, is_closed) VALUES (?, ?, ?, TRUE, FALSE)',
                [nextLabel, `${nextStartY}-07-01`, `${nextStartY + 1}-06-30`]
            );
            const [[nf]] = await conn.query('SELECT * FROM fiscal_years WHERE id=?', [newFY.insertId]);
            nextFY = nf;
        }

        // 2. Get active locations and accounts
        const [locations] = await conn.query('SELECT * FROM locations WHERE is_active=TRUE');
        const [accounts] = await conn.query('SELECT * FROM chart_of_accounts');

        for (const loc of locations) {
            const locCode = (loc.code && loc.code !== 'XX') ? loc.code.toUpperCase() : 'HO';

            // ─── PART A: ACCOUNTS CARRY FORWARD ───
            const [summary] = await conn.query(`
                SELECT ve.account_id, SUM(ve.dr_amount - ve.cr_amount) as net_bal
                FROM voucher_entries ve
                JOIN vouchers v ON ve.voucher_id = v.id
                WHERE v.fiscal_year_id = ? AND v.location_id = ?
                GROUP BY ve.account_id
            `, [fyId, loc.id]);

            const balMap = {};
            for (const row of summary) balMap[row.account_id] = parseFloat(row.net_bal || 0);

            const [prevOB] = await conn.query('SELECT account_id, opening_balance FROM opening_balances WHERE fiscal_year_id=? AND location_id=?', [fyId, loc.id]);
            for (const ob of prevOB) balMap[ob.account_id] = (balMap[ob.account_id] || 0) + parseFloat(ob.opening_balance || 0);

            // P&L Calculation
            let netPL = 0;
            for (const acc of accounts) {
                if (acc.account_type === 'REVENUE') netPL += (balMap[acc.id] || 0);
                else if (acc.account_type === 'EXPENSE') netPL -= (balMap[acc.id] || 0);
            }

            // Find/Create Accumulated Profit Account
            let accumAccId = accounts.find(a => a.account_type === 'CAPITAL' && (a.account_name.toLowerCase().includes('profit') || a.account_name.toLowerCase().includes('accum')))?.id;
            if (!accumAccId) {
                const [[root]] = await conn.query("SELECT id FROM chart_of_accounts WHERE account_code='C01'");
                if (root) {
                    const [res] = await conn.query("INSERT INTO chart_of_accounts (account_code, account_name, parent_id, account_type, level, is_main, is_active) VALUES (?, 'Accumulated Profit/Loss', ?, 'CAPITAL', 2, 0, 1)", [`C01-${Date.now().toString().slice(-3)}`, root.id]);
                    accumAccId = res.insertId;
                }
            }

            const accValues = [];
            let accSeq = 1;
            for (const acc of accounts) {
                if (['ASSET', 'LIABILITY', 'CAPITAL'].includes(acc.account_type)) {
                    let bal = balMap[acc.id] || 0;
                    if (acc.id === accumAccId) bal += netPL;
                    if (bal !== 0) {
                        accValues.push([nextFY.id, acc.id, loc.id, bal, accSeq++, 'ACC_OPN', locCode, nextFY.label]);
                    }
                }
            }

            if (accValues.length) {
                await conn.query(`INSERT INTO opening_balances (fiscal_year_id, account_id, location_id, opening_balance, sequence_no, transaction_type, location_code, fiscal_year_label) VALUES ? ON DUPLICATE KEY UPDATE opening_balance = VALUES(opening_balance)`, [accValues]);
            }

            // ─── PART B: STOCK CARRY FORWARD ───
            const [stockRows] = await conn.query(`
                SELECT maker_id, category_id, power_id, lot_no, sno, mfg_date, exp_date, SUM(qty) as bal_qty, AVG(rate) as avg_rate
                FROM (
                    SELECT maker_id, category_id, power_id, lot_no, sno, mfg_date, exp_date, qty, rate FROM stock_opening_balances WHERE location_id=? AND fiscal_year_id=?
                    UNION ALL
                    SELECT d.maker_id, d.category_id, d.power_id, d.lot_no, d.sno, d.mfg_date, d.exp_date, d.qty, d.rate FROM purchase_details d JOIN purchases h ON d.purchase_id=h.id WHERE h.location_id=? AND h.fiscal_year_id=?
                    UNION ALL
                    SELECT d.maker_id, d.category_id, d.power_id, d.lot_no, d.sno, d.mfg_date, d.exp_date, -d.qty, d.rate FROM purchase_return_details d JOIN purchase_returns h ON d.purchase_return_id=h.id WHERE h.location_id=? AND h.fiscal_year_id=?
                    UNION ALL
                    SELECT d.maker_id, d.category_id, d.power_id, d.lot_no, d.sno, d.mfg_date, d.exp_date, -d.qty, d.rate FROM sales_details d JOIN sales h ON d.sale_id=h.id WHERE h.location_id=? AND h.fiscal_year_id=?
                    UNION ALL
                    SELECT d.maker_id, d.category_id, d.power_id, d.lot_no, d.sno, d.mfg_date, d.exp_date, d.qty, d.rate FROM sales_return_details d JOIN sales_returns h ON d.sales_return_id=h.id WHERE h.location_id=? AND h.fiscal_year_id=?
                    UNION ALL
                    SELECT d.maker_id, d.category_id, d.power_id, d.lot_no, d.sno, d.mfg_date, d.exp_date, -d.qty, d.rate FROM transfer_details d JOIN transfers h ON d.transfer_id=h.id WHERE h.from_location_id=? AND h.fiscal_year_id=?
                    UNION ALL
                    SELECT d.maker_id, d.category_id, d.power_id, d.lot_no, d.sno, d.mfg_date, d.exp_date, d.qty, d.rate FROM transfer_details d JOIN transfers h ON d.transfer_id=h.id WHERE h.to_location_id=? AND h.fiscal_year_id=?
                ) as t GROUP BY maker_id, category_id, power_id, lot_no, sno HAVING bal_qty > 0
            `, [loc.id, fyId, loc.id, fyId, loc.id, fyId, loc.id, fyId, loc.id, fyId, loc.id, fyId, loc.id, fyId]);

            const stockValues = [];
            let stockSeq = 1;
            for (const s of stockRows) {
                const trans_no = `OPN/${locCode}/${nextFY.label}/${String(stockSeq).padStart(4, '0')}`;
                stockValues.push([
                    trans_no, `${nextStartY}-07-01`, s.maker_id, s.category_id, s.power_id, s.lot_no, s.sno, 
                    s.bal_qty, s.avg_rate, s.bal_qty * s.avg_rate, loc.id, nextFY.id, s.mfg_date, s.exp_date,
                    stockSeq++, 'OPN', locCode, nextFY.label
                ]);
            }

            if (stockValues.length) {
                await conn.query(`INSERT INTO stock_opening_balances (trans_no, trans_date, maker_id, category_id, power_id, lot_no, sno, qty, rate, amount, location_id, fiscal_year_id, mfg_date, exp_date, sequence_no, transaction_type, location_code, fiscal_year_label) VALUES ?`, [stockValues]);
            }
        }

        await conn.query('UPDATE fiscal_years SET is_closed=TRUE, closed_at=NOW() WHERE id=?', [fyId]);
        await conn.commit();
        res.json({ success: true, message: 'Fiscal Year closed and balances carried forward (Accounts & Stock).' });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
