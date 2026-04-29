const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/locations  ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const [locs] = await db.query('SELECT * FROM locations ORDER BY is_head_office DESC, name');
        res.json(locs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/locations  ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
    let { code, name, is_head_office } = req.body;
    try {
        // Auto-generate code if not provided
        if (!code && name) {
            code = name.trim().substring(0, 3).toUpperCase();
        }

        const [result] = await db.query(
            'INSERT INTO locations (code, name, is_head_office, is_active) VALUES (?, ?, ?, TRUE)',
            [code.toUpperCase(), name.toUpperCase(), is_head_office || false]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Location code already exists' });
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/locations/:id  ───────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const { code, name, is_active } = req.body;
    try {
        await db.query('UPDATE locations SET code=?, name=?, is_active=? WHERE id=?', [code.toUpperCase(), name.toUpperCase(), is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Location code already exists' });
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
