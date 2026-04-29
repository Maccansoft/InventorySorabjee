const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { username, password, location_id, fiscal_year_id } = req.body;

    try {
        // Get user
        const [[user]] = await db.query(
            'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
            [username]
        );

        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid username or password' });

        // Validate fiscal year
        const [[fy]] = await db.query(
            'SELECT * FROM fiscal_years WHERE id = ? AND is_active = TRUE',
            [fiscal_year_id]
        );
        if (!fy) return res.status(400).json({ error: 'Invalid or inactive fiscal year' });

        // Validate location
        const [[loc]] = await db.query(
            'SELECT * FROM locations WHERE id = ? AND is_active = TRUE',
            [location_id]
        );
        if (!loc) return res.status(400).json({ error: 'Invalid or inactive location' });

        const userRole = (user.role || '').toString().trim().toUpperCase();
        const isHeadOffice = !!loc.is_head_office;

        // HEAD OFFICE access: only SUPER_ADMIN allowed
        if (isHeadOffice && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'HEAD OFFICE login is restricted to Super Admin only' });
        }

        // Non-SUPER_ADMIN must belong to the location they are logging into
        if (userRole !== 'SUPER_ADMIN') {
            if (parseInt(user.location_id) !== parseInt(location_id)) {
                return res.status(403).json({ error: 'You are not authorized for this location' });
            }
        }

        // Get user permissions
        const [permissions] = await db.query(
            'SELECT permission FROM user_roles WHERE user_id = ?',
            [user.id]
        );

        const userData = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            location_id: parseInt(location_id),
            location_name: loc.name,
            location_code: loc.code || 'XX',
            is_head_office: loc.is_head_office,
            fiscal_year_id: parseInt(fiscal_year_id),
            fiscal_year_label: fy.label,
            fiscal_year_start: fy.start_date,
            fiscal_year_end: fy.end_date,
            fiscal_year_closed: fy.is_closed,
            permissions: permissions.map(p => p.permission)
        };

        const token = require('jsonwebtoken').sign(userData, process.env.JWT_SECRET, { expiresIn: '12h' });

        res.json({
            success: true,
            token,
            user: userData
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/auth/locations ────────────────────────────────────────────────
router.get('/locations', async (req, res) => {
    try {
        const [locs] = await db.query('SELECT * FROM locations WHERE is_active = TRUE ORDER BY is_head_office DESC, name');
        res.json(locs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/auth/fiscal-years ─────────────────────────────────────────────
router.get('/fiscal-years', async (req, res) => {
    try {
        const [fys] = await db.query('SELECT * FROM fiscal_years WHERE is_active = TRUE ORDER BY start_date DESC');
        res.json(fys);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
