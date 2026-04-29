const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// ── GET /api/users  — list users (SUPER_ADMIN: all, ADMIN: own location) ──
router.get('/', async (req, res) => {
    try {
        const { role, location_id } = req.query;
        let sql = `
      SELECT u.id, u.username, u.full_name, u.role, u.location_id, u.is_active, u.created_at,
             l.name as location_name
      FROM users u
      LEFT JOIN locations l ON u.location_id = l.id
      WHERE 1=1
    `;
        const params = [];

        if (role === 'ADMIN' && location_id) {
            sql += ' AND u.location_id = ?';
            params.push(location_id);
        }

        sql += ' ORDER BY u.role, u.full_name';
        const [users] = await db.query(sql, params);

        if (users.length > 0) {
            const userIds = users.map(u => u.id);
            const [allPerms] = await db.query(
                'SELECT user_id, permission FROM user_roles WHERE user_id IN (?)',
                [userIds]
            );

            // Map permissions back to users
            const permMap = allPerms.reduce((acc, p) => {
                if (!acc[p.user_id]) acc[p.user_id] = [];
                acc[p.user_id].push(p.permission);
                return acc;
            }, {});

            users.forEach(u => {
                u.permissions = permMap[u.id] || [];
            });
        }

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/users  — create user ────────────────────────────────────────
router.post('/', async (req, res) => {
    const { username, password, full_name, role, location_id, created_by, permissions } = req.body;

    try {
        // Super admin cannot create users for HEAD OFFICE
        if (role === 'SUPER_ADMIN') {
            return res.status(400).json({ error: 'Cannot create another Super Admin' });
        }

        // ADMIN users can only be created by SUPER_ADMIN for non-HO locations
        if (role === 'ADMIN') {
            const [[loc]] = await db.query('SELECT is_head_office FROM locations WHERE id = ?', [location_id]);
            if (loc && loc.is_head_office) {
                return res.status(400).json({ error: 'Cannot create ADMIN for HEAD OFFICE location' });
            }
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const [result] = await db.query(
            `INSERT INTO users (username, password, full_name, role, location_id, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
            [username, hashedPassword, full_name, role, location_id || null, created_by || null]
        );

        // Bulk Insert permissions
        if (permissions && permissions.length > 0) {
            const permValues = permissions.map(p => [result.insertId, p]);
            await db.query('INSERT INTO user_roles (user_id, permission) VALUES ?', [permValues]);
        }

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/users/:id  — edit user ───────────────────────────────────────
router.put('/:id', async (req, res) => {
    const { full_name, password, role, location_id, is_active, permissions } = req.body;
    try {
        let sql = 'UPDATE users SET full_name=?, role=?, location_id=?, is_active=?';
        const params = [full_name, role, location_id || null, is_active];
        if (password) {
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            sql += ', password=?';
            params.push(hashedPassword);
        }
        sql += ' WHERE id=?';
        params.push(req.params.id);
        await db.query(sql, params);

        // Replace permissions with bulk insertion
        await db.query('DELETE FROM user_roles WHERE user_id = ?', [req.params.id]);
        if (permissions && permissions.length > 0) {
            const permValues = permissions.map(p => [req.params.id, p]);
            await db.query('INSERT INTO user_roles (user_id, permission) VALUES ?', [permValues]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/users/change-password/:id — secure password update ──────────
router.put('/change-password/:id', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    try {
        // Validate password length
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Check if user exists
        const [[user]] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash password with salt rounds from environment
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Update database
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/users/:id  ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ? AND role != ?', [req.params.id, 'SUPER_ADMIN']);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/users/permissions ─────────────────────────────────────────────
router.get('/permissions', async (req, res) => {
    const allPermissions = [
        'VIEW_ACCOUNTS', 'CREATE_ACCOUNTS', 'EDIT_ACCOUNTS', 'DELETE_ACCOUNTS',
        'VIEW_VOUCHERS', 'CREATE_VOUCHERS', 'EDIT_VOUCHERS', 'DELETE_VOUCHERS',
        'VIEW_REPORTS', 'VIEW_LEDGER',
        'MANAGE_USERS'
    ];
    res.json(allPermissions);
});

module.exports = router;
