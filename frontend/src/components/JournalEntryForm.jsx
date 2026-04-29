import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Send, CheckCircle2, AlertCircle } from 'lucide-react';

const API = '/api';

const JournalEntryForm = ({ accounts, onSave }) => {
    const [header, setHeader] = useState({
        entry_date: new Date().toISOString().split('T')[0],
        reference_no: '',
        description: ''
    });
    const [lines, setLines] = useState([
        { account_id: '', debit: 0, credit: 0 },
        { account_id: '', debit: 0, credit: 0 }
    ]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

    // Flatten accounts tree into a sorted, selectable list
    const flattenAccounts = (list) => {
        let result = [];
        list.forEach(a => {
            result.push(a);
            if (a.children) result.push(...flattenAccounts(a.children));
        });
        return result.filter(a => a.is_active);
    };
    const selectableAccounts = flattenAccounts(accounts)
        .sort((a, b) => a.account_code.localeCompare(b.account_code));

    // ── helpers ────────────────────────────────────────────────────────────
    const addLine = () => setLines([...lines, { account_id: '', debit: 0, credit: 0 }]);
    const removeLine = (i) => {
        if (lines.length <= 2) return; // minimum 2 lines
        setLines(lines.filter((_, idx) => idx !== i));
    };
    const setLine = (i, field, val) => {
        const updated = [...lines];
        updated[i][field] = val;
        setLines(updated);
    };

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

    // ── submit ─────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isBalanced) {
            setMessage({ type: 'error', text: 'Debit and Credit must be equal!' });
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            await axios.post(`${API}/journal`, { header, lines });
            setMessage({ type: 'success', text: 'Journal Posted Successfully!' });
            // Reset form
            setLines([
                { account_id: '', debit: 0, credit: 0 },
                { account_id: '', debit: 0, credit: 0 }
            ]);
            setHeader({ entry_date: new Date().toISOString().split('T')[0], reference_no: '', description: '' });
            if (onSave) onSave();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Error posting journal.' });
        }
        setLoading(false);
    };

    return (
        <div className="journal-form-container">
            <form onSubmit={handleSubmit}>
                {/* Header fields */}
                <div className="form-grid" style={{ marginBottom: 20 }}>
                    <div className="form-group">
                        <label>Entry Date *</label>
                        <input type="date" value={header.entry_date} required
                            onChange={e => setHeader({ ...header, entry_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Reference No</label>
                        <input type="text" placeholder="e.g. JV-001"
                            value={header.reference_no}
                            onChange={e => setHeader({ ...header, reference_no: e.target.value })} />
                    </div>
                    <div className="form-group full-width">
                        <label>Description / Narration</label>
                        <textarea rows={2} placeholder="Describe this journal entry…"
                            value={header.description}
                            onChange={e => setHeader({ ...header, description: e.target.value })} />
                    </div>
                </div>

                {/* Lines table */}
                <div className="entries-section">
                    <div className="section-header">
                        <h3>Journal Lines</h3>
                        <button type="button" className="btn-add-row" onClick={addLine}>
                            <Plus size={14} /> Add Line
                        </button>
                    </div>

                    <table className="entries-table">
                        <thead>
                            <tr>
                                <th style={{ width: '50%' }}>Account</th>
                                <th style={{ width: '20%', textAlign: 'right' }}>Debit (DR)</th>
                                <th style={{ width: '20%', textAlign: 'right' }}>Credit (CR)</th>
                                <th style={{ width: '10%' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line, i) => (
                                <tr key={i}>
                                    <td>
                                        <select value={line.account_id}
                                            onChange={e => setLine(i, 'account_id', e.target.value)} required>
                                            <option value="">Select Account</option>
                                            {selectableAccounts.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    {'—'.repeat(a.level - 1)}{a.account_code} – {a.account_name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input type="number" step="0.01" min="0"
                                            value={line.debit || ''}
                                            placeholder="0.00"
                                            style={{ textAlign: 'right' }}
                                            onChange={e => setLine(i, 'debit', e.target.value)} />
                                    </td>
                                    <td>
                                        <input type="number" step="0.01" min="0"
                                            value={line.credit || ''}
                                            placeholder="0.00"
                                            style={{ textAlign: 'right' }}
                                            onChange={e => setLine(i, 'credit', e.target.value)} />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button type="button" className="btn-remove" onClick={() => removeLine(i)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                                <td style={{ padding: '10px 12px', color: '#475569' }}>TOTALS</td>
                                <td style={{ textAlign: 'right', padding: '10px 12px', color: '#10b981' }}>
                                    {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 12px', color: '#ef4444' }}>
                                    {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Status message */}
                {message && (
                    <div className={`journal-message ${message.type}`} style={{ margin: '16px 0' }}>
                        {message.type === 'success'
                            ? <CheckCircle2 size={17} />
                            : <AlertCircle size={17} />}
                        {message.text}
                    </div>
                )}

                {/* Balance indicator + submit */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                    <div style={{
                        display: 'flex', gap: 16, fontWeight: 700, fontSize: '0.9rem',
                        color: isBalanced ? '#22c55e' : '#ef4444'
                    }}>
                        <span>DR: {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        <span>CR: {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        {!isBalanced && totalDebit > 0 && (
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                                ⚠ Diff: {Math.abs(totalDebit - totalCredit).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading || !isBalanced}
                        style={{ opacity: (!isBalanced && totalDebit > 0) ? 0.5 : 1 }}>
                        <Send size={16} /> {loading ? 'Posting…' : 'Post Journal'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default JournalEntryForm;
