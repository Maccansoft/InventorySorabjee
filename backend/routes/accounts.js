const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/accounts  ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const { role, location_id, is_head_office, tree } = req.query;

    try {
        let sql = `
            SELECT coa.*, loc.name as location_name 
            FROM chart_of_accounts coa 
            LEFT JOIN locations loc ON coa.location_id = loc.id
        `;
        let params = [];

        // Proper filtering for normal users
        if (role !== 'SUPER_ADMIN' || is_head_office !== 'true') {
            sql += ' WHERE coa.location_id IS NULL OR coa.location_id = ?';
            params.push(location_id);
        }

        sql += ' ORDER BY coa.level, coa.account_code';
        const [accounts] = await db.query(sql, params);

        if (tree) {
            const isSuperAdminFullView = role === 'SUPER_ADMIN' && is_head_office === 'true';

            const buildTree = (parentId = null) => {
                let items = accounts.filter(a => a.parent_id === parentId);

                // If Super Admin view, inject virtual location nodes for non-main accounts
                if (isSuperAdminFullView && items.some(a => a.location_id)) {
                    const grouped = {};
                    const nonLocationItems = [];

                    items.forEach(item => {
                        if (item.location_id) {
                            if (!grouped[item.location_id]) {
                                grouped[item.location_id] = {
                                    id: `vloc-${item.location_id}-parent-${parentId || 'root'}`,
                                    account_name: item.location_name || 'UNKNOWN LOCATION',
                                    account_code: 'LOC',
                                    is_virtual: true,
                                    children: []
                                };
                            }
                            grouped[item.location_id].children.push({
                                ...item,
                                children: buildTree(item.id)
                            });
                        } else {
                            nonLocationItems.push({
                                ...item,
                                children: buildTree(item.id)
                            });
                        }
                    });

                    return [...nonLocationItems, ...Object.values(grouped)];
                }

                return items.map(a => ({
                    ...a,
                    children: buildTree(a.id)
                }));
            };

            return res.json(buildTree());
        }

        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/accounts/create  ─────────────────────────────────────────────
router.post('/create', async (req, res) => {
    const { account_name, parent_id, is_active, statement_type, inventory_module, location_id, created_by } = req.body;

    try {
        let newCode = '';
        let level = 1;
        let account_type = '';

        if (!parent_id) return res.status(400).json({ error: 'parent_id is required' });

        const [[parentAccount]] = await db.query(
            'SELECT * FROM chart_of_accounts WHERE id = ?',
            [parent_id]
        );

        if (!parentAccount) return res.status(404).json({ error: 'Parent account not found' });

        level = parentAccount.level + 1;
        account_type = parentAccount.account_type;

        // Find the maximum existing suffix under this parent to generate next code
        const [[{ maxCode }]] = await db.query(
            'SELECT MAX(account_code) as maxCode FROM chart_of_accounts WHERE parent_id = ?',
            [parent_id]
        );

        let nextNum = 1;
        if (maxCode) {
            const parts = maxCode.split('-');
            const lastPart = parts[parts.length - 1];
            nextNum = parseInt(lastPart) + 1;
        }

        const nextNumber = String(nextNum).padStart(3, '0');
        newCode = `${parentAccount.account_code}-${nextNumber}`;

        const [result] = await db.query(
            `INSERT INTO chart_of_accounts
             (account_code, account_name, parent_id, level, account_type, is_main, is_active, statement_type, inventory_module, location_id, created_by)
             VALUES (?, ?, ?, ?, ?, FALSE, ?, ?, ?, ?, ?)`,
            [
                newCode,
                account_name,
                parent_id,
                level,
                account_type,
                is_active ?? true,
                statement_type || parentAccount.statement_type,
                inventory_module || 'NONE',
                location_id || null,
                created_by || null
            ]
        );

        res.json({ success: true, id: result.insertId, account_code: newCode });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Error creating account' });
    }
});

router.put('/:id', async (req, res) => {
    const { account_name, is_active, statement_type, inventory_module } = req.body;
    try {
        await db.query(
            'UPDATE chart_of_accounts SET account_name = ?, is_active = ?, statement_type = ?, inventory_module = ? WHERE id = ?',
            [account_name, is_active, statement_type, inventory_module, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM chart_of_accounts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
