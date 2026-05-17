const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get company info (merged with location specifics if location_id provided)
router.get('/', async (req, res) => {
    try {
        const { location_id } = req.query;
        const [rows] = await pool.query('SELECT * FROM company_info LIMIT 1');
        if (rows.length > 0) {
            let companyInfo = rows[0];

            if (location_id) {
                const [locRows] = await pool.query(
                    'SELECT * FROM company_location_info WHERE company_id = ? AND location_id = ? LIMIT 1',
                    [companyInfo.id, location_id]
                );
                if (locRows.length > 0) {
                    const locInfo = locRows[0];
                    // Override base company fields with location specific fields if they exist
                    ['Address', 'Contact', 'Email', 'NTNo', 'GSTNo', 'GovtNo', 'IATACode', 'FaxNo'].forEach(field => {
                        if (locInfo[field] !== null && locInfo[field] !== undefined && locInfo[field] !== '') {
                            companyInfo[field] = locInfo[field];
                        }
                    });
                }
            }
            res.json(companyInfo);
        } else {
            res.status(404).json({ error: 'Company info not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update or set location-specific company info
router.post('/location', async (req, res) => {
    try {
        const { location_id, Address, Contact, Email, NTNo, GSTNo, GovtNo, IATACode, FaxNo } = req.body;
        if (!location_id) return res.status(400).json({ error: 'location_id is required' });

        const [companyRows] = await pool.query('SELECT id FROM company_info LIMIT 1');
        if (companyRows.length === 0) return res.status(404).json({ error: 'Base company info not found' });
        
        const company_id = companyRows[0].id;

        const [existing] = await pool.query(
            'SELECT id FROM company_location_info WHERE company_id = ? AND location_id = ?',
            [company_id, location_id]
        );

        if (existing.length > 0) {
            await pool.query(
                'UPDATE company_location_info SET Address=?, Contact=?, Email=?, NTNo=?, GSTNo=?, GovtNo=?, IATACode=?, FaxNo=? WHERE id=?',
                [Address, Contact, Email, NTNo, GSTNo, GovtNo, IATACode, FaxNo, existing[0].id]
            );
        } else {
            await pool.query(
                'INSERT INTO company_location_info (company_id, location_id, Address, Contact, Email, NTNo, GSTNo, GovtNo, IATACode, FaxNo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [company_id, location_id, Address, Contact, Email, NTNo, GSTNo, GovtNo, IATACode, FaxNo]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
