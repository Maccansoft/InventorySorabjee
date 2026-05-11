import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Printer, FileText } from 'lucide-react';
import { printTable, exportToCSV } from '../utils/exportUtils';
import ExportModal from './common/ExportModal';

import SearchableSelect from './common/SearchableSelect';

const API = '/api';

const LedgerView = ({ accounts, fromDate, toDate, locationId, fiscalYearId, companyInfo, reportMeta }) => {

    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportModal, setExportModal] = useState(false);

    // flatten for dropdown
    const flattenAccounts = (list) => {
        let result = [];
        list.forEach(a => {
            result.push(a);
            if (a.children) result.push(...flattenAccounts(a.children));
        });
        return result.sort((a, b) => a.account_code.localeCompare(b.account_code));
    };
    const allAccounts = flattenAccounts(accounts);
    
    // Prepare options for SearchableSelect
    const accountOptions = allAccounts.map(a => ({
        value: a.id,
        label: `${a.account_code} – ${a.account_name}`,
        level: a.level
    }));

    const fetchLedger = async (id) => {
        if (!id) return;
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/ledger/${id}`, {
                params: {
                    fromDate, toDate,
                    ...(locationId ? { location_id: locationId } : { all_locations: 'true' }),
                    ...(fiscalYearId ? { fiscal_year_id: fiscalYearId } : {})
                }
            });

            setLedger(data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLedger(selectedAccountId);
    }, [selectedAccountId, fromDate, toDate]);

    const selectedAccount = allAccounts.find(a => a.id == selectedAccountId);

    return (
        <div className="ledger-container animate-fade-in">
            {/* Account selector */}
            <div className="ledger-report-card" style={{ marginBottom: 24 }}>
                <div className="report-header">
                    <h2>Account Ledger</h2>
                    <div style={{ minWidth: 320 }}>
                        <SearchableSelect
                            options={accountOptions}
                            value={selectedAccountId}
                            onChange={(val) => setSelectedAccountId(val)}
                            placeholder="Select Account"
                        />
                    </div>
                </div>
            </div>

            {/* Ledger entries */}
            {selectedAccountId && (
                <div className="ledger-report-card animate-fade-in" style={{ padding: 24 }}>
                    <div className="report-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                                {selectedAccount?.account_name}
                            </h2>
                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                                Code: <span style={{ fontWeight: 700, color: '#334155' }}>{selectedAccount?.account_code}</span> &nbsp;|&nbsp;
                                Type: <span className="badge-type">{selectedAccount?.account_type}</span>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
                                onClick={() => {
                                    const data = ledger.map(r => ({
                                        date: r.date,
                                        vno: r.voucher_no,
                                        type: r.voucher_type,
                                        desc: r.description,
                                        dr: r.dr_amount || 0,
                                        cr: r.cr_amount || 0,
                                        bal: r.balance
                                    }));
                                    printTable(`Ledger Report: ${selectedAccount?.account_name}`, ['Date', 'Voucher', 'Type', 'Description', 'Debit', 'Credit', 'Balance'], data, ['date', 'vno', 'type', 'desc', 'dr', 'cr', 'bal'], companyInfo, reportMeta);
                                }}>
                                <Printer size={16} /> Print
                            </button>
                            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
                                onClick={() => setExportModal(true)}>
                                <FileText size={16} /> Export
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                    ) : ledger.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                            No transactions found for this account.
                        </div>
                    ) : (
                        <table className="ledger-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Voucher No</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th className="text-right">Debit</th>
                                    <th className="text-right">Credit</th>
                                    <th className="text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((row, i) => (
                                    <tr key={i}>
                                        <td>{row.date}</td>
                                        <td>{row.voucher_no}</td>
                                        <td><span className="badge-type">{row.voucher_type}</span></td>
                                        <td>{row.description}</td>
                                        <td className="text-right" style={{ color: '#10b981' }}>
                                            {parseFloat(row.dr_amount || 0) > 0 ? parseFloat(row.dr_amount).toFixed(0) : '—'}
                                        </td>
                                        <td className="text-right" style={{ color: '#ef4444' }}>
                                            {parseFloat(row.cr_amount || 0) > 0 ? parseFloat(row.cr_amount).toFixed(0) : '—'}
                                        </td>
                                        <td className="text-right" style={{ fontWeight: 700, color: row.balance >= 0 ? '#0369a1' : '#dc2626' }}>
                                            {parseFloat(row.balance).toFixed(0)}
                                        </td>

                                    </tr>
                                ))}
                                {/* running totals */}
                                <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                                    <td colSpan="4">Totals</td>
                                    <td className="text-right">{ledger.reduce((s, r) => s + parseFloat(r.dr_amount || 0), 0).toFixed(0)}</td>
                                    <td className="text-right">{ledger.reduce((s, r) => s + parseFloat(r.cr_amount || 0), 0).toFixed(0)}</td>
                                    <td className="text-right">{ledger[ledger.length - 1]?.balance?.toFixed(0)}</td>

                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            )}
            {/* Format Selector Modal */}
            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title={`Ledger: ${selectedAccount?.account_name}`}
                onSelect={(format) => {
                    const data = ledger.map(r => ({
                        date: r.date,
                        vno: r.voucher_no,
                        type: r.voucher_type,
                        desc: r.description,
                        dr: r.dr_amount || 0,
                        cr: r.cr_amount || 0,
                        bal: r.balance
                    }));
                    const headers = ['Date', 'Voucher', 'Type', 'Description', 'Debit', 'Credit', 'Balance'];
                    const fields = ['date', 'vno', 'type', 'desc', 'dr', 'cr', 'bal'];

                    if (format === 'EXCEL') {
                        exportToCSV(`Ledger_${selectedAccount?.account_code}`, headers, data, fields);
                    } else {
                        printTable(`Ledger Report: ${selectedAccount?.account_name}`, headers, data, fields, companyInfo, reportMeta);
                    }
                }}
            />
        </div>
    );
};

export default LedgerView;
