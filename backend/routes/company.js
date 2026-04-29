const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get company info
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM company_info LIMIT 1');
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Company info not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
