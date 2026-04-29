import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Save, X, Plus, Trash2, Hash, Loader2 } from 'lucide-react';
import SearchableSelect from './common/SearchableSelect';

const API = '/api';

/** Flatten nested account tree → sorted flat array */
const flattenAccounts = (list) => {
    let result = [];
    list.forEach(a => {
        result.push(a);
        if (a.children) result.push(...flattenAccounts(a.children));
    });
    return result.sort((a, b) => a.account_code.localeCompare(b.account_code));
};

/** Render account <option> with indent */
const AOption = ({ acc }) => (
    <option key={acc.id} value={acc.id}>
        {'—'.repeat(acc.level - 1)}{acc.account_code} – {acc.account_name}
    </option>
);

// ─────────────────────────────────────────────────────────────────────────────
//  RECEIPT VOUCHER
// ─────────────────────────────────────────────────────────────────────────────
const ReceiptVoucher = ({ formData, setFormData, accounts, creditLines, setCreditLines, voucherNo }) => {
    const flatAccounts = useMemo(() => flattenAccounts(accounts), [accounts]);

    // ── Find debit accounts based on payment mode ─────────────────────────────
    // paymentMode: 'CASH' | 'CHEQUE' | 'ONLINE'
    const debitAccounts = useMemo(() => {
        const mode = formData.payment_mode;
        if (!mode) return [];

        // Find all accounts where account_name contains the mode keyword (case-insensitive)
        // OR where their parent's account_name contains it
        const keyword = mode === 'CASH' ? 'cash' : mode === 'CHEQUE' ? 'bank' : 'bank';

        // Step 1: find "parent" accounts that match the keyword
        const parentMatches = flatAccounts.filter(a =>
            a.account_name.toLowerCase().includes(keyword)
        );

        // Step 2: collect IDs of those parents
        const parentIds = parentMatches.map(a => a.id);

        // Step 3: return children of those parents (and the parents themselves) where is_active
        const result = flatAccounts.filter(a =>
            a.is_active &&
            (parentIds.includes(a.id) || parentIds.includes(a.parent_id))
        );

        return result;
    }, [flatAccounts, formData.payment_mode]);

    const showBankFields = formData.payment_mode === 'CHEQUE' || formData.payment_mode === 'ONLINE';

    // ── Credit line helpers ───────────────────────────────────────────────────
    const addLine = () => setCreditLines([...creditLines, { account_id: '', credit: '', description: '' }]);
    const removeLine = (i) => creditLines.length > 1 && setCreditLines(creditLines.filter((_, idx) => idx !== i));
    const setLine = (i, f, v) => { const u = [...creditLines]; u[i][f] = v; setCreditLines(u); };

    const totalCr = creditLines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
    const chequeAmt = parseFloat(formData.cheque_amount || 0);
    const isBalanced = chequeAmt > 0 && Math.abs(chequeAmt - totalCr) < 0.001;

    return (
        <>
            {/* ── Row 1: Voucher No | Payment Mode | Date ── */}
            <div className="form-grid">
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Hash size={14} /> Voucher No
                    </label>
                    <input type="text" value={voucherNo} readOnly
                        style={{
                            background: '#f1f5f9', fontWeight: 700, color: '#0284c7',
                            letterSpacing: '0.05em', cursor: 'default'
                        }} />
                </div>

                <div className="form-group">
                    <label>Payment Mode <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={formData.payment_mode} required
                        onChange={e => setFormData({ ...formData, payment_mode: e.target.value, debit_account_id: '' })}>
                        <option value="">— Select Mode —</option>
                        <option value="CASH">Cash</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="ONLINE">Online Transfer</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={formData.date} required
                        onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>

                {/* ── Bank fields — only for CHEQUE / ONLINE ── */}
                {showBankFields && <>
                    <div className="form-group">
                        <label>Bank Name</label>
                        <input type="text" placeholder="e.g. MCB, HBL, UBL"
                            value={formData.bank_name}
                            onChange={e => setFormData({ ...formData, bank_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Cheque No</label>
                        <input type="text" value={formData.cheque_no}
                            onChange={e => setFormData({ ...formData, cheque_no: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Cheque Date</label>
                        <input type="date" value={formData.cheque_date}
                            onChange={e => setFormData({ ...formData, cheque_date: e.target.value })} />
                    </div>
                </>}

                {/* ── Debit Account (filtered by payment mode) ── */}
                <div className="form-group">
                    <label>
                        Debit Account
                        {formData.payment_mode && (
                            <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 7px', borderRadius: 20 }}>
                                {formData.payment_mode === 'CASH' ? 'CASH accounts' : 'BANK accounts'}
                            </span>
                        )}
                        <span style={{ color: '#ef4444' }}> *</span>
                    </label>
                    <SearchableSelect
                        options={debitAccounts.map(a => ({
                            value: a.id,
                            label: `${a.account_code} – ${a.account_name}`,
                            level: a.level
                        }))}
                        value={formData.debit_account_id}
                        disabled={!formData.payment_mode}
                        onChange={val => setFormData({ ...formData, debit_account_id: val })}
                        placeholder={!formData.payment_mode ? 'Select Payment Mode first' : 'Select Debit Account'}
                    />
                </div>

                <div className="form-group">
                    <label>Cheque / Cash Amount (DR) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="number" step="1" min="0"
                        placeholder="0"
                        value={formData.cheque_amount || ''}
                        onChange={e => setFormData({ ...formData, cheque_amount: e.target.value })} />
                </div>


                <div className="form-group full-width">
                    <label>Description / Narration</label>
                    <textarea rows={2} placeholder="General description…"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
            </div>

            {/* ── Credit Entries ── */}
            <div className="entries-section">
                <div className="section-header">
                    <h3>Credit Entries</h3>
                    <button type="button" className="btn-add-row" onClick={addLine}>
                        <Plus size={14} /> Add Row
                    </button>
                </div>

                <table className="entries-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Account (Credit)</th>
                            <th style={{ width: '30%' }}>Description / Narration</th>
                            <th style={{ width: '20%', textAlign: 'right' }}>Credit (CR)</th>
                            <th style={{ width: '10%' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {creditLines.map((line, i) => (
                            <tr key={i}>
                                <td>
                                    <SearchableSelect
                                        options={flatAccounts.filter(a => a.is_active).map(a => ({
                                            value: a.id,
                                            label: `${a.account_code} – ${a.account_name}`,
                                            level: a.level
                                        }))}
                                        value={line.account_id}
                                        onChange={val => setLine(i, 'account_id', val)}
                                        placeholder="Select Account"
                                    />
                                </td>
                                <td>
                                    <input type="text" value={line.description}
                                        placeholder="Narration…"
                                        onChange={e => setLine(i, 'description', e.target.value)} />
                                </td>
                                <td>
                                    <input type="number" step="1" min="0"
                                        value={line.credit || ''}
                                        placeholder="0"
                                        style={{ textAlign: 'right' }}
                                        onChange={e => setLine(i, 'credit', e.target.value)} />
                                </td>

                                <td style={{ textAlign: 'center' }}>
                                    {creditLines.length > 1 && (
                                        <button type="button" className="btn-remove" onClick={() => removeLine(i)}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                            <td colSpan="2" style={{ padding: '10px 12px', color: '#475569' }}>TOTALS</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#ef4444' }}>
                                CR: {totalCr.toFixed(0)}
                            </td>

                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* ── Balance indicator ── */}
            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontWeight: 700, fontSize: '0.9rem', alignItems: 'center' }}>
                <span style={{ color: '#10b981' }}>
                    DR: {chequeAmt.toFixed(0)}
                    <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#94a3b8', marginLeft: 5 }}>
                        ({formData.payment_mode || 'Amount'})
                    </span>
                </span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ color: '#ef4444' }}>CR: {totalCr.toFixed(0)}</span>
                {chequeAmt > 0 && !isBalanced && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                        ⚠ Diff: {Math.abs(chequeAmt - totalCr).toFixed(0)}
                    </span>
                )}

                {isBalanced && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                        ✓ Balanced
                    </span>
                )}
            </div>
        </>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT VOUCHER
// ─────────────────────────────────────────────────────────────────────────────
const PaymentVoucher = ({ formData, setFormData, accounts, debitLines, setDebitLines, voucherNo }) => {
    const flatAccounts = useMemo(() => flattenAccounts(accounts), [accounts]);

    // ── Find credit accounts based on payment mode ─────────────────────────────
    const creditAccounts = useMemo(() => {
        const mode = formData.payment_mode;
        if (!mode) return [];
        const keyword = mode === 'CASH' ? 'cash' : 'bank';
        const parentMatches = flatAccounts.filter(a => a.account_name.toLowerCase().includes(keyword));
        const parentIds = parentMatches.map(a => a.id);
        return flatAccounts.filter(a => a.is_active && (parentIds.includes(a.id) || parentIds.includes(a.parent_id)));
    }, [flatAccounts, formData.payment_mode]);

    const showBankFields = formData.payment_mode === 'CHEQUE' || formData.payment_mode === 'ONLINE';

    // ── Debit line helpers ────────────────────────────────────────────────────
    const addLine = () => setDebitLines([...debitLines, { account_id: '', debit: '', description: '' }]);
    const removeLine = (i) => debitLines.length > 1 && setDebitLines(debitLines.filter((_, idx) => idx !== i));
    const setLine = (i, f, v) => { const u = [...debitLines]; u[i][f] = v; setDebitLines(u); };

    const totalDr = debitLines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
    const crAmt = parseFloat(formData.cheque_amount || 0);
    const isBalanced = crAmt > 0 && Math.abs(crAmt - totalDr) < 0.001;

    return (
        <>
            <div className="form-grid">
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Hash size={14} /> Voucher No</label>
                    <input type="text" value={voucherNo} readOnly style={{ background: '#f1f5f9', fontWeight: 700, color: '#0284c7', letterSpacing: '0.05em' }} />
                </div>
                <div className="form-group">
                    <label>Paid By <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={formData.payment_mode} required onChange={e => setFormData({ ...formData, payment_mode: e.target.value, credit_account_id: '' })}>
                        <option value="">— Select Mode —</option>
                        <option value="CASH">Cash</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="ONLINE">Online Transfer</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={formData.date} required onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                {showBankFields && <>
                    <div className="form-group">
                        <label>Cheque No</label>
                        <input type="text" value={formData.cheque_no} onChange={e => setFormData({ ...formData, cheque_no: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Cheque Date</label>
                        <input type="date" value={formData.cheque_date} onChange={e => setFormData({ ...formData, cheque_date: e.target.value })} />
                    </div>
                </>}
                <div className="form-group">
                    <label>Credit Account {formData.payment_mode && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 7px', borderRadius: 20 }}>{formData.payment_mode}</span>} <span style={{ color: '#ef4444' }}> *</span></label>
                    <SearchableSelect
                        options={creditAccounts.map(a => ({
                            value: a.id,
                            label: `${a.account_code} – ${a.account_name}`,
                            level: a.level
                        }))}
                        value={formData.credit_account_id}
                        disabled={!formData.payment_mode}
                        onChange={val => setFormData({ ...formData, credit_account_id: val })}
                        placeholder={!formData.payment_mode ? 'Select Paid By first' : 'Select Credit Account'}
                    />
                </div>
                <div className="form-group">
                    <label>Amount (CR) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="number" step="1" min="0" placeholder="0" value={formData.cheque_amount || ''} onChange={e => setFormData({ ...formData, cheque_amount: e.target.value })} />
                </div>

                <div className="form-group full-width">
                    <label>Description</label>
                    <textarea rows={2} placeholder="General description…" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
            </div>
            <div className="entries-section">
                <div className="section-header">
                    <h3>Debit Entries</h3>
                    <button type="button" className="btn-add-row" onClick={addLine}><Plus size={14} /> Add Row</button>
                </div>
                <table className="entries-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Account (Debit)</th>
                            <th style={{ width: '30%' }}>Description</th>
                            <th style={{ width: '20%', textAlign: 'right' }}>Debit (DR)</th>
                            <th style={{ width: '10%' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {debitLines.map((line, i) => (
                            <tr key={i}>
                                <td>
                                    <SearchableSelect
                                        options={flatAccounts.filter(a => a.is_active).map(a => ({
                                            value: a.id,
                                            label: `${a.account_code} – ${a.account_name}`,
                                            level: a.level
                                        }))}
                                        value={line.account_id}
                                        onChange={val => setLine(i, 'account_id', val)}
                                        placeholder="Select Account"
                                    />
                                </td>
                                <td><input type="text" value={line.description} placeholder="Narration…" onChange={e => setLine(i, 'description', e.target.value)} /></td>
                                <td><input type="number" step="1" min="0" value={line.debit || ''} placeholder="0" style={{ textAlign: 'right' }} onChange={e => setLine(i, 'debit', e.target.value)} /></td>

                                <td style={{ textAlign: 'center' }}>{debitLines.length > 1 && <button type="button" className="btn-remove" onClick={() => removeLine(i)}><Trash2 size={14} /></button>}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                            <td colSpan="2" style={{ padding: '10px 12px', color: '#475569' }}>TOTALS</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#10b981' }}>DR: {totalDr.toFixed(0)}</td>

                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontWeight: 700, fontSize: '0.9rem', alignItems: 'center' }}>
                <span style={{ color: '#ef4444' }}>CR: {crAmt.toFixed(0)}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ color: '#10b981' }}>DR: {totalDr.toFixed(0)}</span>
                {crAmt > 0 && !isBalanced && <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem' }}>⚠ Diff: {Math.abs(crAmt - totalDr).toFixed(0)}</span>}

                {isBalanced && <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem' }}>✓ Balanced</span>}
            </div>
        </>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  JOURNAL VOUCHER — Standard DR+CR entries
// ─────────────────────────────────────────────────────────────────────────────
const StandardVoucher = ({ type, formData, setFormData, accounts, entries, setEntries, voucherNo }) => {
    const flatAccounts = useMemo(() => flattenAccounts(accounts).filter(a => a.is_active), [accounts]);

    const addRow = () => setEntries([...entries, { account_id: '', dr_amount: '', cr_amount: '', description: '' }]);
    const removeRow = (i) => entries.length > 1 && setEntries(entries.filter((_, idx) => idx !== i));
    const setEntry = (i, f, v) => { const u = [...entries]; u[i][f] = v; setEntries(u); };

    const totalDr = entries.reduce((s, e) => s + parseFloat(e.dr_amount || 0), 0);
    const totalCr = entries.reduce((s, e) => s + parseFloat(e.cr_amount || 0), 0);
    const isBalanced = totalDr > 0 && Math.abs(totalDr - totalCr) < 0.001;

    return (
        <>
            <div className="form-grid">
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Hash size={14} /> Voucher No
                    </label>
                    <input type="text" value={voucherNo} readOnly
                        style={{ background: '#f1f5f9', fontWeight: 700, color: '#0284c7', letterSpacing: '0.05em', cursor: 'default' }} />
                </div>

                <div className="form-group">
                    <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={formData.date} required
                        onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>

            </div>

            <div className="entries-section">
                <div className="section-header">
                    <h3>Accounting Entries</h3>
                    <button type="button" className="btn-add-row" onClick={addRow}>
                        <Plus size={14} /> Add Row
                    </button>
                </div>
                <table className="entries-table">
                    <thead>
                        <tr>
                            <th style={{ width: '34%' }}>Account</th>
                            <th style={{ width: '24%' }}>Description</th>
                            <th style={{ width: '16%', textAlign: 'right' }}>Debit (DR)</th>
                            <th style={{ width: '16%', textAlign: 'right' }}>Credit (CR)</th>
                            <th style={{ width: '10%' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry, i) => (
                            <tr key={i}>
                                <td>
                                    <SearchableSelect
                                        options={flatAccounts.map(a => ({
                                            value: a.id,
                                            label: `${a.account_code} – ${a.account_name}`,
                                            level: a.level
                                        }))}
                                        value={entry.account_id}
                                        onChange={val => setEntry(i, 'account_id', val)}
                                        placeholder="Select Account"
                                    />
                                </td>
                                <td>
                                    <input type="text" value={entry.description} placeholder="Narration…"
                                        onChange={e => setEntry(i, 'description', e.target.value)} />
                                </td>
                                <td>
                                    <input type="number" step="0.01" min="0" value={entry.dr_amount || ''}
                                        placeholder="0.00" style={{ textAlign: 'right' }}
                                        onChange={e => setEntry(i, 'dr_amount', e.target.value)} />
                                </td>
                                <td>
                                    <input type="number" step="0.01" min="0" value={entry.cr_amount || ''}
                                        placeholder="0.00" style={{ textAlign: 'right' }}
                                        onChange={e => setEntry(i, 'cr_amount', e.target.value)} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {entries.length > 1 && (
                                        <button type="button" className="btn-remove" onClick={() => removeRow(i)}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                            <td colSpan="2" style={{ padding: '10px 12px', color: '#475569' }}>TOTALS</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#10b981' }}>{totalDr.toFixed(0)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#ef4444' }}>{totalCr.toFixed(0)}</td>
                            <td></td>
                        </tr>

                    </tfoot>
                </table>
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontWeight: 700, fontSize: '0.9rem', alignItems: 'center' }}>
                <span style={{ color: '#10b981' }}>DR: {totalDr.toFixed(0)}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ color: '#ef4444' }}>CR: {totalCr.toFixed(0)}</span>
                {totalDr > 0 && !isBalanced && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                        ⚠ Diff: {Math.abs(totalDr - totalCr).toFixed(0)}
                    </span>
                )}

                {isBalanced && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                        ✓ Balanced
                    </span>
                )}
            </div>
        </>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Wrapper
// ─────────────────────────────────────────────────────────────────────────────
const VoucherForm = ({ type, editData = null, accounts, locationId, fiscalYearId, onClose, onSave }) => {
    const isEditing = !!editData?.id;

    const [voucherNo, setVoucherNo] = useState(isEditing ? (editData.voucher_no || '—') : 'Loading…');

    // Detect payment_mode from paid_by when editing a RECEIPT
    const detectMode = (paid_by) => {
        if (!paid_by) return '';
        const val = paid_by.toUpperCase();
        if (val === 'CASH') return 'CASH';
        if (val === 'ONLINE') return 'ONLINE';
        return 'CHEQUE';
    };

    const [formData, setFormData] = useState(() => ({
        date: isEditing ? (editData.date || '') : new Date().toISOString().split('T')[0],
        description: isEditing ? (editData.description || '') : '',
        cheque_no: isEditing ? (editData.cheque_no || '') : '',
        cheque_date: isEditing ? (editData.cheque_date || '') : '',
        bank_name: isEditing ? (editData.bank_name || '') : '',
        paid_by: isEditing ? (editData.paid_by || '') : '',
        payment_mode: isEditing && (type === 'RECEIPT' || type === 'PAYMENT') ? detectMode(editData.paid_by) : '',
        debit_account_id: '',   // for RECEIPT
        credit_account_id: '',  // for PAYMENT
        cheque_amount: isEditing ? (editData.total_amount || '') : '',
    }));

    // Standard entries (Payment / Journal)
    const [entries, setEntries] = useState(() => {
        if (isEditing && editData.entries?.length) {
            return editData.entries.map(e => ({
                account_id: e.account_id,
                dr_amount: e.dr_amount,
                cr_amount: e.cr_amount,
                description: e.description || ''
            }));
        }
        return [{ account_id: '', dr_amount: '', cr_amount: '', description: '' }];
    });

    // Receipt credit lines — all CR entries except first DR
    const [creditLines, setCreditLines] = useState(() => {
        if (isEditing && type === 'RECEIPT' && editData.entries?.length) {
            const crLines = editData.entries.filter(e => parseFloat(e.cr_amount || 0) > 0);
            return crLines.length
                ? crLines.map(e => ({ account_id: e.account_id, credit: e.cr_amount, description: e.description || '' }))
                : [{ account_id: '', credit: '', description: '' }];
        }
        return [{ account_id: '', credit: '', description: '' }];
    });

    // Payment debit lines — all DR entries except first CR
    const [debitLines, setDebitLines] = useState(() => {
        if (isEditing && type === 'PAYMENT' && editData.entries?.length) {
            const drLines = editData.entries.filter(e => parseFloat(e.dr_amount || 0) > 0);
            return drLines.length
                ? drLines.map(e => ({ account_id: e.account_id, debit: e.dr_amount, description: e.description || '' }))
                : [{ account_id: '', debit: '', description: '' }];
        }
        return [{ account_id: '', debit: '', description: '' }];
    });

    // For Edit: resolve specific side accounts
    useEffect(() => {
        if (isEditing && editData.entries?.length) {
            if (type === 'RECEIPT') {
                const drEntry = editData.entries.find(e => parseFloat(e.dr_amount || 0) > 0);
                if (drEntry) setFormData(prev => ({ ...prev, debit_account_id: String(drEntry.account_id) }));
            } else if (type === 'PAYMENT') {
                const crEntry = editData.entries.find(e => parseFloat(e.cr_amount || 0) > 0);
                if (crEntry) setFormData(prev => ({ ...prev, credit_account_id: String(crEntry.account_id) }));
            }
        }
    }, [isEditing, editData, type]);

    const [loading, setLoading] = useState(false);

    // ── Fetch next voucher number (new only) ──────────────────────────────────
    useEffect(() => {
        if (!isEditing) {
            axios.get(`${API}/vouchers/next-no`, {
                params: { type, location_id: locationId, fiscal_year_id: fiscalYearId }
            })
                .then(({ data }) => setVoucherNo(data.voucher_no))
                .catch(() => setVoucherNo(`${type.slice(0, 2)}/…`));
        }
    }, [type, isEditing, locationId, fiscalYearId]);

    // ── Validation ────────────────────────────────────────────────────────────
    const canSave = () => {
        if (type === 'RECEIPT') {
            const chequeAmt = parseFloat(formData.cheque_amount || 0);
            const totalCr = creditLines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
            return formData.payment_mode && formData.debit_account_id && chequeAmt > 0 &&
                Math.abs(chequeAmt - totalCr) < 0.001;
        }
        if (type === 'PAYMENT') {
            const chequeAmt = parseFloat(formData.cheque_amount || 0);
            const totalDr = debitLines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
            return formData.payment_mode && formData.credit_account_id && chequeAmt > 0 &&
                Math.abs(chequeAmt - totalDr) < 0.001;
        }
        const totalDr = entries.reduce((s, e) => s + parseFloat(e.dr_amount || 0), 0);
        const totalCr = entries.reduce((s, e) => s + parseFloat(e.cr_amount || 0), 0);
        return totalDr > 0 && Math.abs(totalDr - totalCr) < 0.001;
    };

    // ── Build entries ─────────────────────────────────────────────────────────
    const buildEntries = () => {
        if (type === 'RECEIPT') {
            const chequeAmt = parseFloat(formData.cheque_amount || 0);
            return [
                { account_id: parseInt(formData.debit_account_id), dr_amount: chequeAmt, cr_amount: 0, description: formData.description },
                ...creditLines.map(l => ({
                    account_id: parseInt(l.account_id),
                    dr_amount: 0,
                    cr_amount: parseFloat(l.credit || 0),
                    description: l.description || formData.description
                }))
            ];
        }
        if (type === 'PAYMENT') {
            const chequeAmt = parseFloat(formData.cheque_amount || 0);
            return [
                { account_id: parseInt(formData.credit_account_id), dr_amount: 0, cr_amount: chequeAmt, description: formData.description },
                ...debitLines.map(l => ({
                    account_id: parseInt(l.account_id),
                    dr_amount: parseFloat(l.debit || 0),
                    cr_amount: 0,
                    description: l.description || formData.description
                }))
            ];
        }
        return entries.map(e => ({
            account_id: parseInt(e.account_id),
            dr_amount: parseFloat(e.dr_amount || 0),
            cr_amount: parseFloat(e.cr_amount || 0),
            description: e.description
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSave()) { alert('Entries must be balanced (DR = CR) and all required fields filled.'); return; }
        setLoading(true);
        try {
            const payload = {
                voucher_type: type,
                date: formData.date,
                description: formData.description,
                cheque_no: formData.cheque_no,
                cheque_date: formData.cheque_date,
                bank_name: formData.bank_name,
                paid_by: formData.payment_mode || formData.paid_by,
                total_amount: (type === 'RECEIPT' || type === 'PAYMENT')
                    ? parseFloat(formData.cheque_amount || 0)
                    : entries.reduce((s, e) => s + parseFloat(e.dr_amount || 0), 0),
                entries: buildEntries(),
                location_id: locationId,
                fiscal_year_id: fiscalYearId
            };

            if (isEditing) {
                await axios.put(`${API}/vouchers/${editData.id}`, payload);
            } else {
                await axios.post(`${API}/vouchers`, payload);
            }
            onSave();
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || 'Error saving voucher');
        }
        setLoading(false);
    };

    const titles = {
        PAYMENT: isEditing ? `Edit Payment — ${voucherNo}` : 'New Payment Voucher',
        RECEIPT: isEditing ? `Edit Receipt — ${voucherNo}` : 'New Receipt Voucher',
        JOURNAL: isEditing ? `Edit Journal — ${voucherNo}` : 'New Journal Voucher',
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content voucher-modal animate-fade-in">
                <div className="modal-header">
                    <h2>{titles[type]}</h2>
                    <button onClick={onClose}><X size={22} /></button>
                </div>

                <form onSubmit={handleSubmit} className="voucher-form">
                    {type === 'RECEIPT'
                        ? <ReceiptVoucher
                            formData={formData}
                            setFormData={setFormData}
                            accounts={accounts}
                            creditLines={creditLines}
                            setCreditLines={setCreditLines}
                            voucherNo={voucherNo}
                        />
                        : type === 'PAYMENT'
                            ? <PaymentVoucher
                                formData={formData}
                                setFormData={setFormData}
                                accounts={accounts}
                                debitLines={debitLines}
                                setDebitLines={setDebitLines}
                                voucherNo={voucherNo}
                            />
                            : <StandardVoucher
                                type={type}
                                formData={formData}
                                setFormData={setFormData}
                                accounts={accounts}
                                entries={entries}
                                setEntries={setEntries}
                                voucherNo={voucherNo}
                            />
                    }

                    <div className="modal-footer">
                        <div style={{ fontSize: '0.8rem', color: canSave() ? '#22c55e' : '#94a3b8' }}>
                            {canSave() ? '✓ Ready to save' : 'Fill all fields and balance DR = CR before saving'}
                        </div>
                        <div className="actions">
                            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-primary"
                                disabled={loading}
                                style={{ opacity: canSave() ? 1 : 0.55 }}>
                                <Save size={16} /> {loading ? 'Saving…' : isEditing ? 'Update Voucher' : 'Save Voucher'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VoucherForm;

