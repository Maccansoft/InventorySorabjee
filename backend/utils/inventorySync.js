const db = require('../db');

/**
 * Generic sync to ledger for inventory transactions.
 * Maps types to COA inventory_module values and posts JV vouchers.
 */
async function syncInventoryToLedger(conn, {
    tx_id,
    trans_no,
    trans_date,
    party_id, // supplier_id or customer_id
    total_amount,
    location_id,
    fiscal_year_id,
    type, // 'PURCHASE', 'PURCHASE_RETURN', 'SALES_INVOICE', 'SALES_RETURN'
    headerTable, // e.g. 'purchases'
}) {
    if (!party_id || parseFloat(total_amount || 0) <= 0) {
        const [[existing]] = await conn.query(`SELECT voucher_id FROM ${headerTable} WHERE id = ?`, [tx_id]);
        if (existing && existing.voucher_id) {
            await conn.query('DELETE FROM voucher_entries WHERE voucher_id = ?', [existing.voucher_id]);
            await conn.query('DELETE FROM vouchers WHERE id = ?', [existing.voucher_id]);
            await conn.query(`UPDATE ${headerTable} SET voucher_id = NULL WHERE id = ?`, [tx_id]);
        }
        return null;
    }

    // 0. Check Fiscal Year
    const [[fy]] = await conn.query('SELECT is_closed, label FROM fiscal_years WHERE id = ?', [fiscal_year_id]);
    if (fy && fy.is_closed) throw new Error('Cannot post to a closed financial year.');
    const fyLabel = fy ? fy.label : '';

    // 1. Determine Party Account
    let partyName = '';
    let partyAccName = '';
    const isPurchase = type.startsWith('PURCHASE');

    if (isPurchase) {
        const [[p]] = await conn.query('SELECT name FROM suppliers WHERE id = ?', [party_id]);
        if (!p) throw new Error('Supplier not found.');
        partyName = p.name;
    } else {
        const [[p]] = await conn.query('SELECT name FROM customers WHERE id = ?', [party_id]);
        if (!p) throw new Error('Customer not found.');
        partyName = p.name;
    }
    partyAccName = partyName.toUpperCase();

    const [[partyAcc]] = await conn.query(
        'SELECT id FROM chart_of_accounts WHERE account_name = ? AND is_main = FALSE',
        [partyAccName]
    );

    // 2. Find Inventory Module Account
    // Mapping internal types to inventory_module values in COA table
    const moduleMapping = {
        'PURCHASE': 'STOCK_PURCHASE',
        'PURCHASE_RETURN': 'PURCHASE_RETURN',
        'SALES_INVOICE': 'SALES_INVOICE',
        'SALES_RETURN': 'SALES_RETURN'
    };
    const mappedModule = moduleMapping[type];
    const [[moduleAcc]] = await conn.query(
        "SELECT id FROM chart_of_accounts WHERE inventory_module = ?",
        [mappedModule]
    );

    if (!partyAcc || !moduleAcc) {
        throw new Error(`COA Mapping Missing: ${!partyAcc ? 'Party Account (' + partyAccName + ')' : 'Inventory Module Account (' + mappedModule + ')'} not found in Chart of Accounts.`);
    }

    // 3. Handle Voucher
    const [[existing]] = await conn.query(`SELECT voucher_id FROM ${headerTable} WHERE id = ?`, [tx_id]);
    let voucherId = existing ? existing.voucher_id : null;
    let voucher_no = '';

    if (voucherId) {
        const [[v]] = await conn.query('SELECT voucher_no FROM vouchers WHERE id = ?', [voucherId]);
        voucher_no = v ? v.voucher_no : '';
        await conn.query('DELETE FROM voucher_entries WHERE voucher_id = ?', [voucherId]);
    }

    if (!voucherId || !voucher_no) {
        const voucher_type = 'JOURNAL';
        const typeCode = 'JV';
        const [[{ count }]] = await conn.query(
            'SELECT COUNT(*) as count FROM vouchers WHERE voucher_type = ? AND location_id = ? AND fiscal_year_id = ?',
            [voucher_type, location_id, fiscal_year_id]
        );

        let locCode = 'HO';
        if (location_id) {
            const [[loc]] = await conn.query('SELECT code FROM locations WHERE id = ?', [location_id]);
            if (loc && loc.code && loc.code !== 'XX') locCode = loc.code.toUpperCase();
        }

        if (type === 'SALES_INVOICE') {
            const nextSeq = String(count + 1).padStart(4, '0');
            voucher_no = `JV/${locCode}/${fyLabel}/${nextSeq}`;
        } else {
            let locStr = locCode !== 'HO' ? `-${locCode}` : '';
            voucher_no = `${typeCode}${locStr}/${count + 1}`;
        }

        let description = `${type.replace('_', ' ')}: ${partyName} - Ref: ${trans_no}`;
        if (type === 'SALES_INVOICE') {
            description = `Inventory Item sold Agt Invoice No. ${trans_no}`;
        }

        const [vRes] = await conn.query(
            `INSERT INTO vouchers (voucher_no, voucher_type, date, description, total_amount, location_id, fiscal_year_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [voucher_no, voucher_type, trans_date, description, total_amount, location_id, fiscal_year_id]
        );
        voucherId = vRes.insertId;
        await conn.query(`UPDATE ${headerTable} SET voucher_id = ? WHERE id = ?`, [voucherId, tx_id]);
    } else {
        let description = `${type.replace('_', ' ')}: ${partyName} - Ref: ${trans_no}`;
        if (type === 'SALES_INVOICE') {
            description = `Inventory Item sold Agt Invoice No. ${trans_no}`;
        }
        await conn.query(
            `UPDATE vouchers SET date = ?, description = ?, total_amount = ? WHERE id = ?`,
            [trans_date, description, total_amount, voucherId]
        );
    }

    let entryDesc = `${type.replace('_', ' ')}: ${partyName} - Ref: ${trans_no}`;
    if (type === 'SALES_INVOICE') {
        entryDesc = `Inventory Item sold Agt Invoice No. ${trans_no}`;
    }

    // 4. Create Ledger Entries (Debit/Credit logic based on type)
    // Purchases & Sales Returns: Debit Inventory Account, Credit Party
    // Sales & Purchase Returns: Credit Inventory Account, Debit Party

    let drAccId, crAccId;
    if (type === 'PURCHASE' || type === 'SALES_RETURN') {
        drAccId = moduleAcc.id;
        crAccId = partyAcc.id;
    } else {
        drAccId = partyAcc.id;
        crAccId = moduleAcc.id;
    }

    await conn.query(
        `INSERT INTO voucher_entries (voucher_id, account_id, dr_amount, cr_amount, description) VALUES (?, ?, ?, ?, ?)`,
        [voucherId, drAccId, total_amount, 0, entryDesc]
    );
    await conn.query(
        `INSERT INTO voucher_entries (voucher_id, account_id, dr_amount, cr_amount, description) VALUES (?, ?, ?, ?, ?)`,
        [voucherId, crAccId, 0, total_amount, entryDesc]
    );

    return voucherId;
}

module.exports = { syncInventoryToLedger };
