const db = require('../db');

/**
 * Centralized JV numbering function.
 * Calculates next sequence number (MAX + 1) based on location and fiscal year for JOURNAL vouchers.
 * Handles concurrency using FOR UPDATE locks.
 */
async function getNextJVNumber(conn, location_id, fiscal_year_id) {
    const locId = location_id ? parseInt(location_id, 10) : null;
    const fyId = fiscal_year_id ? parseInt(fiscal_year_id, 10) : null;

    // Concurrency control: acquire locks on parent resources (location and fiscal year)
    if (locId) {
        await conn.query('SELECT id FROM locations WHERE id = ? FOR UPDATE', [locId]);
    }
    if (fyId) {
        await conn.query('SELECT id FROM fiscal_years WHERE id = ? FOR UPDATE', [fyId]);
    }

    // Query both the sequence_no column and extract numbers from voucher_no suffix
    const [[{ maxSeq, maxVal }]] = await conn.query(
        `SELECT 
            MAX(sequence_no) as maxSeq,
            MAX(CAST(SUBSTRING_INDEX(voucher_no, '/', -1) AS UNSIGNED)) as maxVal
         FROM vouchers 
         WHERE voucher_type = 'JOURNAL' 
           AND (location_id = ? OR (location_id IS NULL AND ? IS NULL))
           AND (fiscal_year_id = ? OR (fiscal_year_id IS NULL AND ? IS NULL))`,
        [locId, locId, fyId, fyId]
    );

    const nextSeq = Math.max(maxSeq || 0, maxVal || 0) + 1;

    // Resolve Location Code
    let locCode = 'HO';
    if (locId) {
        const [[loc]] = await conn.query('SELECT code FROM locations WHERE id = ?', [locId]);
        if (loc?.code && loc.code !== 'XX') {
            locCode = loc.code.toUpperCase();
        }
    }

    // Resolve Fiscal Year Label
    const [[fy]] = await conn.query('SELECT label FROM fiscal_years WHERE id = ?', [fyId]);
    const fyLabel = fy ? fy.label : new Date().getFullYear();

    // Format voucher number: JV/${locCode}/${fyLabel}/${nextSeq} formatted to 4 digits padding
    const voucher_no = `JV/${locCode}/${fyLabel}/${String(nextSeq).padStart(4, '0')}`;

    return {
        voucher_no,
        sequence_no: nextSeq,
        locCode,
        fyLabel
    };
}

/**
 * Check if a voucher number already exists in the database.
 */
async function checkVoucherNoExists(conn, voucher_no) {
    const [[existing]] = await conn.query(
        'SELECT id FROM vouchers WHERE voucher_no = ?',
        [voucher_no]
    );
    return !!existing;
}

module.exports = {
    getNextJVNumber,
    checkVoucherNoExists
};
