const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/accounts  ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const { role, location_id, is_head_office, tree } = req.query;

    try {
        let sql = `
            SELECT 
                coa.*, 
                loc.name as location_name,
                parent.account_name as parent_name,
                parent.account_code as parent_code,
                creator.username as creator_name
            FROM chart_of_accounts coa 
            LEFT JOIN locations loc ON coa.location_id = loc.id
            LEFT JOIN chart_of_accounts parent ON coa.parent_id = parent.id
            LEFT JOIN users creator ON coa.created_by = creator.id
        `;
        let params = [];

        // Proper filtering for normal users
        if (role !== 'SUPER_ADMIN') {
            sql += ' WHERE coa.location_id IS NULL OR coa.location_id = ?';
            params.push(location_id);
        }

        sql += ' ORDER BY coa.account_code ASC';
        const [accounts] = await db.query(sql, params);

        if (tree) {
            const isSuperAdminFullView = role === 'SUPER_ADMIN';

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

router.post('/import', async (req, res) => {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ error: 'No data rows provided for import.' });
    }

    let imported = 0;
    let failed = 0;
    let errors = [];

    const getVal = (row, key) => {
        if (row[key] !== undefined) return row[key];
        if (row[key.toLowerCase()] !== undefined) return row[key.toLowerCase()];
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (foundKey) return row[foundKey];
        return undefined;
    };

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Preload locations
        const [locationsResult] = await connection.query('SELECT id, name FROM locations');
        const locationsMap = new Map();
        for (const loc of locationsResult) {
            if (loc.name) {
                locationsMap.set(loc.name.trim().toUpperCase(), loc.id);
            }
        }

        // 2. Preload existing accounts for uniqueness and parent lookup
        const [accountsResult] = await connection.query('SELECT id, account_code, location_id, level, account_type FROM chart_of_accounts');
        
        // Track uniqueness keys: `${account_code}_${location_id}`
        const existingUniqueKeys = new Set();
        // Group by account_code for parent resolution
        const coaCache = new Map();

        for (const acc of accountsResult) {
            const codeUpper = String(acc.account_code).trim().toUpperCase();
            const locId = acc.location_id === null ? 'null' : String(acc.location_id);
            existingUniqueKeys.add(`${codeUpper}_${locId}`);

            if (!coaCache.has(codeUpper)) {
                coaCache.set(codeUpper, []);
            }
            coaCache.get(codeUpper).push(acc);
        }

        // 3. Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIndex = i + 2; // header is row 1
            try {
                // Get values
                const rawCode = getVal(row, 'account_code');
                const rawName = getVal(row, 'account_name');
                const rawType = getVal(row, 'account_type');
                const rawLoc = getVal(row, 'location');
                const rawParentCode = getVal(row, 'parent_code');
                const rawIsMain = getVal(row, 'is_main');
                const rawIsActive = getVal(row, 'is_active');
                const rawStmtType = getVal(row, 'statement_type');
                const rawInvMod = getVal(row, 'inventory_module');

                // Basic validation
                if (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') {
                    throw new Error("Missing required field: 'account_code'");
                }
                if (rawName === undefined || rawName === null || String(rawName).trim() === '') {
                    throw new Error("Missing required field: 'account_name'");
                }
                if (rawType === undefined || rawType === null || String(rawType).trim() === '') {
                    throw new Error("Missing required field: 'account_type'");
                }
                if (rawLoc === undefined || rawLoc === null || String(rawLoc).trim() === '') {
                    throw new Error("Missing required field: 'location'");
                }

                const accountCode = String(rawCode).trim();
                const accountName = String(rawName).trim();
                const accountType = String(rawType).trim().toUpperCase();
                const locationStr = String(rawLoc).trim().toUpperCase();

                // Validate enums
                const statementType = rawStmtType !== undefined && rawStmtType !== null && String(rawStmtType).trim() !== ''
                    ? String(rawStmtType).trim().toUpperCase()
                    : 'BALANCE_SHEET';
                if (!['BALANCE_SHEET', 'PROFIT_LOSS', 'BOTH'].includes(statementType)) {
                    throw new Error(`Invalid statement_type: '${statementType}'. Must be BALANCE_SHEET, PROFIT_LOSS, or BOTH`);
                }

                const inventoryModule = rawInvMod !== undefined && rawInvMod !== null && String(rawInvMod).trim() !== ''
                    ? String(rawInvMod).trim().toUpperCase()
                    : 'NONE';
                if (!['STOCK_PURCHASE', 'PURCHASE_RETURN', 'SALES_INVOICE', 'SALES_RETURN', 'NONE'].includes(inventoryModule)) {
                    throw new Error(`Invalid inventory_module: '${inventoryModule}'. Must be STOCK_PURCHASE, PURCHASE_RETURN, SALES_INVOICE, SALES_RETURN, or NONE`);
                }

                // Parse booleans
                const isMain = (rawIsMain === 1 || String(rawIsMain).toLowerCase() === 'true' || String(rawIsMain).trim() === '1') ? 1 : 0;
                const isActive = (rawIsActive === undefined || rawIsActive === null || rawIsActive === 1 || String(rawIsActive).toLowerCase() === 'true' || String(rawIsActive).trim() === '1') ? 1 : 0;

                // Resolve Location
                let resolvedLocationId = null;
                if (locationStr !== 'ALL') {
                    if (locationsMap.has(locationStr)) {
                        resolvedLocationId = locationsMap.get(locationStr);
                    } else {
                        throw new Error(`Invalid location: ${rawLoc}`);
                    }
                }

                // Uniqueness constraint check (account_code + location_id)
                const codeUpper = accountCode.toUpperCase();
                const locKeyPart = resolvedLocationId === null ? 'null' : String(resolvedLocationId);
                const uniqueKey = `${codeUpper}_${locKeyPart}`;
                if (existingUniqueKeys.has(uniqueKey)) {
                    throw new Error("Duplicate account_code for same location");
                }

                // Resolve Parent
                let parentId = null;
                let calculatedLevel = 1;
                const parentCodeStr = rawParentCode !== undefined && rawParentCode !== null ? String(rawParentCode).trim() : '';

                if (parentCodeStr !== '') {
                    const candidates = coaCache.get(parentCodeStr.toUpperCase()) || [];
                    let parent = candidates.find(c => c.location_id === resolvedLocationId);
                    if (!parent) {
                        // Fallback to global (null)
                        parent = candidates.find(c => c.location_id === null);
                    }

                    if (!parent) {
                        throw new Error(`Parent account with code '${parentCodeStr}' not found for current location or global scope`);
                    }

                    parentId = parent.id;
                    calculatedLevel = parent.level + 1;
                } else {
                    // Top-level account
                    calculatedLevel = 1;
                }

                // Execute INSERT
                const createdBy = req.user ? req.user.id : null;
                const [result] = await connection.query(
                    `INSERT INTO chart_of_accounts 
                     (account_code, account_name, parent_id, level, account_type, is_main, is_active, statement_type, inventory_module, location_id, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        accountCode,
                        accountName,
                        parentId,
                        calculatedLevel,
                        accountType,
                        isMain,
                        isActive,
                        statementType,
                        inventoryModule,
                        resolvedLocationId,
                        createdBy
                    ]
                );

                // Insert successful! Update caches
                const newAccount = {
                    id: result.insertId,
                    account_code: accountCode,
                    location_id: resolvedLocationId,
                    level: calculatedLevel,
                    account_type: accountType
                };

                if (!coaCache.has(codeUpper)) {
                    coaCache.set(codeUpper, []);
                }
                coaCache.get(codeUpper).push(newAccount);
                existingUniqueKeys.add(uniqueKey);

                imported++;
            } catch (err) {
                failed++;
                errors.push({ row: rowIndex, error: err.message });
            }
        }

        await connection.commit();
        res.json({ success: true, total: rows.length, inserted: imported, imported, failed, errors });
    } catch (err) {
        await connection.rollback();
        console.error("Import Transaction Failed:", err);
        res.status(500).json({ error: "Import transaction failed: " + err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
