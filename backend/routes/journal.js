const express = require('express');
const router = express.Router();
const db = require('../db');

// ── POST /api/journal  ─────────────────────────────────────────────────────
// Saves journal header + detail lines in a transaction
router.post('/', async (req, res) => {
    const { header, lines } = req.body;

    // Validate balanced entry
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        return res.status(400).json({ error: 'Debit and Credit must be equal!' });
    }

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO journal_entries (entry_date, reference_no, description)
       VALUES (?, ?, ?)`,
            [header.entry_date, header.reference_no || null, header.description || null]
        );
        const journalId = result.insertId;

        for (const line of lines) {
            await conn.query(
                `INSERT INTO journal_entry_details (journal_id, account_id, debit, credit)
         VALUES (?, ?, ?, ?)`,
                [journalId, line.account_id, Number(line.debit || 0), Number(line.credit || 0)]
            );
        }

        await conn.commit();
        res.json({ success: true, id: journalId, message: 'Journal Posted Successfully' });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ── GET /api/journal  ──────────────────────────────────────────────────────
// List all journal entries with their lines
router.get('/', async (req, res) => {
    try {
        const [entries] = await db.query(
            'SELECT * FROM journal_entries ORDER BY entry_date DESC, id DESC'
        );
        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/journal/:id  ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const [[entry]] = await db.query(
            'SELECT * FROM journal_entries WHERE id = ?', [req.params.id]
        );
        const [lines] = await db.query(`
      SELECT jed.*, coa.account_code, coa.account_name
      FROM journal_entry_details jed
      JOIN chart_of_accounts coa ON jed.account_id = coa.id
      WHERE jed.journal_id = ?
    `, [req.params.id]);
        res.json({ ...entry, lines });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
