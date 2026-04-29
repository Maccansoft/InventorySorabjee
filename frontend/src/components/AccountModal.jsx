import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save } from 'lucide-react';

const API = '/api';

/**
 * AccountModal
 * - account = null           → new top-level account (only if allowed)
 * - account = { _parent }    → new child of _parent
 * - account = { id, ... }    → edit existing account
 */
const AccountModal = ({ currentUser, account, accounts, onClose, onSave }) => {
    const isEditing = account && account.id;
    const presetParent = account && account._parent ? account._parent : null;

    const [formData, setFormData] = useState({
        account_name: isEditing ? account.account_name : '',
        parent_id: presetParent ? presetParent.id : '',
        is_active: isEditing ? !!account.is_active : true,
        statement_type: isEditing ? (account.statement_type || 'BALANCE_SHEET') : (presetParent ? presetParent.statement_type : 'BALANCE_SHEET'),
        inventory_module: isEditing ? (account.inventory_module || 'NONE') : 'NONE',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // flatten all accounts for parent dropdown
    const flattenAccounts = (list) => {
        let result = [];
        list.forEach(a => {
            if (a.is_virtual) return; // skip virtual location nodes for parenting
            result.push(a);
            if (a.children) result.push(...flattenAccounts(a.children));
        });
        return result;
    };
    const allAccounts = flattenAccounts(accounts);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isEditing) {
                await axios.put(`${API}/accounts/${account.id}`, {
                    account_name: formData.account_name,
                    is_active: formData.is_active,
                    statement_type: formData.statement_type,
                    inventory_module: formData.inventory_module,
                });
            } else {
                if (!formData.parent_id) {
                    setError('Please select a parent account.');
                    setLoading(false);
                    return;
                }
                await axios.post(`${API}/accounts/create`, {
                    account_name: formData.account_name,
                    parent_id: formData.parent_id,
                    is_active: formData.is_active,
                    statement_type: formData.statement_type,
                    inventory_module: formData.inventory_module,
                    location_id: currentUser?.location_id,
                    created_by: currentUser?.id
                });
            }
            onClose();
            onSave();
        } catch (err) {
            console.error('Account Save Error:', err);
            setError(err.response?.data?.error || 'Something went wrong');
        }
        setLoading(false);
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content animate-fade-in" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h2>{isEditing ? 'Edit Account' : presetParent ? `Add Sub-Account under "${presetParent.account_name}"` : 'New Account'}</h2>
                    <button onClick={onClose}><X size={22} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
                    {/* Auto-code preview */}
                    {!isEditing && formData.parent_id && (() => {
                        const parentAcc = allAccounts.find(a => String(a.id) === String(formData.parent_id));
                        if (!parentAcc) return null;
                        
                        // Find children directly under this parent in our tree
                        const findChildren = (list, pid) => {
                            for (let acc of list) {
                                if (String(acc.id) === String(pid)) return acc.children || [];
                                if (acc.children) {
                                    const found = findChildren(acc.children, pid);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };
                        const children = (accounts && accounts.length > 0) ? findChildren(accounts, formData.parent_id) : [];
                        
                        let nextNum = 1;
                        if (children.length > 0) {
                            const suffixes = children
                                .filter(c => c.account_code && c.account_code.includes('-'))
                                .map(c => {
                                    const parts = c.account_code.split('-');
                                    return parseInt(parts[parts.length - 1]) || 0;
                                });
                            if (suffixes.length > 0) nextNum = Math.max(...suffixes) + 1;
                        }
                        
                        const nextCode = `${parentAcc.account_code}-${String(nextNum).padStart(3, '0')}`;
                        
                        return (
                            <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: '0.875rem', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                <strong>Generated Code:</strong> <code style={{ fontWeight: 700, marginLeft: 4 }}>{nextCode}</code>
                                <p style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>This code will be assigned to the new account.</p>
                            </div>
                        );
                    })()}

                    {/* Account Name */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label>Account Name</label>
                        <input
                            type="text"
                            value={formData.account_name}
                            onChange={e => setFormData({ ...formData, account_name: e.target.value })}
                            placeholder="e.g. Cash In Hand"
                            required
                        />
                    </div>

                    {/* Statement Type (Belongs To) */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label>Belongs To (Statement)</label>
                        <select
                            value={formData.statement_type}
                            onChange={e => setFormData({ ...formData, statement_type: e.target.value })}
                            required
                        >
                            <option value="BALANCE_SHEET">Balance Sheet</option>
                            <option value="PROFIT_LOSS">Profit & Loss</option>
                            <option value="BOTH">Both</option>
                        </select>
                    </div>

                    {/* Parent selector — hidden when editing */}
                    {!isEditing && !presetParent && (
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label>Select Parent Account</label>
                            <select
                                value={formData.parent_id}
                                onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                                required
                            >
                                <option value="">-- Select Parent --</option>
                                {allAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {'—'.repeat(acc.level - 1)} {acc.account_code} – {acc.account_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Active toggle */}
                    <div className="form-group" style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={() => setFormData({ ...formData, is_active: !formData.is_active })}
                            style={{ width: 18, height: 18 }}
                        />
                        <label htmlFor="is_active" style={{ marginBottom: 0 }}>Active</label>
                    </div>

                    {/* Inventory Module Mapping */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label>Inventory Module Mapping</label>
                        <select
                            value={formData.inventory_module}
                            onChange={e => setFormData({ ...formData, inventory_module: e.target.value })}
                            required
                        >
                            <option value="NONE">None</option>
                            <option value="STOCK_PURCHASE">Stock Purchase</option>
                            <option value="PURCHASE_RETURN">Purchase Return</option>
                            <option value="SALES_INVOICE">Sales Invoice</option>
                            <option value="SALES_RETURN">Sales Return</option>
                        </select>
                    </div>

                    {error && <p style={{ color: '#ef4444', marginBottom: 12 }}>{error}</p>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            <Save size={16} /> {loading ? 'Saving…' : 'Save Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccountModal;
