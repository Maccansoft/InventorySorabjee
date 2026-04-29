const express = require('express');
const router = express.Router();
const db = require('../db');

// GET ledger for a specific account
// Query: ?fromDate=...&toDate=...&location_id=...&fiscal_year_id=...&all_locations=true
router.get('/:accountId', async (req, res) => {
    const { fromDate, toDate, location_id, fiscal_year_id, all_locations } = req.query;
    const { accountId } = req.params;

    const locFilter = location_id && all_locations !== 'true' ? ' AND v.location_id = ?' : '';
    const fyFilter = fiscal_year_id ? ' AND v.fiscal_year_id = ?' : '';
    const locParam = (location_id && all_locations !== 'true') ? [location_id] : [];
    const fyParam = fiscal_year_id ? [fiscal_year_id] : [];

    try {
        let openingBalance = 0;
        if (fromDate) {
            const [[{ opening }]] = await db.query(`
                SELECT COALESCE(SUM(ve.dr_amount - ve.cr_amount), 0) as opening
                FROM voucher_entries ve
                JOIN vouchers v ON ve.voucher_id = v.id
                WHERE ve.account_id = ? AND v.date < ?
                ${locFilter}${fyFilter}
            `, [accountId, fromDate, ...locParam, ...fyParam]);
            openingBalance = parseFloat(opening || 0);
        }

        let query = `
            SELECT ve.*, v.date, v.voucher_no, v.voucher_type
            FROM voucher_entries ve
            JOIN vouchers v ON ve.voucher_id = v.id
            WHERE ve.account_id = ?
        `;
        const params = [accountId];

        if (fromDate && toDate) {
            query += ` AND v.date BETWEEN ? AND ?`;
            params.push(fromDate, toDate);
        }
        params.push(...locParam, ...fyParam);
        if (locFilter) query += locFilter;
        if (fyFilter) query += fyFilter;

        query += ` ORDER BY v.date ASC, v.id ASC`;

        const [entries] = await db.query(query, params);

        let balance = openingBalance;
        const result = [];

        if (fromDate) {
            result.push({
                date: fromDate,
                voucher_no: '—',
                voucher_type: 'OPENING',
                description: 'Opening Balance',
                dr_amount: openingBalance > 0 ? openingBalance : 0,
                cr_amount: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                balance: openingBalance
            });
        }

        entries.forEach(e => {
            balance += parseFloat(e.dr_amount) - parseFloat(e.cr_amount);
            result.push({ ...e, balance });
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
