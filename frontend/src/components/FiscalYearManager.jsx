import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Calendar, CheckCircle, Lock, AlertTriangle, X } from 'lucide-react';

const API = '/api';

const FiscalYearManager = ({ currentUser, onFiscalYearClosed }) => {
    const [fiscalYears, setFiscalYears] = useState([]);
    const [showNewFY, setShowNewFY] = useState(false);
    const [closingId, setClosingId] = useState(null);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    // Auto-compute next FY label
    const getNextFY = () => {
        const activeFY = fiscalYears.find(fy => !fy.is_closed);
        if (!activeFY) return { label: '', start: '', end: '' };
        const endYear = new Date(activeFY.end_date).getFullYear();
        const nextStart = endYear; // E.g. if ends Jun 2026, next start is Jul 2026
        return {
            label: `${nextStart}-${nextStart + 1}`,
            start: `${nextStart}-07-01`,
            end: `${nextStart + 1}-06-30`
        };
    };

    const fetchFY = async () => {
        try {
            const { data } = await axios.get(`${API}/fiscal-years`);
            setFiscalYears(data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchFY(); }, []);

    const handleOpenNewFY = async () => {
        const next = getNextFY();
        if (!next.label) { setErr('No active fiscal year to compute the next one.'); return; }
        setLoading(true); setErr(''); setMsg('');
        try {
            await axios.post(`${API}/fiscal-years`, {
                label: next.label, start_date: next.start, end_date: next.end
            });
            setMsg(`Fiscal Year ${next.label} opened successfully!`);
            setShowNewFY(false);
            fetchFY();
        } catch (e) {
            setErr(e.response?.data?.error || 'Error opening new fiscal year');
        }
        setLoading(false);
    };

    const handleCloseFY = async (fy) => {
        if (!window.confirm(
            `Are you sure you want to FINALIZE & CLOSE Fiscal Year "${fy.label}"?\n\n` +
            `This will:\n` +
            `• Carry forward Assets & Liabilities as opening balances\n` +
            `• Net Revenue & Expenses → Accumulated Profit/Loss under Capital\n` +
            `• LOCK this fiscal year — no further changes allowed\n\n` +
            `This action CANNOT be undone!`
        )) return;

        setLoading(true); setErr(''); setMsg('');
        try {
            const { data } = await axios.post(`${API}/fiscal-years/${fy.id}/close`);
            setMsg(data.message || 'Fiscal year closed successfully');
            fetchFY();
            if (onFiscalYearClosed) onFiscalYearClosed();
        } catch (e) {
            setErr(e.response?.data?.error || 'Error closing fiscal year');
        }
        setLoading(false);
    };

    const nextFY = getNextFY();
    const activeFY = fiscalYears.find(fy => !fy.is_closed);

    return (
        <div className="fy-container animate-fade-in">
            <div className="um-header">
                <div className="um-header-left">
                    <Calendar size={22} />
                    <div>
                        <h2>Fiscal Year Management</h2>
                        <p>{fiscalYears.length} fiscal year{fiscalYears.length !== 1 ? 's' : ''} configured</p>
                    </div>
                </div>
                {currentUser.role === 'SUPER_ADMIN' && !activeFY && (
                    <button className="btn-primary" onClick={() => setShowNewFY(true)}>
                        <Plus size={16} /> Open New Fiscal Year
                    </button>
                )}
            </div>

            {msg && <div className="um-success-msg">✅ {msg}</div>}
            {err && <div className="um-error-msg">⚠️ {err}</div>}

            {/* Active FY Info */}
            {activeFY && (
                <div className="fy-active-card">
                    <div className="fy-active-indicator" />
                    <div className="fy-active-info">
                        <span className="fy-active-label">CURRENT ACTIVE FISCAL YEAR</span>
                        <h3 className="fy-active-title">{activeFY.label}</h3>
                        <div className="fy-dates">
                            <span>📅 Start: {new Date(activeFY.start_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                            <span>📅 End: {new Date(activeFY.end_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        </div>
                    </div>
                    {currentUser.role === 'SUPER_ADMIN' && (
                        <button
                            className="fy-close-btn"
                            onClick={() => handleCloseFY(activeFY)}
                            disabled={loading}
                        >
                            <Lock size={15} /> Finalize & Close Year
                        </button>
                    )}
                </div>
            )}

            {/* Preview next FY */}
            {currentUser.role === 'SUPER_ADMIN' && activeFY && (
                <div className="fy-next-preview">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span className="fy-next-label">NEXT FISCAL YEAR (Will open after closing current)</span>
                            <h4 className="fy-next-title">{nextFY.label}</h4>
                            <div className="fy-dates" style={{ fontSize: '0.8rem' }}>
                                <span>01 July {nextFY.start?.split('-')[0]} — 30 June {nextFY.end?.split('-')[0]}</span>
                            </div>
                        </div>
                        <AlertTriangle size={30} style={{ color: '#f59e0b', opacity: 0.5 }} />
                    </div>
                    <p className="fy-close-warning">
                        ⚠️ You must <b>finalize</b> the current fiscal year before opening the next one.
                        Upon closing, all Revenue &amp; Expense accounts will be zeroed out and the net
                        profit/loss will be carried to <b>Accumulated Profit/Loss</b> under Capital.
                    </p>
                </div>
            )}

            {/* FY History Table */}
            <div className="um-table-card">
                <table className="ledger-table">
                    <thead>
                        <tr>
                            <th>Fiscal Year</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Status</th>
                            <th>Closed On</th>
                            {currentUser.role === 'SUPER_ADMIN' && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {fiscalYears.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No fiscal years found.</td></tr>
                        ) : fiscalYears.map(fy => (
                            <tr key={fy.id} style={{ opacity: fy.is_closed ? 0.7 : 1 }}>
                                <td style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{fy.label}</td>
                                <td>{new Date(fy.start_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>{new Date(fy.end_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>
                                    {fy.is_closed ? (
                                        <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Lock size={13} /> Closed
                                        </span>
                                    ) : (
                                        <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <CheckCircle size={13} /> Active
                                        </span>
                                    )}
                                </td>
                                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                    {fy.closed_at
                                        ? new Date(fy.closed_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—'}
                                </td>
                                {currentUser.role === 'SUPER_ADMIN' && (
                                    <td>
                                        {!fy.is_closed && (
                                            <button className="fy-close-btn-sm" onClick={() => handleCloseFY(fy)} disabled={loading}>
                                                <Lock size={13} /> Close
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Open New FY Confirmation Modal */}
            {showNewFY && (
                <div className="modal-backdrop" onClick={() => setShowNewFY(false)}>
                    <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Open New Fiscal Year</h3>
                            <button className="modal-close" onClick={() => setShowNewFY(false)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '20px 24px' }}>
                            <div className="fy-confirm-info">
                                <Calendar size={36} style={{ color: '#0284c7' }} />
                                <div>
                                    <h4 style={{ margin: 0, color: '#1e293b' }}>New Fiscal Year: <b>{nextFY.label}</b></h4>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                        Period: 01 July {nextFY.start?.split('-')[0]} — 30 June {nextFY.end?.split('-')[0]}
                                    </p>
                                </div>
                            </div>
                            <p style={{ color: '#475569', marginTop: 16, lineHeight: 1.7, fontSize: '0.9rem' }}>
                                This will open a new fiscal year. Make sure all previous year data has been finalized and the current fiscal year has been closed before proceeding.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowNewFY(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleOpenNewFY} disabled={loading}>
                                <Plus size={15} /> Confirm &amp; Open
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FiscalYearManager;
