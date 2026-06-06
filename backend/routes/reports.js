const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to build location/fiscal year filter
function buildFilters(query, params, reqQuery, tableAlias = 'v') {
    if (reqQuery.fromDate && reqQuery.toDate) {
        query += ` AND ${tableAlias}.date BETWEEN ? AND ?`;
        params.push(reqQuery.fromDate, reqQuery.toDate);
    }
    if (reqQuery.location_id && reqQuery.all_locations !== 'true') {
        query += ` AND ${tableAlias}.location_id = ?`;
        params.push(reqQuery.location_id);
    }
    if (reqQuery.fiscal_year_id) {
        query += ` AND ${tableAlias}.fiscal_year_id = ?`;
        params.push(reqQuery.fiscal_year_id);
    }
    return { query, params };
}

// ── Trial Balance ─────────────────────────────────────────────────────────
router.get('/trial-balance', async (req, res) => {
    try {
        let query = `
            SELECT 
                coa.id, 
                coa.account_code, 
                coa.account_name, 
                coa.account_type,
                COALESCE(SUM(ve.dr_amount), 0) AS total_debit,
                COALESCE(SUM(ve.cr_amount), 0) AS total_credit
            FROM chart_of_accounts coa
            LEFT JOIN voucher_entries ve ON coa.id = ve.account_id
            LEFT JOIN vouchers v ON ve.voucher_id = v.id
            WHERE coa.is_active = TRUE
        `;
        let params = [];
        const f = buildFilters(query, params, req.query);
        query = f.query; params = f.params;

        query += `
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            HAVING total_debit > 0 OR total_credit > 0
            ORDER BY coa.account_code
        `;

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Profit & Loss ─────────────────────────────────────────────────────────
router.get('/profit-loss', async (req, res) => {
    try {
        let whereClause = "WHERE coa.statement_type IN ('PROFIT_LOSS', 'BOTH')";
        let params = [];
        const f = buildFilters(whereClause, params, req.query);
        whereClause = f.query; params = f.params;

        const [rows] = await db.query(`
            SELECT 
                coa.id, 
                coa.account_code, 
                coa.account_name, 
                coa.account_type,
                CASE 
                    WHEN coa.account_type = 'REVENUE' THEN COALESCE(SUM(ve.cr_amount - ve.dr_amount), 0)
                    WHEN coa.account_type = 'EXPENSE' THEN COALESCE(SUM(ve.dr_amount - ve.cr_amount), 0)
                    ELSE COALESCE(SUM(ve.cr_amount - ve.dr_amount), 0)
                END AS balance
            FROM chart_of_accounts coa
            JOIN voucher_entries ve ON coa.id = ve.account_id
            JOIN vouchers v ON ve.voucher_id = v.id
            ${whereClause}
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            ORDER BY coa.account_code
        `, params);

        const [[netRow]] = await db.query(`
            SELECT 
                (
                    SELECT COALESCE(SUM(ve.cr_amount - ve.dr_amount), 0)
                    FROM chart_of_accounts coa
                    JOIN voucher_entries ve ON coa.id = ve.account_id
                    JOIN vouchers v ON ve.voucher_id = v.id
                    ${whereClause} AND coa.account_type = 'REVENUE'
                ) - (
                    SELECT COALESCE(SUM(ve.dr_amount - ve.cr_amount), 0)
                    FROM chart_of_accounts coa
                    JOIN voucher_entries ve ON coa.id = ve.account_id
                    JOIN vouchers v ON ve.voucher_id = v.id
                    ${whereClause} AND coa.account_type = 'EXPENSE'
                ) AS net_profit
        `, params.concat(params));

        res.json({ rows, net_profit: netRow.net_profit });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ── Balance Sheet ─────────────────────────────────────────────────────────
router.get('/balance-sheet', async (req, res) => {
    try {
        let whereClause = "WHERE coa.statement_type IN ('BALANCE_SHEET', 'BOTH')";
        let params = [];
        const f = buildFilters(whereClause, params, req.query);
        whereClause = f.query; params = f.params;

        const [rows] = await db.query(`
            SELECT 
                coa.id, 
                coa.account_code, 
                coa.account_name, 
                coa.account_type,
                CASE 
                    WHEN coa.account_type = 'ASSET' THEN COALESCE(SUM(ve.dr_amount - ve.cr_amount), 0)
                    ELSE COALESCE(SUM(ve.cr_amount - ve.dr_amount), 0)
                END AS balance
            FROM chart_of_accounts coa
            JOIN voucher_entries ve ON coa.id = ve.account_id
            JOIN vouchers v ON ve.voucher_id = v.id
            ${whereClause}
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            ORDER BY coa.account_code
        `, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Dashboard Summary ────────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
    try {
        const { location_id, fiscal_year_id } = req.query;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const params = [startOfMonth, endOfMonth];
        const locFilter = location_id && req.query.all_locations !== 'true' ? ' AND location_id = ?' : '';
        const fyFilter = fiscal_year_id ? ' AND fiscal_year_id = ?' : '';
        const locParams = location_id && req.query.all_locations !== 'true' ? [location_id] : [];
        const fyParams = fiscal_year_id ? [fiscal_year_id] : [];

        const [[{ total_purchase }]] = await db.query(
            `SELECT COALESCE(SUM(total_amount), 0) as total_purchase FROM purchases WHERE (trans_date BETWEEN ? AND ?)${locFilter}${fyFilter}`,
            [...params, ...locParams, ...fyParams]
        );

        const [[{ total_sales }]] = await db.query(
            `SELECT COALESCE(SUM(total_amount), 0) as total_sales FROM sales WHERE (trans_date BETWEEN ? AND ?)${locFilter}${fyFilter}`,
            [...params, ...locParams, ...fyParams]
        );

        const [receipts] = await db.query(
            `SELECT paid_by, COALESCE(SUM(total_amount), 0) as amount FROM vouchers WHERE (date BETWEEN ? AND ?) AND voucher_type = 'RECEIPT'${locFilter}${fyFilter} GROUP BY paid_by`,
            [...params, ...locParams, ...fyParams]
        );

        const [payments] = await db.query(
            `SELECT paid_by, COALESCE(SUM(total_amount), 0) as amount FROM vouchers WHERE (date BETWEEN ? AND ?) AND voucher_type = 'PAYMENT'${locFilter}${fyFilter} GROUP BY paid_by`,
            [...params, ...locParams, ...fyParams]
        );

        let total_receipts = 0, receipt_cash = 0, receipt_online = 0, receipt_cheque = 0;
        receipts.forEach(r => {
            const amt = Number(r.amount);
            total_receipts += amt;
            if (r.paid_by === 'CASH') receipt_cash += amt;
            if (r.paid_by === 'ONLINE') receipt_online += amt;
            if (r.paid_by === 'CHEQUE') receipt_cheque += amt;
        });

        let total_payments = 0, payment_cash = 0, payment_online = 0, payment_cheque = 0;
        payments.forEach(p => {
            const amt = Number(p.amount);
            total_payments += amt;
            if (p.paid_by === 'CASH') payment_cash += amt;
            if (p.paid_by === 'ONLINE') payment_online += amt;
            if (p.paid_by === 'CHEQUE') payment_cheque += amt;
        });

        // Profit/Loss: Revenue - Expense
        const [[{ profit_loss }]] = await db.query(`
            SELECT 
                (
                    SELECT COALESCE(SUM(ve.cr_amount - ve.dr_amount), 0)
                    FROM chart_of_accounts coa
                    JOIN voucher_entries ve ON coa.id = ve.account_id
                    JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE (v.date BETWEEN ? AND ?) AND coa.account_type = 'REVENUE'${locFilter.replace('location_id', 'v.location_id')}${fyFilter.replace('fiscal_year_id', 'v.fiscal_year_id')}
                ) - (
                    SELECT COALESCE(SUM(ve.dr_amount - ve.cr_amount), 0)
                    FROM chart_of_accounts coa
                    JOIN voucher_entries ve ON coa.id = ve.account_id
                    JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE (v.date BETWEEN ? AND ?) AND coa.account_type = 'EXPENSE'${locFilter.replace('location_id', 'v.location_id')}${fyFilter.replace('fiscal_year_id', 'v.fiscal_year_id')}
                ) AS profit_loss
        `, [...params, ...locParams, ...fyParams, ...params, ...locParams, ...fyParams]);

        res.json({
            total_purchase,
            total_sales,
            total_receipts,
            receipt_cash,
            receipt_online,
            receipt_cheque,
            total_payments,
            payment_cash,
            payment_online,
            payment_cheque,
            profit_loss
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Helper to find a parent account by module mapping or fallback keywords
async function findParentAccount(moduleValue, fallbackKeyword) {
    // 1. Try by inventory_module mapping
    let [rows] = await db.query(
        'SELECT id, account_code, account_name FROM chart_of_accounts WHERE inventory_module = ?',
        [moduleValue]
    );
    if (rows.length > 0) return rows[0];

    // 2. Fallback matching
    [rows] = await db.query('SELECT id, account_code, account_name FROM chart_of_accounts');
    const match = rows.find(a => {
        const name = (a.account_name || '').toLowerCase();
        return name.includes(fallbackKeyword.toLowerCase()) || 
               (fallbackKeyword === 'receivable' && name === 'debtors') ||
               (fallbackKeyword === 'payable' && name === 'creditors');
    });
    return match || null;
}

// Helper to get all child leaf accounts recursively
async function getLeafAccountsUnderParent(parentId) {
    if (!parentId) return [];
    
    const [accounts] = await db.query('SELECT id, parent_id, is_main, account_code, account_name FROM chart_of_accounts');
    
    const parentIdSet = new Set();
    accounts.forEach(a => {
        if (a.is_main == 1 || a.is_main === true) {
            parentIdSet.add(a.id);
        }
        if (a.parent_id) {
            parentIdSet.add(a.parent_id);
        }
    });

    const getDescendants = (pid) => {
        let result = [];
        const directChildren = accounts.filter(a => a.parent_id === pid);
        directChildren.forEach(c => {
            result.push(c);
            result.push(...getDescendants(c.id));
        });
        return result;
    };

    const descendants = getDescendants(parentId);
    return descendants.filter(a => !parentIdSet.has(a.id));
}

// Receivables Report API
router.get('/receivables', async (req, res) => {
    const { fromDate, toDate, location_id, fiscal_year_id, all_locations } = req.query;

    try {
        const parentAcc = await findParentAccount('RECEIVABLES', 'receivable');
        if (!parentAcc) {
            return res.status(404).json({
                error: 'parent_not_found',
                message: 'No parent account with "Receivables" mapping or matching name found in the Chart of Accounts.'
            });
        }

        const childAccounts = await getLeafAccountsUnderParent(parentAcc.id);
        if (childAccounts.length === 0) {
            return res.json([]);
        }

        const childIds = childAccounts.map(c => c.id);
        let locFilter = '';
        let fyFilter = '';
        const queryParams = [];

        const openDateParam = fromDate || '1970-01-01';
        const fromDateParam = fromDate || '1970-01-01';
        const toDateParam = toDate || '9999-12-31';

        queryParams.push(openDateParam, fromDateParam, toDateParam, toDateParam);

        if (location_id && all_locations !== 'true') {
            locFilter = ' AND v.location_id = ?';
            queryParams.push(location_id);
        }
        if (fiscal_year_id) {
            fyFilter = ' AND v.fiscal_year_id = ?';
            queryParams.push(fiscal_year_id);
        }
        queryParams.push(childIds);

        const sql = `
            SELECT 
                coa.id,
                coa.account_code,
                coa.account_name,
                COALESCE(SUM(CASE WHEN v.date < ? THEN ve.dr_amount - ve.cr_amount ELSE 0 END), 0) AS opening_balance,
                COALESCE(SUM(CASE WHEN v.date BETWEEN ? AND ? THEN ve.dr_amount - ve.cr_amount ELSE 0 END), 0) AS period_balance,
                COALESCE(SUM(CASE WHEN v.date <= ? THEN ve.dr_amount - ve.cr_amount ELSE 0 END), 0) AS net_balance
            FROM chart_of_accounts coa
            LEFT JOIN voucher_entries ve ON coa.id = ve.account_id
            LEFT JOIN vouchers v ON ve.voucher_id = v.id ${locFilter} ${fyFilter}
            WHERE coa.id IN (?)
            GROUP BY coa.id, coa.account_code, coa.account_name
            ORDER BY coa.account_code
        `;

        const [rows] = await db.query(sql, queryParams);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Payables Report API
router.get('/payables', async (req, res) => {
    const { fromDate, toDate, location_id, fiscal_year_id, all_locations } = req.query;

    try {
        const parentAcc = await findParentAccount('PAYABLES', 'payable');
        if (!parentAcc) {
            return res.status(404).json({
                error: 'parent_not_found',
                message: 'No parent account with "Payables" mapping or matching name found in the Chart of Accounts.'
            });
        }

        const childAccounts = await getLeafAccountsUnderParent(parentAcc.id);
        if (childAccounts.length === 0) {
            return res.json([]);
        }

        const childIds = childAccounts.map(c => c.id);
        let locFilter = '';
        let fyFilter = '';
        const queryParams = [];

        const openDateParam = fromDate || '1970-01-01';
        const fromDateParam = fromDate || '1970-01-01';
        const toDateParam = toDate || '9999-12-31';

        queryParams.push(openDateParam, fromDateParam, toDateParam, toDateParam);

        if (location_id && all_locations !== 'true') {
            locFilter = ' AND v.location_id = ?';
            queryParams.push(location_id);
        }
        if (fiscal_year_id) {
            fyFilter = ' AND v.fiscal_year_id = ?';
            queryParams.push(fiscal_year_id);
        }
        queryParams.push(childIds);

        const sql = `
            SELECT 
                coa.id,
                coa.account_code,
                coa.account_name,
                COALESCE(SUM(CASE WHEN v.date < ? THEN ve.dr_amount - ve.cr_amount ELSE 0 END), 0) AS opening_balance,
                COALESCE(SUM(CASE WHEN v.date BETWEEN ? AND ? THEN ve.dr_amount - ve.cr_amount ELSE 0 END), 0) AS period_balance,
                COALESCE(SUM(CASE WHEN v.date <= ? THEN ve.dr_amount - ve.cr_amount ELSE 0 END), 0) AS net_balance
            FROM chart_of_accounts coa
            LEFT JOIN voucher_entries ve ON coa.id = ve.account_id
            LEFT JOIN vouchers v ON ve.voucher_id = v.id ${locFilter} ${fyFilter}
            WHERE coa.id IN (?)
            GROUP BY coa.id, coa.account_code, coa.account_name
            ORDER BY coa.account_code
        `;

        const [rows] = await db.query(sql, queryParams);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
