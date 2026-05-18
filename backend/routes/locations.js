const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/locations  ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const [locs] = await db.query(`
            SELECT l.*, 
                   cli.Address, cli.Contact, cli.Email, cli.NTNo, cli.GSTNo, cli.FaxNo
            FROM locations l
            LEFT JOIN company_location_info cli ON l.id = cli.location_id
            ORDER BY l.is_head_office DESC, l.name
        `);
        res.json(locs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/locations  ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
    let { code, name, is_head_office, Address, Contact, Email, NTNo, GSTNo, FaxNo } = req.body;
    try {
        await db.query('START TRANSACTION');
        // Auto-generate code if not provided
        if (!code && name) {
            code = name.trim().substring(0, 3).toUpperCase();
        }

        const [result] = await db.query(
            'INSERT INTO locations (code, name, is_head_office, is_active) VALUES (?, ?, ?, TRUE)',
            [code.toUpperCase(), name.toUpperCase(), is_head_office || false]
        );
        const location_id = result.insertId;

        const [companyRows] = await db.query('SELECT id FROM company_info LIMIT 1');
        if (companyRows.length > 0) {
            const company_id = companyRows[0].id;
            await db.query(
                'INSERT INTO company_location_info (company_id, location_id, Address, Contact, Email, NTNo, GSTNo, FaxNo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [company_id, location_id, Address || null, Contact || null, Email || null, NTNo || null, GSTNo || null, FaxNo || null]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, id: location_id });
    } catch (err) {
        await db.query('ROLLBACK');
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Location code or name already exists' });
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/locations/:id  ───────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const { code, name, is_active, Address, Contact, Email, NTNo, GSTNo, FaxNo } = req.body;
    const location_id = req.params.id;
    try {
        await db.query('START TRANSACTION');
        await db.query('UPDATE locations SET code=?, name=?, is_active=? WHERE id=?', [code.toUpperCase(), name.toUpperCase(), is_active, location_id]);
        
        const [companyRows] = await db.query('SELECT id FROM company_info LIMIT 1');
        if (companyRows.length > 0) {
            const company_id = companyRows[0].id;
            const [existing] = await db.query('SELECT id FROM company_location_info WHERE company_id = ? AND location_id = ?', [company_id, location_id]);
            if (existing.length > 0) {
                await db.query(
                    'UPDATE company_location_info SET Address=?, Contact=?, Email=?, NTNo=?, GSTNo=?, FaxNo=? WHERE id=?',
                    [Address || null, Contact || null, Email || null, NTNo || null, GSTNo || null, FaxNo || null, existing[0].id]
                );
            } else {
                await db.query(
                    'INSERT INTO company_location_info (company_id, location_id, Address, Contact, Email, NTNo, GSTNo, FaxNo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [company_id, location_id, Address || null, Contact || null, Email || null, NTNo || null, GSTNo || null, FaxNo || null]
                );
            }
        }
        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Location code or name already exists' });
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/locations/:id  ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        // Prevent deleting HEAD OFFICE
        const [[loc]] = await db.query('SELECT is_head_office FROM locations WHERE id=?', [req.params.id]);
        if (loc && loc.is_head_office) return res.status(400).json({ error: 'Cannot delete HEAD OFFICE' });
        await db.query('DELETE FROM locations WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
